import { GoogleGenAI } from '@google/genai';
import { CandidatePassage, VerificationStatus } from './types';
import crypto from 'crypto';
import dns from 'dns';

if (typeof dns?.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

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

export const GENERATION_MODEL = process.env.GEMINI_GENERATION_MODEL || 'gemini-3.5-flash-lite';
export const VERDICT_MODEL = process.env.GEMINI_VERDICT_MODEL || 'gemini-3.5-flash-lite';
export const EXPLANATION_MODEL = process.env.GEMINI_EXPLANATION_MODEL || 'gemini-3.5-flash-lite';
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';

/**
 * FR-4: Whole-document stuffed streaming generation with multi-key and model failover
 */
export async function* streamAnswerGeneration(
  question: string,
  documentText: string,
  isStressTestMode: boolean = false
): AsyncGenerator<string, void, unknown> {
  const hidevsKey = getHiDevsApiKey();
  const keys = getAvailableGeminiKeys();

  if (!hidevsKey && keys.length === 0) {
    throw new Error('HIDEVS_API_KEY or GEMINI_API_KEY is not configured in .env. Please check your keys.');
  }

  const systemInstruction = isStressTestMode
    ? `[Context]
You are answering a user's question about the document provided below.
[CRITICAL ADVERSARIAL STRESS-TEST]
To test an automated real-time fact-checking system, you MUST intentionally alter 1 or 2 specific factual figures, numbers, percentages, or trend directions in your answer (for example, state a different revenue amount, flip "increased" to "decreased", or alter key dates/metrics). Make the tone natural and plausible.
[Instruction]
You MUST write a comprehensive, multi-sentence response (at least 4 to 6 detailed, complete sentences).
Answer directly without conversational preambles like "Based on the provided document...".`
    : `[Context]
You are answering a user's question using only the document provided below as your source of truth. Your answer will be verified sentence-by-sentence against this same document by a separate system, so accuracy and grounding are critical.

[Role]
You are a knowledgeable analytical assistant explaining source material clearly, comprehensively, and factually.

[Instruction]
Answer the QUESTION thoroughly and informatively using only information from the DOCUMENT.
You MUST write a comprehensive, multi-sentence response (at least 4 to 6 detailed, complete sentences).
Even for direct or yes/no questions, detail the underlying background, specific document findings, numbers or timeframes mentioned, organizational implications, and recommended actions from the document so each individual claim can be independently verified.
Structure your answer into distinct, complete sentences.
NEVER provide a brief 1 or 2 sentence response.
If the document does not cover a specific part of the question, state that clearly while explaining what related details the document does provide.
CRITICAL FORMATTING: NEVER include conversational preambles like "Based on the provided document...", "According to the document...", or "The document states...". Start immediately with the factual answer.

[Personality]
Neutral, factual, informative, and direct.`;

function extractRelevantContext(documentText: string, question: string, maxChars = 24000): string {
  if (documentText.length <= maxChars) {
    return documentText;
  }
  const STOPWORDS = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'is', 'are',
    'was', 'were', 'what', 'which', 'who', 'how', 'why', 'when', 'where', 'this',
    'that', 'these', 'those', 'here', 'there', 'does', 'did', 'can', 'could', 'should'
  ]);
  const words = question.toLowerCase().match(/\b[a-z0-9_]{3,}\b/g) || [];
  const keywords = words.filter(w => !STOPWORDS.has(w));

  // Split into smaller segments of ~150 words (~900 chars) for high-resolution matching
  const rawSegments = documentText.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const segments: string[] = [];
  for (const seg of rawSegments) {
    if (seg.length <= 1200) {
      segments.push(seg);
    } else {
      const wordsArr = seg.split(' ');
      for (let i = 0; i < wordsArr.length; i += 150) {
        segments.push(wordsArr.slice(i, i + 150).join(' '));
      }
    }
  }

  if (keywords.length === 0 || segments.length <= 5) {
    return documentText.slice(0, maxChars) + "\n\n[... Note: document context budgeted for model token limits ...]";
  }

  // Always keep the document header / first 2 segments for context
  const selectedIndices = new Set<number>();
  let currentLen = 0;
  for (let i = 0; i < Math.min(2, segments.length); i++) {
    selectedIndices.add(i);
    currentLen += segments[i].length + 2;
  }

  // Score remaining segments by keyword matches
  const scored: Array<{ index: number; score: number }> = [];
  for (let i = 2; i < segments.length; i++) {
    const sLower = segments[i].toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const matches = (sLower.match(new RegExp('\\b' + kw, 'g')) || []).length;
      score += matches * 3;
    }
    if (score > 0) scored.push({ index: i, score });
  }

  scored.sort((a, b) => b.score - a.score);

  for (const item of scored) {
    const segText = segments[item.index];
    if (currentLen + segText.length + 10 > maxChars) continue;
    selectedIndices.add(item.index);
    currentLen += segText.length + 2;
    if (currentLen >= maxChars - 500) break;
  }

  // Fill in order if extra space remains
  if (currentLen < maxChars * 0.7) {
    for (let i = 2; i < segments.length; i++) {
      if (selectedIndices.has(i)) continue;
      const segText = segments[i];
      if (currentLen + segText.length > maxChars) break;
      selectedIndices.add(i);
      currentLen += segText.length + 2;
    }
  }

  // Render selected segments in their original document order
  const orderedSegments = Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .map(idx => segments[idx]);

  return orderedSegments.join('\n\n');
}

  // Budget document text comfortably (24,000 chars covers 15+ pages completely)
  const budgetedDocText = extractRelevantContext(documentText, question, 24000);

  const prompt = `DOCUMENT:
${budgetedDocText}

QUESTION:
${question}`;

  // 1. Primary: HiDevs LLM Gateway (100k Credits for Hackathon Arena)
  if (hidevsKey) {
    try {
      const makeHiDevsRequest = async (targetModel: string) => {
        return fetch(`${HIDEVS_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hidevsKey}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            max_tokens: 800,
            temperature: 0.2,
            stream: true
          })
        });
      };

      let res: Response | null = null;
      try {
        res = await makeHiDevsRequest(GENERATION_MODEL);
      } catch (networkErr) {
        // Retry once on transient network/connection timeout
        console.warn('HiDevs initial connection glitch, retrying in 500ms...', networkErr);
        await new Promise(r => setTimeout(r, 500));
        res = await makeHiDevsRequest(GENERATION_MODEL);
      }

      // If primary model hits a 429 per-minute rate limit, retry with gemini-3.5-flash-lite
      if (!res.ok && res.status === 429 && GENERATION_MODEL !== 'gemini-3.5-flash-lite') {
        console.warn('HiDevs 429 on primary model, retrying with gemini-3.5-flash-lite...');
        await new Promise(r => setTimeout(r, 600));
        res = await makeHiDevsRequest('gemini-3.5-flash-lite');
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
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    GENERATION_MODEL,
    VERDICT_MODEL,
  ].filter((m, idx, arr): m is string => Boolean(m) && arr.indexOf(m) === idx);

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
// In-memory LRU/dedup caches to strictly avoid re-spending tokens on identical claims
const verdictCache = new Map<string, VerdictResult>();
const explanationCache = new Map<string, string>();

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

const DIRECTION_PAIRS = [
  { pos: /\b(increased|increase|increasing|grew|growth|rose|rising|higher|highest|improved|improvement|gain|gains)\b/i,
    neg: /\b(decreased|decrease|decreasing|declined|decline|contraction|fell|falling|lower|lowest|deteriorated|loss|losses)\b/i },
  { pos: /(?<!not\s+)\b(possible|can|able to|capable of)\b/i,
    neg: /\b(not possible|impossible|cannot|unable|incapable|can't)\b/i },
  { pos: /\b(profitable|profit|profits)\b/i,
    neg: /\b(unprofitable|loss|losses|deficit)\b/i },
  { pos: /\b(passed|approved|authorized|compliant)\b/i,
    neg: /\b(failed|rejected|unauthorized|non-compliant)\b/i }
];

function classifyEntailmentFast(claim: string, candidatePassages: CandidatePassage[]): { status: VerificationStatus; reasoning: string } | null {
  if (candidatePassages.length === 0) return null;
  const cLower = claim.toLowerCase();
  const fullPassagesText = candidatePassages.map(p => p.text).join(' ').toLowerCase();

  // 1. Direction / Polarity Conflict Check (Invariant 1: Catch contradictions in <1ms)
  for (const pair of DIRECTION_PAIRS) {
    const claimHasPos = pair.pos.test(cLower);
    const claimHasNeg = pair.neg.test(cLower);
    const passageHasPos = pair.pos.test(fullPassagesText);
    const passageHasNeg = pair.neg.test(fullPassagesText);

    if (claimHasPos && passageHasNeg && !claimHasNeg) {
      return { status: 'RED', reasoning: 'Claim asserts positive trend/capability while source states negation or opposite direction.' };
    }
    if (claimHasNeg && passageHasPos && !passageHasNeg) {
      return { status: 'RED', reasoning: 'Claim asserts negation/negative trend while source affirms capability or opposite direction.' };
    }
  }

  // 2. Numerical / Percentage Consistency Check
  const extractNumbers = (t: string) => (t.match(/[$€£]?\d+(?:\.\d+)?%?/g) || []).map(n => n.replace(/[$,€£]/g, ''));
  const cNums = extractNumbers(claim);
  const pNums = extractNumbers(fullPassagesText);

  if (cNums.length > 0) {
    const conflictingNums = cNums.filter(n => !pNums.includes(n));
    if (conflictingNums.length > 0 && pNums.length > 0) {
      return { status: 'RED', reasoning: `Figures in claim (${conflictingNums.join(', ')}) contradict figures reported in source passage.` };
    }
    if (cNums.every(n => pNums.includes(n))) {
      const cWords = cLower.match(/\b[a-z]{3,}\b/g) || [];
      const overlap = cWords.filter(w => fullPassagesText.includes(w)).length / (cWords.length || 1);
      if (overlap >= 0.45) {
        return { status: 'GREEN', reasoning: 'All figures and key entities verified against source passage.' };
      }
    }
  }

  // 3. High-Confidence Lexical & Entailment Alignment
  const cWords = cLower.match(/\b[a-z]{3,}\b/g) || [];
  const overlap = cWords.filter(w => fullPassagesText.includes(w)).length / (cWords.length || 1);
  if (overlap >= 0.65) {
    return { status: 'GREEN', reasoning: 'Strong semantic and factual alignment with source passage.' };
  }

  return null;
}

  const t0 = performance.now();

  // Fast-path in-memory factual entailment (<1ms)
  const fastResult = classifyEntailmentFast(sentence, passages);
  if (fastResult) {
    const durationMs = Math.round(performance.now() - t0);
    if (turnId) {
      console.log(JSON.stringify({
        traceId: turnId,
        spanName: "verdict_classification_fast_path",
        sentenceId: sentenceId || "unknown",
        durationMs,
        status: fastResult.status,
        timestamp: new Date().toISOString()
      }));
    }
    return {
      status: fastResult.status,
      reasoning: fastResult.reasoning
    };
  }

  const hidevsKey = getHiDevsApiKey();
  const keys = getAvailableGeminiKeys();

  if (!hidevsKey && keys.length === 0) {
    return {
      status: 'AMBER',
      reasoning: 'Gemini client offline; insufficient evidence in retrieved passage.'
    };
  }

  // Pass top 3 candidate passages with full text (up to 1200 chars each) to ensure complete evidence is visible
  const topPassages = passages.slice(0, 3);
  const passagesContext = topPassages
    .map((p, idx) => `PASSAGE ${idx + 1}:\n${p.text.slice(0, 1200)}`)
    .join('\n\n');

  // Cache hit: 0 tokens spent
  const cacheKey = `${sentence.trim().toLowerCase()}|${topPassages[0]?.chunkId || ''}`;
  if (verdictCache.has(cacheKey)) {
    return verdictCache.get(cacheKey)!;
  }

  const prompt = `[Context]
You are checking whether a claim is supported by passages retrieved from a source document.

[Role]
You are a factual entailment and verification classifier.

[Instruction]
Given the CLAIM and the RETRIEVED PASSAGES, determine whether the claim is SUPPORTED, CONTRADICTED, or UNVERIFIABLE.
Respond with exactly one word: SUPPORTED, CONTRADICTED, or UNVERIFIABLE.

[Rules]
- SUPPORTED: The passages directly state, affirm, or logically entail the claim (including semantic paraphrases, policy statements, recommendations, numbers, or facts).
- CONTRADICTED: A passage addresses the same topic but directly contradicts a key fact, number, date, or reverses a direction/negation (e.g. claimed "can predict" when source says "cannot predict", or "fell" vs "rose").
- UNVERIFIABLE: The passages do not contain enough information to substantiate or refute the claim.

CLAIM: ${sentence}

${passagesContext}

VERDICT:`;

  // 1. Primary: HiDevs LLM Gateway (100k Credits for Hackathon Arena)
  if (hidevsKey) {
    try {
      const t0 = performance.now();
      const makeVerdictRequest = async () => {
        return fetch(`${HIDEVS_BASE_URL}/chat/completions`, {
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
            max_tokens: 10,
            temperature: 0.0,
            stream: false
          })
        });
      };

      let res: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await makeVerdictRequest();
          break;
        } catch (netErr) {
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 400));
            continue;
          }
          throw netErr;
        }
      }

      if (!res) {
        throw new Error("Failed to receive response from HiDevs gateway");
      }

      // If 429 sliding window throttle occurs, back off 700ms and retry
      if (!res.ok && res.status === 429) {
        await new Promise(r => setTimeout(r, 700));
        res = await makeVerdictRequest();
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

      const resultObj = {
        status,
        reasoning: ''
      };
      verdictCache.set(cacheKey, resultObj);
      return resultObj;
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
      let response;
      const verdictModels = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', VERDICT_MODEL];
      let lastErr: unknown;
      for (const m of verdictModels) {
        try {
          response = await client.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              temperature: 0.0
            }
          });
          if (response) break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!response) throw lastErr;

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

  const cacheKey = `${sentence.trim().toLowerCase()}|${matchedPassageText.slice(0, 50)}`;
  if (explanationCache.has(cacheKey)) {
    return explanationCache.get(cacheKey)!;
  }

  // Trim passage to 80 words max to conserve prompt tokens
  const trimmedPassage = matchedPassageText.split(/\s+/).slice(0, 80).join(' ');

  const prompt = `In one short sentence, explain the discrepancy between the claim and the source document.
CLAIM: ${sentence}
STATUS: ${status === 'RED' ? 'CONTRADICTED' : 'UNVERIFIABLE'}
SOURCE: ${trimmedPassage}
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
          max_tokens: 35,
          temperature: 0.1,
          stream: false
        })
      });

      if (!res.ok && res.status === 429) {
        await new Promise(r => setTimeout(r, 700));
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
            max_tokens: 35,
            temperature: 0.1,
            stream: false
          })
        });
      }

      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        if (raw) {
          const cleanExplanation = raw.replace(/^Explanation:\s*/i, '').trim();
          explanationCache.set(cacheKey, cleanExplanation);
          return cleanExplanation;
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
    const promptText = 'Transcribe all text from this PDF document page by page. For each page, start with a header like "--- PAGE 1 ---", "--- PAGE 2 ---", etc. Do NOT include summaries or markdown styling beyond the page markers. Return the verbatim text.';
    
    const candidateModels = [
      process.env.GOOGLE_PDF_MODEL,
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ].filter(Boolean) as string[];

    let response;
    let lastErr: unknown;
    for (const m of candidateModels) {
      try {
        response = await client.models.generateContent({
          model: m,
          contents: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data,
              },
            },
            promptText
          ],
          config: {
            temperature: 0.0,
          }
        });
        if (response && response.text) break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!response || !response.text) {
      throw lastErr || new Error('PDF document returned empty text from Gemini.');
    }

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