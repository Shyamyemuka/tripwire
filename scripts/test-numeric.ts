import { classifySentenceVerdict } from '../src/lib/gemini';
import { CandidatePassage } from '../src/lib/types';

async function test() {
  const p: CandidatePassage = {
    chunkId: 'c1',
    text: 'Acme Corporation net revenue reached $45 million in Q3 2026. Operating costs rose 8% to $31.2 million.',
    pageNumber: 1,
    charOffsetStart: 0,
    charOffsetEnd: 100,
    similarityScore: 0.95
  };

  const s1 = 'Acme Corporation net revenue reached $45 million in Q3 2026.';
  const res1 = await classifySentenceVerdict(s1, [p]);
  console.log('Result for $45M (should be GREEN):', res1.status, res1.reasoning);

  const s2 = 'Acme Corporation net revenue was $90 million in Q3 2026.';
  const res2 = await classifySentenceVerdict(s2, [p]);
  console.log('Result for $90M (should be RED):', res2.status, res2.reasoning);
}

test();
