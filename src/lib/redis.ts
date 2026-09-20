import { Redis } from '@upstash/redis';
import { DocumentMeta, QATurn, ChunkRecord } from './types';

// Initialize Redis client using environment variables.
// Upstash Redis SDK automatically picks up UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
let redis: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  console.warn("Could not initialize Upstash Redis. Make sure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.");
}

export interface RedisSessionState {
  documentMeta: DocumentMeta;
  qaTurns: QATurn[];
  // Note: chunk text is NOT stored here to save space and respect privacy.
  // We only store the chunk references if needed, but actually the full list of chunks
  // is passed via IndexedDB on client side, so we don't strictly even need chunk metadata here
  // unless we want it for session recovery. The prompt says:
  // "keep only chunkId/mossVectorId references in the session blob to keep it small."
  chunksMeta: Array<{ chunkId: string; mossVectorId?: string }>;
}

const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours

export async function createRedisSession(sessionId: string, documentMeta: DocumentMeta, chunks: ChunkRecord[]): Promise<void> {
  if (!redis) return;
  const state: RedisSessionState = {
    documentMeta,
    qaTurns: [],
    chunksMeta: chunks.map(c => ({ chunkId: c.chunkId, mossVectorId: c.mossVectorId }))
  };
  await redis.set(`session:${sessionId}`, JSON.stringify(state), { ex: SESSION_TTL_SECONDS });
}

export async function getRedisSession(sessionId: string): Promise<RedisSessionState | null> {
  if (!redis) return null;
  const data = await redis.get<string | RedisSessionState>(`session:${sessionId}`);
  if (!data) return null;

  if (typeof data === 'string') {
      try {
        return JSON.parse(data) as RedisSessionState;
      } catch {
        return null;
      }
  }
  return data as RedisSessionState;
}

export async function updateRedisSession(sessionId: string, state: RedisSessionState): Promise<void> {
  if (!redis) return;
  // Reset TTL on every update to keep the session alive while in use
  await redis.set(`session:${sessionId}`, JSON.stringify(state), { ex: SESSION_TTL_SECONDS });
}