import { NextRequest, NextResponse } from 'next/server';
import { isTrivialClaim } from '@/lib/trivial-filter';
import { queryMossRetrieval, getSessionChunks } from '@/lib/moss';
import { queryBaselineCosine } from '@/lib/baseline';
import { classifySentenceVerdict } from '@/lib/gemini';
import { CandidatePassage, ChunkRecord } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { sentence, sessionId, mode = 'moss', chunks: clientChunks } = await req.json();

    if (!sentence || !sentence.trim()) {
      return NextResponse.json({ error: 'Sentence cannot be empty.' }, { status: 400 });
    }

    // 1. Trivial-claim filtering (FR-6) -> GREY
    if (isTrivialClaim(sentence)) {
      return NextResponse.json({
        status: 'GREY',
        matchedChunkId: null,
        matchedChunkText: null,
        topCandidates: [],
        similarityScore: null,
        retrievalLatencyMs: 0,
        verdictLatencyMs: 0,
        reasoning: 'Non-factual statement / opinion / transition phrase.'
      });
    }

    let candidates: CandidatePassage[] = [];
    let retrievalLatencyMs = 0;

    // 2. Retrieval Step (FR-7 Moss vs FR-12 Baseline)
    if (mode === 'baseline') {
      const chunks: ChunkRecord[] = clientChunks || getSessionChunks(sessionId);
      const baselineResult = await queryBaselineCosine(sentence, chunks, 3);
      candidates = baselineResult.candidates;
      retrievalLatencyMs = baselineResult.timeTakenInMs;
    } else {
      const mossResult = await queryMossRetrieval(sessionId, sentence, 3);
      candidates = mossResult.candidates;
      retrievalLatencyMs = mossResult.timeTakenInMs;
    }

    // Check similarity floor (fallback to AMBER if no relevant candidates)
    const bestScore = candidates.length > 0 ? (candidates[0].similarityScore || 0) : 0;
    if (candidates.length === 0 || (bestScore === 0 && !clientChunks)) {
      return NextResponse.json({
        status: 'AMBER',
        matchedChunkId: null,
        matchedChunkText: null,
        topCandidates: [],
        similarityScore: null,
        retrievalLatencyMs,
        verdictLatencyMs: 0,
        reasoning: 'No related source passage found in document.'
      });
    }

    // 3. Verdict Classification (FR-8: Similarity is Not Truth)
    const tVerdictStart = performance.now();
    const verdictResult = await classifySentenceVerdict(sentence, candidates);
    const tVerdictEnd = performance.now();
    const verdictLatencyMs = Math.max(1, Number((tVerdictEnd - tVerdictStart).toFixed(2)));

    const bestCandidate = candidates[0];

    return NextResponse.json({
      status: verdictResult.status,
      matchedChunkId: bestCandidate ? bestCandidate.chunkId : null,
      matchedChunkText: bestCandidate ? bestCandidate.text : null,
      topCandidates: candidates,
      similarityScore: bestCandidate ? bestCandidate.similarityScore : null,
      retrievalLatencyMs,
      verdictLatencyMs,
      reasoning: verdictResult.reasoning
    });
  } catch (err: unknown) {
    console.error('Sentence verification error:', err);
    // Invariant 3: Failure NEVER defaults to GREEN.
    return NextResponse.json({
      status: 'AMBER',
      matchedChunkId: null,
      matchedChunkText: null,
      topCandidates: [],
      similarityScore: null,
      retrievalLatencyMs: 0,
      verdictLatencyMs: 0,
      reasoning: 'Verification pipeline encountered an error; defaulted to unverifiable.'
    });
  }
}
