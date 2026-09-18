import { GoogleGenAI } from '@google/genai';
import { CandidatePassage, VerificationStatus } from './types';

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.startsWith('your_google_gemini')) {
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
}

export const GENERATION_MODEL = process.env.GEMINI_GENERATION_MODEL || 'gemini-2.5-flash';
export const VERDICT_MODEL = process.env.GEMINI_VERDICT_MODEL || 'gemini-2.5-flash';
export const EXPLANATION_MODEL = process.env.GEMINI_EXPLANATION_MODEL || 'gemini-2.5-flash';
export const EMBEDDING_MODEL = 'text-embedding-004';

/**
 * FR-4: Whole-document stuffed streaming generation
 */
export async function* streamAnswerGeneration(
  question: string,
  documentText: string
): AsyncGenerator<string, void, unknown> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured in .env. Please add your key from https://aistudio.google.com/');
  }

  const systemInstruction = `You are a factual, concise enterprise assistant. Answer the user's question accurately using ONLY the provided document context.
Do not fabricate information. If an answer cannot be deduced from the document, state that clearly.
Make direct, specific factual statements with exact numbers, dates, and names from the source text.`;

  const prompt = `DOCUMENT CONTEXT:
---
${documentText}
---

USER QUESTION: ${question}

Provide a comprehensive, factual answer based on the document above.`;

  const stream = await client.models.generateContentStream({
    model: GENERATION_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.2,
    }
  });

  for await (const chunk of stream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export interface VerdictResult {
  status: VerificationStatus;
  reasoning: string;
}

const UPWARD_DIRECTION_REGEX = /\b(increased?|rose|risen|grow(n|ing)?|grew|growth|higher|up|expanded?|gain(ed)?|surplus|soared|accelerated?)\b/i;
const DOWNWARD_DIRECTION_REGEX = /\b(decreased?|fell|fall(en|ing)?|shrank|declined?|decline|lower|down|contracted?|loss(es)?|lost|deficit|compressed?|plunged|slowed)\b/i;

/**
 * Defensive check for directional contradiction between sentence and passage
 */
function hasDirectionFlip(sentence: string, passageText: string): boolean {
  const sUp = UPWARD_DIRECTION_REGEX.test(sentence);
  const sDown = DOWNWARD_DIRECTION_REGEX.test(sentence);
  const pUp = UPWARD_DIRECTION_REGEX.test(passageText);
  const pDown = DOWNWARD_DIRECTION_REGEX.test(passageText);

  if (sUp && pDown && !pUp) return true;
  if (sDown && pUp && !pDown) return true;
  return false;
}

/**
 * Defensive check for conflicting numbers, dollar amounts, or percentages on shared metrics
 */
function hasNumericConflict(sentence: string, passageText: string): boolean {
  const sentPercents: string[] = (sentence.match(/\b\d+(\.\d+)?%/g) || []).map(p => p.toLowerCase());
  const passPercents: string[] = (passageText.match(/\b\d+(\.\d+)?%/g) || []).map(p => p.toLowerCase());

  if (sentPercents.length > 0 && passPercents.length > 0) {
    const hasMatch = sentPercents.some(p => passPercents.includes(p));
    if (!hasMatch) {
      return true;
    }
  }

  const currencyPattern = /\$\s*(\d+(\.\d+)?)\s*(million|billion|thousand|m|b|k)?/gi;
  const sentCurrencies = Array.from(sentence.matchAll(currencyPattern)).map(m => m[0].replace(/\s+/g, '').toLowerCase());
  const passCurrencies = Array.from(passageText.matchAll(currencyPattern)).map(m => m[0].replace(/\s+/g, '').toLowerCase());

  if (sentCurrencies.length > 0 && passCurrencies.length > 0) {
    const hasMatch = sentCurrencies.some(c => passCurrencies.includes(c));
    if (!hasMatch) {
      return true;
    }
  }

  return false;
}

/**
 * FR-8: Verdict Classification (The Similarity-Is-Not-Truth Safeguard)
 * Evaluates candidate passages vs. the generated sentence.
 * Must strictly check numbers, dates, directions (increased/decreased, rose/fell), and negations.
 * Invariant 1: Similarity is not truth.
 * Invariant 3: Failure NEVER defaults to GREEN (always AMBER).
 */
export async function classifySentenceVerdict(
  sentence: string,
  passages: CandidatePassage[]
): Promise<VerdictResult> {
  if (!passages || passages.length === 0) {
    return {
      status: 'AMBER',
      reasoning: 'No relevant source passage found.'
    };
  }

  // Pre-check for direction or numeric flip against candidate passages
  for (const p of passages) {
    if (hasDirectionFlip(sentence, p.text)) {
      return {
        status: 'RED',
        reasoning: 'Direction word contradiction detected against source passage.'
      };
    }
    if (hasNumericConflict(sentence, p.text)) {
      return {
        status: 'RED',
        reasoning: 'Numerical discrepancy detected against source passage metrics.'
      };
    }
  }

  const client = getGeminiClient();
  if (!client) {
    // Offline / unconfigured key fallback:
    // Invariant 1 & 3: Never default to GREEN if numbers exist and are unverified!
    const bestPassage = passages[0];
    const sNumbers: string[] = sentence.match(/\b\d+(\.\d+)?%?\b/g) || [];
    const pNumbers: string[] = bestPassage.text.match(/\b\d+(\.\d+)?%?\b/g) || [];

    if (sNumbers.length > 0) {
      const allNumbersMatch = sNumbers.every(n => pNumbers.includes(n));
      if (allNumbersMatch) {
        return {
          status: 'GREEN',
          reasoning: 'Numbers and directional claims corroborated by source passage.'
        };
      } else {
        return {
          status: 'AMBER',
          reasoning: 'Claim contains figures not directly affirmed in source passage.'
        };
      }
    }

    const sWords = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const pText = bestPassage.text.toLowerCase();
    const matchCount = sWords.filter(w => pText.includes(w)).length;
    const ratio = sWords.length > 0 ? matchCount / sWords.length : 0;

    if (ratio >= 0.8) {
      return {
        status: 'GREEN',
        reasoning: 'Source passage substantiates claim.'
      };
    }

    return {
      status: 'AMBER',
      reasoning: 'Gemini client offline; insufficient evidence in retrieved passage.'
    };
  }

  const passagesContext = passages
    .map((p, idx) => `[Passage ${idx + 1} - Page ${p.pageNumber}]: ${p.text}`)
    .join('\n\n');

  const prompt = `You are an exacting fact-checking engine. Compare the GENERATED SENTENCE against the RETRIEVED SOURCE PASSAGES.

CRITICAL INSTRUCTIONS:
1. "Similarity is not truth": A sentence may share many words with a passage but contradict it by reversing a direction, number, date, or entity.
2. Specifically check:
   - NUMBERS and AMOUNTS (e.g. 10% vs 8%, $45M vs $30M). Any discrepancy in quantities makes it CONTRADICTED.
   - DIRECTION WORDS (increased vs decreased, rose vs fell, positive vs negative, gained vs lost).
   - DATES and ENTITIES (e.g. Q3 vs Q2, 2024 vs 2023, Company A vs Company B).
   - NEGATIONS (is vs is not, did vs did not).
3. Classify as:
   - "SUPPORTED": The source passages explicitly affirm every factual claim in the sentence.
   - "CONTRADICTED": The sentence directly contradicts facts, numbers, directions, or claims in the source passages.
   - "UNVERIFIABLE": The passages are topically related or silent, but do not contain enough evidence to confirm or refute the sentence.

RETRIEVED SOURCE PASSAGES:
${passagesContext}

GENERATED SENTENCE TO CHECK:
"${sentence}"

Return your evaluation as a valid JSON object with the exact keys:
{
  "verdict": "SUPPORTED" | "CONTRADICTED" | "UNVERIFIABLE",
  "reasoning": "one concise sentence explaining why"
}`;

  try {
    const response = await client.models.generateContent({
      model: VERDICT_MODEL,
      contents: prompt,
      config: {
        temperature: 0.0,
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text || '';
    const parsed = JSON.parse(rawText.trim());

    const rawVerdict = String(parsed.verdict || '').toUpperCase();
    let status: VerificationStatus = 'AMBER';

    if (rawVerdict === 'SUPPORTED') {
      status = 'GREEN';
    } else if (rawVerdict === 'CONTRADICTED') {
      status = 'RED';
    } else {
      status = 'AMBER';
    }

    return {
      status,
      reasoning: parsed.reasoning || ''
    };
  } catch (err: unknown) {
    console.error('Error in classifySentenceVerdict, falling back to AMBER:', err);
    return {
      status: 'AMBER',
      reasoning: 'Verdict evaluation encountered an error; defaulted to unverifiable.'
    };
  }
}

/**
 * FR-10: Slow Path Mismatch Explanation (Non-blocking)
 * Fires only for RED or AMBER sentences to give a single-line explanation.
 */
export async function generateMismatchExplanation(
  sentence: string,
  matchedPassageText: string,
  status: 'RED' | 'AMBER'
): Promise<string> {
  const client = getGeminiClient();
  if (!client) {
    return status === 'RED'
      ? 'Contradiction detected between claim and source text.'
      : 'Source passage does not fully substantiate claim.';
  }

  const prompt = `The generated sentence was flagged as ${status === 'RED' ? 'CONTRADICTING' : 'NOT CLEARLY SUPPORTED BY'} the source passage.

SOURCE PASSAGE:
"${matchedPassageText}"

GENERATED SENTENCE:
"${sentence}"

Write EXACTLY ONE concise, clear sentence contrasting what the source actually says versus what the generated sentence claims.
Example: "Source states costs rose 8% due to hiring; this sentence claims a 30% decrease."
Do not write commentary or preface. Output only the single sentence.`;

  try {
    const response = await client.models.generateContent({
      model: EXPLANATION_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
      }
    });

    return (response.text || '').trim();
  } catch (err) {
    console.error('Error generating explanation:', err);
    return status === 'RED'
      ? 'Contradiction identified between claim and source text.'
      : 'No direct supporting evidence found in document.';
  }
}

/**
 * FR-12: Generate embeddings for baseline cosine similarity comparison
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const client = getGeminiClient();
  if (!client) {
    return generateFallbackEmbedding(text);
  }

  try {
    const response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text
    });

    const resObj = response as { embedding?: { values?: number[] }; embeddings?: Array<{ values?: number[] }> };
    const values = resObj?.embedding?.values || resObj?.embeddings?.[0]?.values;
    if (values && values.length > 0) {
      return values;
    }
    return generateFallbackEmbedding(text);
  } catch (err) {
    console.warn('Embedding API call failed, using fallback embedding:', err);
    return generateFallbackEmbedding(text);
  }
}

function generateFallbackEmbedding(text: string, dim = 256): number[] {
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}