import { SentenceDetector, splitTextIntoSentences } from '@/lib/sentence-boundary';

describe('Sentence Boundary Detection (FR-5 Acceptance Criteria)', () => {
  const testCases = [
    {
      name: 'Handles multiple sentences with monetary figures and percentages',
      input: 'Revenue reached $3.5 million in Q3. This was an increase of 12.8% over the prior year.',
      expected: [
        'Revenue reached $3.5 million in Q3.',
        'This was an increase of 12.8% over the prior year.'
      ]
    },
    {
      name: 'Handles titles and time abbreviations without false splits',
      input: 'Dr. Smith met with Mr. Davis at approx. 4 p.m. to discuss the merger.',
      expected: [
        'Dr. Smith met with Mr. Davis at approx. 4 p.m. to discuss the merger.'
      ]
    },
    {
      name: 'Handles percentages, "vs.", fiscal year notation and exclamation points',
      input: "The company's net margin was 14.5% vs. 11.2% in FY2025! Operating profits rose sharply.",
      expected: [
        "The company's net margin was 14.5% vs. 11.2% in FY2025!",
        'Operating profits rose sharply.'
      ]
    },
    {
      name: 'Handles Latin abbreviations like e.g. and corporate suffixes',
      input: 'We evaluated multiple vendors, e.g., Acme Corp. and Globex Inc., before choosing our partner.',
      expected: [
        'We evaluated multiple vendors, e.g., Acme Corp. and Globex Inc., before choosing our partner.'
      ]
    },
    {
      name: 'Handles questions followed by affirmative statements with currency',
      input: 'Did the board approve the $45.5 million acquisition? Yes, they approved it unanimously.',
      expected: [
        'Did the board approve the $45.5 million acquisition?',
        'Yes, they approved it unanimously.'
      ]
    },
    {
      name: 'Handles quoted speech containing internal periods and percentages',
      input: 'Prof. Miller noted, "The yield curve inverted by 0.75 percentage points." This caused concern.',
      expected: [
        'Prof. Miller noted, "The yield curve inverted by 0.75 percentage points."',
        'This caused concern.'
      ]
    },
    {
      name: 'Handles month abbreviations like Jan. and Feb.',
      input: 'Inflation averaged 3.2% in Jan. and 3.1% in Feb. before cooling down.',
      expected: [
        'Inflation averaged 3.2% in Jan. and 3.1% in Feb. before cooling down.'
      ]
    },
    {
      name: 'Handles country abbreviations (U.S.) and quarters (Q1)',
      input: 'The U.S. market expanded by 4.2% in Q1. European markets followed suit.',
      expected: [
        'The U.S. market expanded by 4.2% in Q1.',
        'European markets followed suit.'
      ]
    }
  ];

  describe('Streaming Token-by-Token Detection', () => {
    testCases.forEach((tc, idx) => {
      it(`Case ${idx + 1}: ${tc.name}`, () => {
        const detector = new SentenceDetector();
        const tokens = tc.input.split(/(?<=\s)|(?=\s)/);
        const result: string[] = [];

        for (const token of tokens) {
          const sentences = detector.addToken(token);
          result.push(...sentences);
        }
        result.push(...detector.flush());

        expect(result).toEqual(tc.expected);
      });
    });
  });

  describe('Direct Full Text Splitting', () => {
    testCases.forEach((tc, idx) => {
      it(`Direct split Case ${idx + 1}: ${tc.name}`, () => {
        const result = splitTextIntoSentences(tc.input);
        expect(result).toEqual(tc.expected);
      });
    });
  });

  describe('Markdown and Structure Handling', () => {
    it('correctly splits bullet points and bold markdown spans', () => {
      const detector = new SentenceDetector();
      const text = `Based on the provided document:

* **Operating Costs:** Operating costs rose 8% year-over-year to **$31.2 million**. Within operating expenses, research and development (R&D) expenses were **$12.4 million** (27.5% of total revenue).
* **Headcount Changes:** The rise in operating costs was driven by **planned headcount additions in artificial intelligence research and international sales expansion**. By the end of the quarter, the total global workforce reached **820 full-time employees**.`;

      const tokens = text.split(/(?<=\s)|(?=\s)/);
      const sentences: string[] = [];
      for (const token of tokens) {
        sentences.push(...detector.addToken(token));
      }
      sentences.push(...detector.flush());

      expect(sentences.length).toBeGreaterThanOrEqual(4);
      expect(sentences[0]).toContain('Based on the provided document:');
    });

    it('handles empty strings and edge conditions without error', () => {
      const detector = new SentenceDetector();
      expect(detector.addToken('')).toEqual([]);
      expect(detector.flush()).toEqual([]);

      const emptySplit = splitTextIntoSentences('');
      expect(emptySplit).toEqual([]);
    });
  });
});
