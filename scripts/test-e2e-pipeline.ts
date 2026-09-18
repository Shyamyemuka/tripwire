import { chunkPlainText } from '../src/lib/chunker';
import { streamAnswerGeneration } from '../src/lib/gemini';
import { SentenceDetector } from '../src/lib/sentence-boundary';
import { queryMossRetrieval, indexDocumentInMoss } from '../src/lib/moss';
import { queryBaselineCosine } from '../src/lib/baseline';
import { isTrivialClaim } from '../src/lib/trivial-filter';
import { classifySentenceVerdict } from '../src/lib/gemini';
import { SAMPLE_DOCUMENT_TEXT } from '../src/lib/sample-doc';

async function runE2ETest() {
  console.log('--- Starting Tripwire End-to-End Pipeline Verification ---');

  // 1. Ingestion & Chunking
  const sessionId = 'test-e2e-' + Date.now();
  const { chunks, meta } = chunkPlainText(SAMPLE_DOCUMENT_TEXT, 'sample-financial.txt');
  console.log(`[1/5] Ingested document: ${meta.wordCount} words into ${chunks.length} chunks.`);

  // 2. Index in Moss / local registry
  await indexDocumentInMoss(sessionId, chunks);
  console.log('[2/5] Indexed document chunks in retrieval registry.');

  // 3. Generation Streaming
  const question = 'What was the Q3 consolidated net revenue and gross margin?';
  console.log(`[3/5] Streaming answer for: "${question}"`);

  const detector = new SentenceDetector();
  const collectedSentences: string[] = [];
  let tokenCount = 0;

  for await (const token of streamAnswerGeneration(question, SAMPLE_DOCUMENT_TEXT)) {
    tokenCount++;
    const sentences = detector.addToken(token);
    for (const s of sentences) {
      collectedSentences.push(s);
    }
  }
  const trailing = detector.flush();
  for (const s of trailing) {
    collectedSentences.push(s);
  }

  console.log(`Received ${tokenCount} tokens forming ${collectedSentences.length} sentences:`);
  collectedSentences.forEach((s, i) => console.log(`  [S${i + 1}] ${s}`));

  if (collectedSentences.length === 0) {
    throw new Error('FAILED: No sentences detected from stream!');
  }

  // 4. Verify Each Sentence (Retrieval + Filter + Verdict)
  console.log('[4/5] Verifying sentences with retrieval and verdict classifier...');
  for (let i = 0; i < collectedSentences.length; i++) {
    const s = collectedSentences[i];

    if (isTrivialClaim(s)) {
      console.log(`  Sentence ${i + 1}: [GREY] (Trivial/opinion filter)`);
      continue;
    }

    const mossRes = await queryMossRetrieval(sessionId, s, 3);
    const topMoss = mossRes.candidates[0];
    const baselineRes = await queryBaselineCosine(s, chunks, 3);

    console.log(`  Sentence ${i + 1}: retrieval moss=${mossRes.timeTakenInMs}ms, baseline=${baselineRes.timeTakenInMs}ms`);

    if (!topMoss || topMoss.similarityScore < 0.2) {
      console.log(`  Sentence ${i + 1}: [AMBER] (Unverifiable - no passage match)`);
      continue;
    }

    const verdict = await classifySentenceVerdict(s, mossRes.candidates);
    console.log(`  Sentence ${i + 1}: [${verdict.status}] ${verdict.reasoning}`);
  }

  console.log('[5/5] ALL PIPELINE STAGES PASSED SUCCESSFULLY!');
}

runE2ETest().catch((err) => {
  console.error('E2E Pipeline Test Error:', err);
  process.exit(1);
});
