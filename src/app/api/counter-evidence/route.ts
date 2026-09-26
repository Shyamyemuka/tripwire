import { NextRequest, NextResponse } from 'next/server';
import { queryMossRetrieval, getSessionChunks, registerSessionChunks } from '@/lib/moss';
import { CandidatePassage, ChunkRecord } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, sentenceText, chunks: clientChunks, topK = 3 } = await req.json();

    if (!sessionId || !sentenceText || typeof sentenceText !== 'string' || !sentenceText.trim()) {
      return NextResponse.json(
        { error: 'Session ID and a valid sentenceText string are required.' },
        { status: 400 }
      );
    }

    // Rehydrate session chunks if provided by client
    if (clientChunks && Array.isArray(clientChunks) && clientChunks.length > 0 && getSessionChunks(sessionId).length === 0) {
      registerSessionChunks(sessionId, clientChunks as ChunkRecord[]);
    }

    // Validate and clamp topK
    const validTopK = typeof topK === 'number' && Number.isFinite(topK)
      ? Math.min(Math.max(1, Math.floor(topK)), 10)
      : 3;

    // Extract core topic terms from sentenceText
    const coreTopic = sentenceText.replace(/[^\w\s]/gi, '').slice(0, 100);

    // Generate contrast & caveat probes
    const probe1 = `${coreTopic} exceptions limitations risks caveats non-compliance however unless`;
    const probe2 = `${coreTopic} restrictions conflicting policies prohibitions excluded`;

    const t0 = performance.now();

    // Query Moss in parallel with contrasting semantic probes
    const [res1, res2] = await Promise.all([
      queryMossRetrieval(sessionId, probe1, validTopK),
      queryMossRetrieval(sessionId, probe2, validTopK),
    ]);

    const t1 = performance.now();
    const elapsed = Number((t1 - t0).toFixed(2));

    // Deduplicate candidate passages by chunkId
    const seenIds = new Set<string>();
    const candidates: CandidatePassage[] = [];

    const combined = [...res1.candidates, ...res2.candidates];
    for (const cand of combined) {
      if (cand.chunkId && !seenIds.has(cand.chunkId)) {
        seenIds.add(cand.chunkId);
        candidates.push(cand);
      }
    }

    return NextResponse.json({
      success: true,
      counterCandidates: candidates.slice(0, 4),
      timeTakenInMs: elapsed,
    });
  } catch (err: unknown) {
    console.error('Counter-evidence scan error:', err);
    const message = err instanceof Error ? err.message : 'Counter-evidence scan failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
