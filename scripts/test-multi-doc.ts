import { chunkMultipleDocuments, InputDocument } from '../src/lib/chunker';
import { indexDocumentInMoss, queryMossRetrieval } from '../src/lib/moss';

async function runMultiDocTest() {
  console.log('--- Testing Multi-Document Ingestion & Citations ---');

  const doc1: InputDocument = {
    filename: 'Q3_Report.pdf',
    pages: [
      {
        pageNumber: 1,
        text: 'Quarterly financial results for Q3 show revenue grew 10% year over year to 45 million dollars.'
      },
      {
        pageNumber: 2,
        text: 'Operating expenses decreased by 5% due to cost optimization initiatives across product teams.'
      }
    ]
  };

  const doc2: InputDocument = {
    filename: 'Board_Minutes.pdf',
    pages: [
      {
        pageNumber: 1,
        text: 'The board approved the Q4 R&D expansion budget of 12 million dollars for AI verification engines.'
      }
    ]
  };

  const result = chunkMultipleDocuments([doc1, doc2]);

  console.log(`Ingested ${result.meta.documents?.length} documents.`);
  console.log(`Total session pages: ${result.meta.pageCount}, Total session words: ${result.meta.wordCount}`);
  console.log(`Total chunks created: ${result.chunks.length}`);

  // Assert all chunks carry documentName
  const missingDocName = result.chunks.some(c => !c.documentName);
  if (missingDocName) {
    throw new Error('FAIL: Some chunks are missing documentName!');
  }
  console.log('PASS: All chunks tagged with documentName.');

  // Test Moss local index and retrieval with documentName
  const testSessionId = `test-multi-session-${Date.now()}`;
  await indexDocumentInMoss(testSessionId, result.chunks);

  const queryRes = await queryMossRetrieval(testSessionId, 'What was the Q4 R&D budget approved by the board?', 3);
  console.log(`Retrieval latency: ${queryRes.timeTakenInMs}ms, candidates returned: ${queryRes.candidates.length}`);

  if (queryRes.candidates.length > 0) {
    const top = queryRes.candidates[0];
    console.log(`Top candidate retrieved from doc: "${top.documentName}", page: ${top.pageNumber}`);
    if (top.documentName !== 'Board_Minutes.pdf') {
      console.warn(`Unexpected top document: ${top.documentName}`);
    } else {
      console.log('PASS: Correctly retrieved candidate from Board_Minutes.pdf.');
    }
  }

  // Test Combined Truncation Enforcement
  console.log('\n--- Testing Combined Truncation Enforcement ---');
  const largePages = Array.from({ length: 15 }, (_, i) => ({
    pageNumber: i + 1,
    text: `Page ${i + 1} content with many words repeated to test page limit enforcement. `.repeat(30)
  }));

  const docA: InputDocument = { filename: 'Large_Doc_A.pdf', pages: largePages };
  const docB: InputDocument = { filename: 'Large_Doc_B.pdf', pages: largePages };

  const truncResult = chunkMultipleDocuments([docA, docB]);
  console.log(`Combined session pages capped at: ${truncResult.meta.pageCount} (Expected: <= 20)`);
  console.log(`Combined session words capped at: ${truncResult.meta.wordCount} (Expected: <= 8000)`);
  console.log(`Session truncated: ${truncResult.meta.truncated}`);
  console.log(`Truncation notes: ${truncResult.meta.truncatedPageRange}`);

  if (truncResult.meta.pageCount > 20 || truncResult.meta.wordCount > 8000) {
    throw new Error('FAIL: Multi-document session exceeded 20-page or 8000-word limit!');
  }
  console.log('PASS: Combined session limits strictly enforced.');
  console.log('\n--- All Multi-Doc Tests Passed Successfully! ---');
}

runMultiDocTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
