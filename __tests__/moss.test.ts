import { indexDocumentInMoss, queryMossRetrieval, getSessionChunks } from '@/lib/moss';
import { ChunkRecord } from '@/lib/types';

describe('Moss Retrieval and In-Memory Index (FR-2 & FR-7)', () => {
  const sessionId = 'test-session-' + Date.now();
  const testChunks: ChunkRecord[] = [
    {
      chunkId: 'chunk-1',
      text: 'Acme Corporation net revenue reached $45 million in Q3 2026.',
      pageNumber: 1,
      charOffsetStart: 0,
      charOffsetEnd: 60,
      documentName: 'Q3_Report.pdf'
    },
    {
      chunkId: 'chunk-2',
      text: 'Operating costs rose 8% year-over-year to $31.2 million.',
      pageNumber: 1,
      charOffsetStart: 61,
      charOffsetEnd: 118,
      documentName: 'Q3_Report.pdf'
    },
    {
      chunkId: 'chunk-3',
      text: 'The board approved the Q4 R&D expansion budget of $12 million.',
      pageNumber: 1,
      charOffsetStart: 0,
      charOffsetEnd: 63,
      documentName: 'Board_Minutes.pdf'
    }
  ];

  beforeAll(async () => {
    await indexDocumentInMoss(sessionId, testChunks);
  });

  it('stores and retrieves session chunks from registry', () => {
    const chunks = getSessionChunks(sessionId);
    expect(chunks.length).toBe(3);
    expect(chunks[0].chunkId).toBe('chunk-1');
  });

  it('retrieves relevant candidate passages for query sentence', async () => {
    const result = await queryMossRetrieval(sessionId, 'What was the Q4 R&D budget approved by the board?', 2);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.timeTakenInMs).toBeGreaterThanOrEqual(0);

    const top = result.candidates[0];
    expect(top.text).toContain('budget');
    expect(top.documentName).toBe('Board_Minutes.pdf');
  });

  it('measures real elapsed time without artificial delay (Invariant 4)', async () => {
    const t0 = performance.now();
    const result = await queryMossRetrieval(sessionId, 'operating costs', 1);
    const measuredOutside = performance.now() - t0;

    expect(result.timeTakenInMs).toBeGreaterThanOrEqual(0);
    expect(result.timeTakenInMs).toBeLessThanOrEqual(measuredOutside + 5);
  });

  it('returns empty candidates array for an unknown session', async () => {
    const result = await queryMossRetrieval('non-existent-session', 'query text', 3);
    expect(result.candidates).toEqual([]);
  });
});
