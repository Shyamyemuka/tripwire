import { classifySentenceVerdict } from '../src/lib/gemini';
import { CandidatePassage } from '../src/lib/types';

interface TestItem {
  name: string;
  sentence: string;
  passageText: string;
  expectedStatus: 'RED';
}

const testSet: TestItem[] = [
  // 5 Direction-Flip Pairs
  {
    name: "Direction Flip 1: costs decreased vs costs rose",
    sentence: "Operating costs decreased significantly across all segments.",
    passageText: "Operating costs rose 8% year-over-year to $31.2 million.",
    expectedStatus: "RED"
  },
  {
    name: "Direction Flip 2: revenue fell vs revenue increased",
    sentence: "Consolidated net revenue fell during the third quarter.",
    passageText: "Consolidated net revenue increased 10% year-over-year to $45 million in Q3.",
    expectedStatus: "RED"
  },
  {
    name: "Direction Flip 3: workforce contracted vs workforce expanded",
    sentence: "The global workforce contracted as headcount was reduced.",
    passageText: "Headcount additions in artificial intelligence research expanded our full-time workforce.",
    expectedStatus: "RED"
  },
  {
    name: "Direction Flip 4: margins compressed vs margins grew",
    sentence: "Gross profit margins grew substantially to record highs.",
    passageText: "Gross profit margins compressed by 150 basis points amidst rising raw material costs.",
    expectedStatus: "RED"
  },
  {
    name: "Direction Flip 5: cash reserves shrank vs cash reserves gained",
    sentence: "Cash reserves shrank substantially following aggressive capital deployment.",
    passageText: "The company gained $14 million in net cash reserves following disciplined allocation.",
    expectedStatus: "RED"
  },

  // 5 Number-Flip Pairs
  {
    name: "Number Flip 1: 30% decrease vs 8% increase",
    sentence: "Operating costs decreased by 30% from last year.",
    passageText: "Operating costs rose 8% year-over-year to $31.2 million.",
    expectedStatus: "RED"
  },
  {
    name: "Number Flip 2: 25% revenue growth vs 10% revenue growth",
    sentence: "The company generated 25% revenue growth in Q3.",
    passageText: "Consolidated net revenue increased 10% year-over-year to $45 million in Q3.",
    expectedStatus: "RED"
  },
  {
    name: "Number Flip 3: $80 million vs $45 million",
    sentence: "Consolidated net revenue reached $80 million in Q3.",
    passageText: "Consolidated net revenue increased 10% year-over-year to $45 million in Q3.",
    expectedStatus: "RED"
  },
  {
    name: "Number Flip 4: 50% gross margin vs 68.4% gross margin",
    sentence: "Gross profit margin was reported at 50% for the third quarter.",
    passageText: "Gross profit margin held stable at 68.4% despite supply chain pressures.",
    expectedStatus: "RED"
  },
  {
    name: "Number Flip 5: $2 million acquisition vs $12 million acquisition",
    sentence: "The company completed the acquisition of CloudAI Systems for $2 million.",
    passageText: "The company completed a strategic acquisition of CloudAI Systems for $12 million in cash and stock.",
    expectedStatus: "RED"
  }
];

async function run() {
  console.log('--- Running Contradiction Safeguard Test Suite (FR-8 Acceptance Criteria) ---');
  let passed = 0;

  for (let i = 0; i < testSet.length; i++) {
    const item = testSet[i];
    const candidate: CandidatePassage = {
      chunkId: `chunk-${i}`,
      text: item.passageText,
      pageNumber: 1,
      charOffsetStart: 0,
      charOffsetEnd: item.passageText.length,
      similarityScore: 0.92 // Intentionally high similarity to verify similarity != truth!
    };

    const result = await classifySentenceVerdict(item.sentence, [candidate]);
    const isCorrect = result.status === item.expectedStatus;

    if (isCorrect) {
      passed++;
      console.log(`[PASS] ${item.name} -> Classified RED (Contradicted) [Reason: ${result.reasoning}]`);
    } else {
      console.error(`[FAIL] ${item.name} -> Got ${result.status}, expected ${item.expectedStatus}`);
    }
  }

  console.log(`\nResult: ${passed}/${testSet.length} contradiction test cases passed.`);
  if (passed !== testSet.length) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
