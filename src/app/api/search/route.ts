import { NextRequest, NextResponse } from 'next/server';
import { queryMossRetrieval } from '@/lib/moss';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, query, topK = 5 } = await req.json();

    if (!sessionId || !query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Session ID and a valid query string are required.' },
        { status: 400 }
      );
    }

    const t0 = performance.now();
    const result = await queryMossRetrieval(sessionId, query, topK);
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
