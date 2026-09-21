import { GoogleGenAI } from '@google/genai';
import { CandidatePassage, VerificationStatus } from './types';
import crypto from 'crypto';

export const HIDEVS_BASE_URL = process.env.HIDEVS_BASE_URL || 'https://llm.hidevs.xyz/v1';

export function getHiDevsApiKey(): string | null {
  const key = process.env.HIDEVS_API_KEY;
  if (key && !key.startsWith('your_') && key.trim().length > 0) {
    return key.trim();
  }
  return null;
}

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
export const VERDICT_MODEL = process.env.GEMINI_VERDICT_MODEL || 'gemini-3.5-flash-lite';
export const EXPLANATION_MODEL = process.env.GEMINI_EXPLANATION_MODEL || 'gemini-3.5-flash-lite';
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';

/**
 * FR-4: Whole-document stuffed streaming generation with multi-key and model failover
 */
export async function* streamAnswerGeneration(
  question: string,
  documentText: string
): AsyncGenerator<string, void, unknown> {
  const hidevsKey = getHiDevsApiKey();
  const keys = getAvailableGeminiKeys();

  if (!hidevsKey && keys.length === 0) {
    throw new Error('HIDEVS_API_KEY or GEMINI_API_KEY is not configured in .env. Please check your keys.');
  }

  const systemInstruction = `[Context]
You are answering a user's question using only the document provided
below as your source of truth. Your answer will be verified sentence-by-
sentence against this same document by a separate system, so accuracy
matters more than completeness.

[Role]
You are a careful analyst summarizing or answering questions strictly
from the provided source material.

[Instruction]
Answer the QUESTION using only information in the DOCUMENT. Write in
clear, complete sentences. Do not add information the document doesn't
contain.

[Specifics]
- If the document doesn't address part of the question, say so explicitly
  rather than inferring or guessing.
- Prefer precise numbers, dates, and direction words exactly as stated in
  the document over paraphrased or rounded versions.

[Personality]
Neutral, factual, concise. No filler sentences like "This is an
interesting question" — every sentence should carry either an answer or
an explicit statement that the document doesn't cover something.`;

  // Budget document text so prompt stays safely within HiDevs' 4,000 token limit
  const maxDocChars = 9000; // ~2,250 tokens
  const budgetedDocText = documentText.length > maxDocChars
    ? documentText.slice(0, maxDocChars) + "\n\n[... Note: document text budgeted to fit token limit ...]"
    : documentText;

  const prompt = `DOCUMENT:
${budgetedDocText}

QUESTION:
${question}`;

  // 1. Primary: HiDevs LLM Gateway (100k Credits for Hackathon Arena)
  if (hidevsKey) {
    try {
      let res = await fetch(`${HIDEVS_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hidevsKey}`
        },
        body: JSON.stringify({
          model: GENERATION_MODEL,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          max_tokens: 600,
          temperature: 0.2,
          stream: true
        })
      });

      // If primary model hits a 429 per-minute rate limit, retry with gemini-3.5-flash-lite
      if (!res.ok && res.status === 429 && GENERATION_MODEL !== 'gemini-3.5-flash-lite') {
        console.warn('HiDevs 429 on primary model, retrying with gemini-3.5-flash-lite...');
        res = await fetch(`${HIDEVS_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hidevsKey}`
          },
          body: JSON.stringify({
            model: 'gemini-3.5-flash-lite',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.2,
            stream: true
          })
        });
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`HiDevs API error (${res.status}): ${errBody}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Could not open stream from HiDevs gateway');

      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '').trim();
          if (dataStr === '[DONE]') return;
          try {
            const parsed = JSON.parse(dataStr);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              yield token;
            }
          } catch {
            // ignore non-json ping/comment lines
          }
        }
      }
      return;
    } catch (hidevsErr) {
      console.warn('HiDevs stream failed, checking fallback:', hidevsErr);
      if (keys.length === 0) {
        const cleanMsg = parseFriendlyErrorMessage(hidevsErr);
        throw new Error(cleanMsg);
      }
    }
  }

  // 2. Direct Gemini Multi-Key Failover
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

/**
 * FR-8: Verdict Classification (The Similarity-Is-Not-Truth Safeguard)
 * Evaluates candidate passages vs. the generated sentence.
 * Invariant 1: Similarity is not truth.
 * Invariant 3: Failure NEVER defaults to GREEN (always AMBER).
 */
export async function classifySentenceVerdict(
  sentence: string,
  passages: CandidatePassage[],
  turnId?: string,
  sentenceId?: string
): Promise<VerdictResult> {
  if (!passages || passages.length === 0) {
    return {
      status: 'AMBER',
      reasoning: 'No relevant source passage found.'
    };
  }

  const hidevsKey = getHiDevsApiKey();
  const keys = getAvailableGeminiKeys();

  if (!hidevsKey && keys.length === 0) {
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
          reasoning: 'Numbers corroborated by source passage.'
        };
      } else {
        return {
          status: 'AMBER',
          reasoning: 'Claim contains figures not directly affirmed in source passage.'
        };
      }
    }

    const sWords = sentence.toLowerCase().match(/\b[a-z0-9_]{3,}\b/g) || [];
    const pText = bestPassage.text.toLowerCase();
    const matchCount = sWords.filter(w => pText.includes(w)).length;
    const ratio = sWords.length > 0 ? matchCount / sWords.length : 0;

    if (ratio >= 0.6) {
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
    .map((p, idx) => `PASSAGE ${idx + 1}: ${p.text}`)
    .join('\n');

  const prompt = `[Context]
