import { queryBaselineCosine } from '@/lib/baseline';
import { ChunkRecord } from '@/lib/types';

jest.mock('@/lib/gemini', () => {
  const actual = jest.requireActual('@/lib/gemini');
  return {
    ...actual,
    generateTextEmbedding: jest.fn(async (text: string) => {
      if (text.includes('revenue')) return [0.9, 0.1, 0.0, 0.3];
      if (text.includes('operating')) return [0.1, 0.8, 0.4, 0.1];
      return [0.5, 0.5, 0.5, 0.5];
    }),
  };
});

describe('Baseline Cosine Similarity (FR-12 & Invariant 4)', () => {
  const dummyChunks: ChunkRecord[] = [
    {
      chunkId: 'c1',
      text: 'Acme Corporation net revenue reached $45 million in Q3 2026.',
      pageNumber: 1,
      charOffsetStart: 0,
      charOffsetEnd: 60,
      embedding: [0.9, 0.1, 0.0, 0.3]
    },
    {
      chunkId: 'c2',
      text: 'Operating costs rose 8% year-over-year to $31.2 million.',
      pageNumber: 1,
      charOffsetStart: 61,
      charOffsetEnd: 118,
      embedding: [0.1, 0.8, 0.4, 0.1]
    },
    {
      chunkId: 'c3',
      text: 'Global workforce reached 820 full-time employees.',
      pageNumber: 2,
      charOffsetStart: 119,
      charOffsetEnd: 168,
      embedding: [0.2, 0.1, 0.8, 0.5]
    }
  ];

  it('computes real measured latency without simulated timeouts or delays (Invariant 4)', async () => {
    const t0 = performance.now();
    const result = await queryBaselineCosine('revenue in Q3', dummyChunks, 2);
    const measuredOutside = performance.now() - t0;

    expect(result.candidates.length).toBeLessThanOrEqual(2);
    expect(result.timeTakenInMs).toBeGreaterThanOrEqual(0.1);
    expect(result.timeTakenInMs).toBeLessThanOrEqual(measuredOutside + 5);
  });

  it('ranks candidates by similarity score in descending order', async () => {
    const result = await queryBaselineCosine('What was net revenue?', dummyChunks, 3);

    expect(result.candidates.length).toBe(3);
    for (let i = 0; i < result.candidates.length - 1; i++) {
      expect(result.candidates[i].similarityScore).toBeGreaterThanOrEqual(
        result.candidates[i + 1].similarityScore
      );
    }
    expect(result.candidates[0].chunkId).toBe('c1');
  });

  it('handles empty chunks array gracefully', async () => {
    const result = await queryBaselineCosine('test query', [], 3);
    expect(result.candidates).toEqual([]);
    expect(result.timeTakenInMs).toBeGreaterThanOrEqual(0);
  });
});
