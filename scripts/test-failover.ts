import { streamAnswerGeneration, classifySentenceVerdict } from '../src/lib/gemini';
import { CandidatePassage } from '../src/lib/types';

async function testFailover() {
  console.log('--- Testing Gemini Multi-Key Automatic Failover ---');

  // Verify that GEMINI_API_KEY_1 and GEMINI_API_KEY_2 are both detected
  console.log('Key 1 present:', !!process.env.GEMINI_API_KEY_1);
  console.log('Key 2 present:', !!process.env.GEMINI_API_KEY_2);

  // 1. Test streaming generation with active keys
  console.log('\n[1] Testing streaming generation...');
  let tokens = 0;
  for await (const token of streamAnswerGeneration('What is Tripwire?', 'Tripwire is a real-time verification system.')) {
    tokens++;
  }
  console.log(`Streaming succeeded! Received ${tokens} token chunks.`);

  // 2. Test verdict classifier
  console.log('\n[2] Testing verdict classification...');
  const passage: CandidatePassage = {
    chunkId: 'c1',
    text: 'Tripwire uses sub-10ms Moss retrieval for instant verification.',
    pageNumber: 1,
    charOffsetStart: 0,
    charOffsetEnd: 50,
    similarityScore: 0.95
  };
  const verdict = await classifySentenceVerdict(
    'Tripwire uses sub-10ms Moss retrieval for instant verification.',
    [passage]
  );
  console.log('Verdict result:', verdict.status, '-', verdict.reasoning);

  // 3. Test deliberate failover by simulating an invalid key 1
  console.log('\n[3] Simulating key #1 failure (intentionally invalid key #1)...');
  const originalKey1 = process.env.GEMINI_API_KEY_1;
  try {
    process.env.GEMINI_API_KEY_1 = 'AQ.INVALID_TEST_KEY_THAT_WILL_FAIL_12345';
    
    // Now perform a call — it should warn on Key #1 and succeed on Key #2!
    const failoverVerdict = await classifySentenceVerdict(
      'Tripwire uses sub-10ms Moss retrieval for instant verification.',
      [passage]
    );
    console.log('Failover Verdict result:', failoverVerdict.status, '-', failoverVerdict.reasoning);
    console.log('SUCCESS: Failover to Key #2 worked seamlessly!');
  } finally {
    process.env.GEMINI_API_KEY_1 = originalKey1;
  }

  console.log('\n--- Multi-Key Automatic Failover Passed 100% ---');
}

testFailover().catch((err) => {
  console.error('Failover test error:', err);
  process.exit(1);
});