You are checking a single sentence, generated by another AI answering a
question about a document, against passages retrieved from that same
document. Your judgment will be shown live to a person as a trust signal
about the AI's answer.

[Role]
You are a strict fact-verification classifier. You are not being asked
whether the sentence is well-written, relevant, or reasonable — only
whether the source passages support it, contradict it, or say nothing
either way.

[Instruction]
Given the SENTENCE and the three RETRIEVED PASSAGES below, respond with
exactly one word: SUPPORTED, CONTRADICTED, or UNVERIFIABLE. Do not explain
your answer. Do not respond with anything else.

[Specifics]
- SUPPORTED: at least one passage affirms the sentence's semantic meaning, core facts, description, entities, dates, or numbers. Accurate paraphrasing, summaries, or restatements of passage content are SUPPORTED.
- CONTRADICTED: a passage explicitly discusses the same topic, metric, or event, but provides an opposite fact, conflicting number, wrong date, or reversed direction (e.g. passage says "fell 5%" but sentence says "rose 20%"). CRITICAL: If the passage does not mention the topic or lacks details, you MUST classify it as UNVERIFIABLE, NEVER CONTRADICTED.
- UNVERIFIABLE: the passages do not contain enough information to evaluate the specific claim, or the claim is not discussed in the retrieved passages.

[Personality]
Objective, strict on numbers/directions, but supportive of accurate semantic paraphrasing.

[Experiment — few-shot examples]
Example 1
SENTENCE: "Operating costs decreased 30% from last year."
PASSAGE: "Operating costs rose 8% year-over-year due to increased hiring."
ANSWER: CONTRADICTED

Example 2
SENTENCE: "Revenue increased 10% to $45 million in Q3."
PASSAGE: "Q3 revenue grew 10% year-over-year to $45M."
ANSWER: SUPPORTED

Example 3
SENTENCE: "The company opened three new offices in Europe this year."
PASSAGE: "The company's headcount grew by 200 employees in Q3."
ANSWER: UNVERIFIABLE

Example 4
SENTENCE: "Customer churn dropped to 4% this quarter."
PASSAGE: "Churn increased slightly to 6.2% in Q3, up from 5.8% the prior quarter."
ANSWER: CONTRADICTED

Example 5
SENTENCE: "The product launched in 12 countries."
PASSAGE: "The product is now available in 12 markets across Europe and Asia."
ANSWER: SUPPORTED

Example 6
SENTENCE: "Top 10 finalist at Master AI Hackathon with Nexus AI (Bangalore)."
PASSAGE: "Master AI Hackathon (Bangalore) with Nexus AI - Top 10 Finalist."
ANSWER: SUPPORTED

