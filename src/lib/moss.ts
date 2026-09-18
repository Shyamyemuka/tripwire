import { MossClient } from '@moss-dev/moss';
import { CandidatePassage, ChunkRecord } from './types';

// In-memory registry to correlate chunk metadata by sessionId
const sessionChunkRegistry = new Map<string, Map<string, ChunkRecord>>();

function getMossClient(): MossClient | null {
  const projectId = process.env.MOSS_PROJECT_ID;
  const projectKey = process.env.MOSS_PROJECT_KEY;

  if (
    !projectId ||
    !projectKey ||
    projectId.startsWith('your_moss') ||
    projectKey.startsWith('your_moss')
  ) {
    return null;
  }

  try {
    return new MossClient(projectId, projectKey);
  } catch (err) {
    console.error('Failed to initialize MossClient:', err);
    return null;
  }
}

/**
 * FR-2: Index document chunks into Moss
 */
export async function indexDocumentInMoss(
  sessionId: string,
  chunks: ChunkRecord[]
): Promise<void> {
  // Store chunk metadata map for fast lookups
  const chunkMap = new Map<string, ChunkRecord>();
  chunks.forEach(c => chunkMap.set(c.chunkId, c));
  sessionChunkRegistry.set(sessionId, chunkMap);

  const client = getMossClient();
  if (!client) {
    console.warn(`Moss credentials not configured. Using local in-memory store for session: ${sessionId}`);
    return;
  }

  try {
    const mossDocs = chunks.map(c => ({
      id: c.chunkId,
      text: c.text
    }));

    // Prune older indexes if approaching the 3-index tier limit
    await pruneOldMossIndexes(client);

    // Create index in Moss (polls until complete)
    await client.createIndex(sessionId, mossDocs);
    // Load index into memory for sub-10ms local query speed
    try {
      await client.loadIndex(sessionId);
      console.log(`Successfully created and loaded Moss index for session ${sessionId}`);
    } catch (loadErr) {
      console.warn('Moss loadIndex failed (offline/unauthorized), queries will use cloud or local fallback:', loadErr instanceof Error ? loadErr.message : loadErr);
    }
  } catch (err) {
    console.error('Failed to index chunks into Moss:', err);
    // Even if Moss fails, sessionChunkRegistry is populated for fallback
  }
}

async function pruneOldMossIndexes(client: MossClient) {
  try {
    const list = await client.listIndexes();
    if (list && list.length >= 2) {
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      const toDelete = list.slice(0, list.length - 1);
      for (const idx of toDelete) {
        if (idx.name) {
          await client.deleteIndex(idx.name).catch(() => {});
        }
      }
    }
  } catch {
    // Silent catch on index cleanup
  }
}

let mossDegraded = false;
let mossLastFailure = 0;
const MOSS_RETRY_INTERVAL_MS = 60_000;

/**
 * FR-7: Fast Path - Moss Retrieval
 * Queries Moss for the top-3 candidate passages.
 * Invariant 4: No fabricated latency numbers. Latency is measured directly with performance.now().
 */
export async function queryMossRetrieval(
  sessionId: string,
  sentenceText: string,
  topK = 3
): Promise<{ candidates: CandidatePassage[]; timeTakenInMs: number }> {
  const chunkMap = sessionChunkRegistry.get(sessionId) || new Map<string, ChunkRecord>();
  const client = getMossClient();
  const shouldTryMoss = client && (!mossDegraded || Date.now() - mossLastFailure > MOSS_RETRY_INTERVAL_MS);

  // If real Moss is available:
  if (shouldTryMoss && client) {
    const t0 = performance.now();
    try {
      const results = await Promise.race([
        client.query(sessionId, sentenceText, { topK }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Moss query timed out')), 800)
        )
      ]);
      const t1 = performance.now();
      mossDegraded = false;
      const elapsed = Number((t1 - t0).toFixed(2));

      const candidates: CandidatePassage[] = (results.docs || []).map(doc => {
        const meta = chunkMap.get(doc.id);
        return {
          chunkId: doc.id,
          text: doc.text || meta?.text || '',
          pageNumber: meta?.pageNumber || 1,
          charOffsetStart: meta?.charOffsetStart || 0,
          charOffsetEnd: meta?.charOffsetEnd || 0,
          similarityScore: Number(Number(doc.score || 0).toFixed(4))
        };
      });

      return {
        candidates,
        timeTakenInMs: elapsed
      };
    } catch (err) {
      mossDegraded = true;
      mossLastFailure = Date.now();
      console.warn('Moss query unavailable or timed out, falling back to local scan:', err instanceof Error ? err.message : err);
    }
  }

  // Local fast fallback if Moss credentials not yet provided
  // Uses keyword overlap / BM25-style local token score with actual performance.now()
  const t0 = performance.now();
  const queryTokens = new Set(sentenceText.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const scored: Array<{ chunk: ChunkRecord; score: number }> = [];

  for (const chunk of chunkMap.values()) {
    const chunkTokens = chunk.text.toLowerCase().split(/\s+/);
    let overlap = 0;
    for (const t of chunkTokens) {
      if (queryTokens.has(t)) overlap++;
    }
    const score = queryTokens.size > 0 ? overlap / queryTokens.size : 0;
    scored.push({ chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, topK);
  const t1 = performance.now();
  const elapsed = Math.max(0.1, Number((t1 - t0).toFixed(2)));

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
    timeTakenInMs: elapsed
  };
}

export function getSessionChunks(sessionId: string): ChunkRecord[] {
  const map = sessionChunkRegistry.get(sessionId);
  if (!map) return [];
  return Array.from(map.values());
}
