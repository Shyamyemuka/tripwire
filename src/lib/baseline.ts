import { CandidatePassage, ChunkRecord } from './types';
import { generateTextEmbedding } from './gemini';

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * FR-12: Real Brute-Force In-Memory Cosine Similarity Baseline
 * Measures actual compute time with performance.now() - no simulated delay, no setTimeout.
 */
export async function queryBaselineCosine(
  queryText: string,
  chunks: ChunkRecord[],
  topK = 3
): Promise<{ candidates: CandidatePassage[]; timeTakenInMs: number }> {
  // Generate embedding for query sentence
  const queryEmbedding = await generateTextEmbedding(queryText);

  const startTime = performance.now();

  const scoredChunks: Array<{ chunk: ChunkRecord; score: number }> = [];

  // Plain brute-force loop over every chunk vector
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkVec = chunk.embedding || [];
    const score = chunkVec.length > 0 ? cosineSimilarity(queryEmbedding, chunkVec) : 0;
    scoredChunks.push({ chunk, score });
  }

  // Sort descending by similarity score
  scoredChunks.sort((a, b) => b.score - a.score);

  const topMatches = scoredChunks.slice(0, topK);

  const endTime = performance.now();
  // Real measured latency in milliseconds
  const timeTakenInMs = Math.max(0.1, Number((endTime - startTime).toFixed(2)));

  const candidates: CandidatePassage[] = topMatches.map(m => ({
    chunkId: m.chunk.chunkId,
    text: m.chunk.text,
    pageNumber: m.chunk.pageNumber,
    charOffsetStart: m.chunk.charOffsetStart,
    charOffsetEnd: m.chunk.charOffsetEnd,
    similarityScore: Number(m.score.toFixed(4))
  }));

  return {
    candidates,
    timeTakenInMs
  };
}
