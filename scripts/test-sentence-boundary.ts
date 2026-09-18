import { SentenceDetector, splitTextIntoSentences } from '../src/lib/sentence-boundary';

const testCases = [
  {
    input: "Revenue reached $3.5 million in Q3. This was an increase of 12.8% over the prior year.",
    expected: [
      "Revenue reached $3.5 million in Q3.",
      "This was an increase of 12.8% over the prior year."
    ]
  },
  {
    input: "Dr. Smith met with Mr. Davis at approx. 4 p.m. to discuss the merger.",
    expected: [
      "Dr. Smith met with Mr. Davis at approx. 4 p.m. to discuss the merger."
    ]
  },
  {
    input: "The company's net margin was 14.5% vs. 11.2% in FY2025! Operating profits rose sharply.",
    expected: [
      "The company's net margin was 14.5% vs. 11.2% in FY2025!",
      "Operating profits rose sharply."
    ]
  },
  {
    input: "We evaluated multiple vendors, e.g., Acme Corp. and Globex Inc., before choosing our partner.",
    expected: [
      "We evaluated multiple vendors, e.g., Acme Corp. and Globex Inc., before choosing our partner."
    ]
  },
  {
    input: "Did the board approve the $45.5 million acquisition? Yes, they approved it unanimously.",
    expected: [
      "Did the board approve the $45.5 million acquisition?",
      "Yes, they approved it unanimously."
    ]
  },
  {
    input: 'Prof. Miller noted, "The yield curve inverted by 0.75 percentage points." This caused concern.',
    expected: [
      'Prof. Miller noted, "The yield curve inverted by 0.75 percentage points."',
      'This caused concern.'
    ]
  },
  {
    input: "Inflation averaged 3.2% in Jan. and 3.1% in Feb. before cooling down.",
    expected: [
      "Inflation averaged 3.2% in Jan. and 3.1% in Feb. before cooling down."
    ]
  },
  {
    input: "The U.S. market expanded by 4.2% in Q1. European markets followed suit.",
    expected: [
      "The U.S. market expanded by 4.2% in Q1.",
      "European markets followed suit."
    ]
  }
];

let totalTests = 0;
let passedTests = 0;

console.log('--- Running Sentence Boundary Test Suite (FR-5 Acceptance Criteria) ---');

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  totalTests++;
  // Test via streaming simulation (token by token)
  const detector = new SentenceDetector();
  const tokens = tc.input.split(/(?<=\s)|(?=\s)/); // Split keeping spaces
  const result: string[] = [];
  for (const token of tokens) {
    const s = detector.addToken(token);
    result.push(...s);
  }
  result.push(...detector.flush());

  const isMatch = JSON.stringify(result) === JSON.stringify(tc.expected);
  if (isMatch) {
    passedTests++;
    console.log(`[PASS] Case ${i + 1}: ${tc.expected.length} sentences correctly split`);
  } else {
    console.error(`[FAIL] Case ${i + 1}:`);
    console.error('  Expected:', tc.expected);
    console.error('  Got:     ', result);
  }
}

console.log(`Result: ${passedTests}/${totalTests} test cases passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
