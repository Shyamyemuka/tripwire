import { GoogleGenAI } from '@google/genai';
import { CandidatePassage, VerificationStatus } from './types';

function getAvailableGeminiKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY
  ].filter((k): k is string => !!k && !k.startsWith('your_google_gemini'));
  return Array.from(new Set(keys));
}

let activeKeyIndex = 0;

/**
 * Executes a Gemini API call with automatic multi-key failover.
 * If the active key hits an error (rate limit, quota exceeded, 429, timeout, etc.),
 * it switches to the next configured key and remembers it for subsequent calls.
 */
export function parseFriendlyErrorMessage(err: unknown): string {
  if (!err) return "An unexpected error occurred.";
  let raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      raw = parsed.error.message;
    }
  } catch {
    // raw is not JSON
  }

  if (raw.includes("503") || raw.includes("high demand") || raw.includes("UNAVAILABLE")) {
    return "The AI model is experiencing a temporary demand spike. Please try again in a moment.";
  }
  if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota")) {
    return "Rate limit reached. Please wait a few seconds and try again.";
  }
  return raw;
}

/**
 * Executes a Gemini API call with automatic multi-key failover and backoff for 503/429.
 * If the active key hits an error (rate limit, quota exceeded, 429, 503 timeout, etc.),
 * it switches to the next configured key and remembers it for subsequent calls.
 */
async function callGeminiWithFailover<T>(
  operation: (client: GoogleGenAI, keyIndex: number) => Promise<T>
): Promise<T> {
  const keys = getAvailableGeminiKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY_1 or GEMINI_API_KEY_2 is not configured in .env. Please check your keys.');
  }

  let lastError: unknown;
  // Try across keys, with up to 2 passes if encountering temporary 503 spikes
  const totalAttempts = Math.min(keys.length * 2, 4);

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const keyIdx = (activeKeyIndex + attempt) % keys.length;
    const client = new GoogleGenAI({ apiKey: keys[keyIdx] });

    try {
      const result = await operation(client, keyIdx);
      if (activeKeyIndex !== keyIdx) {
        console.log(`[Gemini Failover] Switched active key to #${keyIdx + 1}`);
        activeKeyIndex = keyIdx;
      }
      return result;
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini Failover] Key #${keyIdx + 1} attempt ${attempt + 1} failed: ${msg}. Trying next...`);
      if (attempt < totalAttempts - 1) {
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  throw lastError;
}

export const GENERATION_MODEL = process.env.GEMINI_GENERATION_MODEL || 'gemini-3.6-flash';
export const VERDICT_MODEL = process.env.GEMINI_VERDICT_MODEL || 'gemini-3.1-flash-lite';
export const EXPLANATION_MODEL = process.env.GEMINI_EXPLANATION_MODEL || 'gemini-3.1-flash-lite';
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';

/**
 * FR-4: Whole-document stuffed streaming generation with multi-key and model failover
 */
