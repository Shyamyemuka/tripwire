import { isTrivialClaim } from '@/lib/trivial-filter';

describe('Trivial Claim Filter (FR-6 Acceptance Criteria)', () => {
  const fillerSentences = [
    'However,',
    'The company had a strong quarter.',
    'In summary,',
    'Furthermore,',
    'This is a strong approach.',
    'Overall, performance was solid.',
    'Here is a summary of the quarterly results:',
    'I hope this helps.',
    'To conclude,',
    'The outlook remains positive.'
  ];

  const factualSentences = [
    'Revenue increased 10% to $45 million in Q3.',
    'Operating costs decreased significantly, down 30% from last year.',
    'Net income was $4.2 million compared to $3.1 million in the prior period.',
    'The company acquired CloudAI Corp for $120 million in cash.',
    'Gross margins compressed by 150 basis points.',
    'Total headcount reached 1,450 employees by year end.',
    'Operating cash flow stood at $8.5M for the nine months ended September 30.',
    'R&D expenses accounted for 18.5% of net revenues.',
    'Earnings per share came in at $0.85 versus expectations of $0.80.',
    'The board declared a quarterly dividend of $0.25 per share.'
  ];

  describe('Filler and Transitional Phrases (GREY status)', () => {
    fillerSentences.forEach((sentence) => {
      it(`identifies "${sentence}" as trivial/filler`, () => {
        expect(isTrivialClaim(sentence)).toBe(true);
      });
    });
  });

  describe('Factual and Verifiable Claims (Must Not Be Dropped)', () => {
    factualSentences.forEach((sentence) => {
      it(`identifies "${sentence}" as checkable factual claim`, () => {
        expect(isTrivialClaim(sentence)).toBe(false);
      });
    });
  });

  describe('FR-6 Benchmark Target Accuracy', () => {
    it('achieves >= 90% classification accuracy on benchmark dataset', () => {
      let correct = 0;
      const total = fillerSentences.length + factualSentences.length;

      for (const s of fillerSentences) {
        if (isTrivialClaim(s)) correct++;
      }

      for (const s of factualSentences) {
        if (!isTrivialClaim(s)) correct++;
      }

      const accuracy = (correct / total) * 100;
      expect(accuracy).toBeGreaterThanOrEqual(90);
    });
  });
});
