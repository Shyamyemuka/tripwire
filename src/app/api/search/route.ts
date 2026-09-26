import { NextRequest, NextResponse } from 'next/server';
import { queryMossRetrieval, getSessionChunks, registerSessionChunks } from '@/lib/moss';
import { ChunkRecord } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, query, topK = 5, chunks: clientChunks } = await req.json();

    if (!sessionId || !query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Session ID and a valid query string are required.' },
        { status: 400 }
      );
    }

    // Rehydrate session chunks if provided by client
    if (clientChunks && Array.isArray(clientChunks) && clientChunks.length > 0 && getSessionChunks(sessionId).length === 0) {
      registerSessionChunks(sessionId, clientChunks as ChunkRecord[]);
    }

    // Validate and clamp topK
    const validTopK = typeof topK === 'number' && Number.isFinite(topK)
      ? Math.min(Math.max(1, Math.floor(topK)), 20)
      : 5;

    const t0 = performance.now();
    const result = await queryMossRetrieval(sessionId, query, validTopK);
    const t1 = performance.now();

    // Use measured performance.now() latency (Invariant 4)
    const timeTakenInMs = Number((t1 - t0).toFixed(2));

    return NextResponse.json({
      success: true,
      candidates: result.candidates,
      timeTakenInMs: result.timeTakenInMs || timeTakenInMs
    });
  } catch (err: unknown) {
    console.error('Spotlight search API error:', err);
    const message = err instanceof Error ? err.message : 'Search failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