export async function* streamAnswerGeneration(
  question: string,
  documentText: string
): AsyncGenerator<string, void, unknown> {
  const keys = getAvailableGeminiKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY_1 or GEMINI_API_KEY_2 is not configured in .env. Please add your key from https://aistudio.google.com/');
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

  // Candidate models: primary generation model, fallback to verdict model if 503 high demand spike occurs
  const candidateModels = [
    GENERATION_MODEL,
    VERDICT_MODEL !== GENERATION_MODEL ? VERDICT_MODEL : null
  ].filter((m): m is string => Boolean(m));

  let activeIterator: AsyncIterator<{ text?: string }> | null = null;
  let firstChunkText: string | null = null;
  let lastError: unknown = null;

  modelLoop:
  for (const model of candidateModels) {
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const keyIdx = (activeKeyIndex + attempt) % keys.length;
      const client = new GoogleGenAI({ apiKey: keys[keyIdx] });
      try {
        const stream = await client.models.generateContentStream({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.2,
          }
        });

        // Test the stream by consuming the first chunk.
        // Google GenAI throws 503/429 during iterator.next(), not during generateContentStream().
        const iterator = stream[Symbol.asyncIterator]();
        const firstResult = await iterator.next();

        if (!firstResult.done && firstResult.value?.text) {
          firstChunkText = firstResult.value.text;
        }

        activeIterator = iterator;
        if (activeKeyIndex !== keyIdx) {
          console.log(`[Gemini Failover] Generation stream active on key #${keyIdx + 1} (${model})`);
          activeKeyIndex = keyIdx;
        }
        break modelLoop;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Gemini Failover] Stream start failed with ${model} on key #${keyIdx + 1}: ${msg}. Trying next option...`);
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  if (!activeIterator) {
    const cleanMsg = parseFriendlyErrorMessage(lastError);
    throw new Error(cleanMsg);
  }

  if (firstChunkText) {
    yield firstChunkText;
  }

  while (true) {
    const { done, value } = await activeIterator.next();
    if (done) break;
    if (value?.text) {
      yield value.text;
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

  // Pre-check for direction or numeric conflict
  const bestPassage = passages[0];
  if (hasDirectionFlip(sentence, bestPassage.text)) {
    return {
      status: 'RED',
      reasoning: 'Direction word contradiction detected against source passage.'
    };
  }

  // If the sentence mentions numbers/metrics and EVERY candidate passage has conflicting numbers:
  if (hasNumericConflict(sentence, bestPassage.text) && passages.every(p => hasNumericConflict(sentence, p.text))) {
    return {
      status: 'RED',
      reasoning: 'Numerical discrepancy detected against source passage metrics.'
    };
  }

  const keys = getAvailableGeminiKeys();
  if (keys.length === 0) {
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
    return await callGeminiWithFailover(async (client) => {
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
    });
  } catch (err: unknown) {
    console.error('Error in classifySentenceVerdict across all keys, falling back to AMBER:', err);
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
  const keys = getAvailableGeminiKeys();
  if (keys.length === 0) {
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
    return await callGeminiWithFailover(async (client) => {
      const response = await client.models.generateContent({
        model: EXPLANATION_MODEL,
        contents: prompt,
        config: {
          temperature: 0.1,
        }
      });

      return (response.text || '').trim();
    });
  } catch (err) {
    console.error('Error generating explanation across all keys:', err);
    return status === 'RED'
      ? 'Contradiction identified between claim and source text.'
      : 'No direct supporting evidence found in document.';
  }
}

/**
 * FR-12: Generate embeddings for baseline cosine similarity comparison
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const keys = getAvailableGeminiKeys();
  if (keys.length === 0) {
    return generateFallbackEmbedding(text);
  }

  try {
    return await callGeminiWithFailover(async (client) => {
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
    });
  } catch (err) {
    console.warn('Embedding API call failed on all keys, using fallback embedding:', err);
    return generateFallbackEmbedding(text);
  }
}


/**
 * Infallible PDF text extractor using Gemini Vision / Multimodal Document Processing.
 * Works seamlessly in serverless (Vercel) environments where local binary/worker PDF parsers may fail.
 */
export async function extractPdfTextWithGemini(
  buffer: Buffer
): Promise<Array<{ pageNumber: number; text: string }>> {
  const keys = getAvailableGeminiKeys();
  if (keys.length === 0) {
    throw new Error('No Gemini API key configured to parse PDF document.');
  }

  return await callGeminiWithFailover(async (client) => {
    const base64Data = buffer.toString('base64');
    const response = await client.models.generateContent({
      model: GENERATION_MODEL,
      contents: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
          },
        },
        'Transcribe all text from this PDF document page by page. For each page, start with a header like "--- PAGE 1 ---", "--- PAGE 2 ---", etc. Do NOT include summaries or markdown styling beyond the page markers. Return the verbatim text.'
      ],
      config: {
        temperature: 0.0,
      }
    });

    const text = response.text || '';
    if (!text.trim()) {
      throw new Error('PDF document returned empty text from Gemini.');
    }

    // Split text by page markers: "--- PAGE 1 ---" or similar
    const splitRegex = /---+\s*PAGE\s+(\d+)\s*---+/i;
    const parts = text.split(splitRegex);
    const pages: Array<{ pageNumber: number; text: string }> = [];

    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i += 2) {
        const pageNum = parseInt(parts[i], 10) || (Math.floor(i / 2) + 1);
        const pageContent = (parts[i + 1] || '').trim();
        if (pageContent) {
          pages.push({
            pageNumber: pageNum,
            text: pageContent,
          });
        }
      }
    }

    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        text: text.trim(),
      });
    }

    return pages;
  });
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