---
SENTENCE: ${sentence}
${passagesContext}
ANSWER:`;

  // 1. Primary: HiDevs LLM Gateway (100k Credits for Hackathon Arena)
  if (hidevsKey) {
    try {
      const t0 = performance.now();
      let res = await fetch(`${HIDEVS_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hidevsKey}`
        },
        body: JSON.stringify({
          model: VERDICT_MODEL,
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 15,
          temperature: 0.0,
          stream: false
        })
      });

      if (!res.ok && res.status === 429 && VERDICT_MODEL !== 'gemini-3.5-flash-lite') {
        res = await fetch(`${HIDEVS_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hidevsKey}`
          },
          body: JSON.stringify({
            model: 'gemini-3.5-flash-lite',
            messages: [
              { role: 'user', content: prompt }
            ],
            max_tokens: 15,
            temperature: 0.0,
            stream: false
          })
        });
      }

      if (!res.ok) {
        throw new Error(`HiDevs API status ${res.status}`);
      }

      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || '';
      const rawVerdictValue = rawText.trim().toUpperCase();

      let status: VerificationStatus = 'AMBER';
      if (rawVerdictValue.includes('SUPPORTED') && !rawVerdictValue.includes('CONTRADICTED') && !rawVerdictValue.includes('UNVERIFIABLE')) {
        status = 'GREEN';
      } else if (rawVerdictValue.includes('CONTRADICTED')) {
        status = 'RED';
      } else {
        status = 'AMBER';
      }

      const durationMs = Math.round(performance.now() - t0);
      if (turnId) {
        console.log(JSON.stringify({
          traceId: turnId,
          spanName: "verdict_classification_hidevs",
          sentenceId: sentenceId || "unknown",
          durationMs,
          model: VERDICT_MODEL,
          timestamp: new Date().toISOString()
        }));
      }

      return {
        status,
        reasoning: ''
      };
    } catch (hidevsErr) {
      console.warn('HiDevs verdict call failed, checking fallback:', hidevsErr);
      if (keys.length === 0) {
        return {
          status: 'AMBER',
          reasoning: 'HiDevs API error; defaulted to unverifiable.'
        };
      }
    }
  }

  try {
    const t0 = performance.now();
    return await callGeminiWithFailover(async (client) => {
      const response = await client.models.generateContent({
        model: VERDICT_MODEL,
        contents: prompt,
        config: {
          temperature: 0.0
        }
      });

      const rawText = response.text || '';
      const rawVerdictValue = rawText.trim().toUpperCase();

      let status: VerificationStatus = 'AMBER';
      if (rawVerdictValue.includes('SUPPORTED') && !rawVerdictValue.includes('CONTRADICTED') && !rawVerdictValue.includes('UNVERIFIABLE')) {
        status = 'GREEN';
      } else if (rawVerdictValue.includes('CONTRADICTED')) {
        status = 'RED';
      } else {
        status = 'AMBER';
      }

      const durationMs = Math.round(performance.now() - t0);
      // Observability log (Minimal Viable Version)
      if (turnId) {
        const promptTemplate = prompt.split('SENTENCE: ')[0]; // Hash only the template part to avoid logging PII
        const promptHash = crypto.createHash('sha256').update(promptTemplate).digest('hex');
        const tokenEstimate = Math.round(prompt.length / 4); // Basic estimate, assuming ~4 chars per token
        console.log(JSON.stringify({
          traceId: turnId,
          spanName: "verdict_classification",
          sentenceId: sentenceId || "unknown",
          durationMs,
          tokensIn: tokenEstimate,
          tokensOut: Math.round(rawText.length / 4) || 1, // Verdict is short
          promptHash,
          timestamp: new Date().toISOString()
        }));
      }

      return {
        status,
        reasoning: ''
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
  status: 'RED' | 'AMBER',
  turnId?: string,
  sentenceId?: string
): Promise<string> {
  const hidevsKey = getHiDevsApiKey();
  const keys = getAvailableGeminiKeys();

  if (!hidevsKey && keys.length === 0) {
    return status === 'RED'
      ? 'Contradiction detected between claim and source text.'
      : 'Source passage does not fully substantiate claim.';
  }

  const prompt = `[Context]
A sentence in a generated answer has been flagged as CONTRADICTED or
UNVERIFIABLE against a source passage. A person is looking at this flag
and needs a one-line reason, not a full analysis.

[Role]
You are writing a single, plain-language explanation line shown directly
under a flagged sentence in a live UI.

[Instruction]
In one short sentence, state what the source passage actually says versus
what the flagged sentence claims. If UNVERIFIABLE, state that no passage
addresses this specific claim.

[Specifics]
Maximum one sentence. No preamble ("Looking at this, I can see..."). Lead
directly with the source's actual content.

[Personality]
Plain and direct, like a fact-checker's caption, not a chatbot.

SENTENCE: ${sentence}
VERDICT: ${status === 'RED' ? 'CONTRADICTED' : 'UNVERIFIABLE'}
MATCHED PASSAGE(S): ${matchedPassageText}

EXPLANATION:`;

  // 1. Primary: HiDevs LLM Gateway (100k Credits for Hackathon Arena)
  if (hidevsKey) {
    try {
      let res = await fetch(`${HIDEVS_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hidevsKey}`
        },
        body: JSON.stringify({
          model: EXPLANATION_MODEL,
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 80,
          temperature: 0.1,
          stream: false
        })
      });

      if (!res.ok && res.status === 429 && EXPLANATION_MODEL !== 'gemini-3.5-flash-lite') {
        res = await fetch(`${HIDEVS_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hidevsKey}`
          },
          body: JSON.stringify({
            model: 'gemini-3.5-flash-lite',
            messages: [
              { role: 'user', content: prompt }
            ],
            max_tokens: 80,
            temperature: 0.1,
            stream: false
          })
        });
      }

      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        if (raw) {
          return raw.replace(/^Explanation:\s*/i, '').trim();
        }
      }
    } catch (hidevsErr) {
      console.warn('HiDevs explanation failed, checking fallback:', hidevsErr);
    }
  }

  try {
    const t0 = performance.now();
    return await callGeminiWithFailover(async (client) => {
      const response = await client.models.generateContent({
        model: EXPLANATION_MODEL,
        contents: prompt,
        config: {
          temperature: 0.1,
        }
      });

      const text = (response.text || '').trim();
      const durationMs = Math.round(performance.now() - t0);

      // Observability log (Minimal Viable Version)
      if (turnId) {
        const promptTemplate = prompt.split('SENTENCE: ')[0]; // Hash only the template part to avoid logging PII
        const promptHash = crypto.createHash('sha256').update(promptTemplate).digest('hex');
        const tokenEstimate = Math.round(prompt.length / 4); // Basic estimate, assuming ~4 chars per token
        console.log(JSON.stringify({
          traceId: turnId,
          spanName: "generate_explanation",
          sentenceId: sentenceId || "unknown",
          durationMs,
          tokensIn: tokenEstimate,
          tokensOut: Math.round(text.length / 4),
          promptHash,
          timestamp: new Date().toISOString()
        }));
      }

      return text;
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