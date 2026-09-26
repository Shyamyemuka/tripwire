import { classifySentenceVerdict } from '@/lib/gemini';
import { CandidatePassage } from '@/lib/types';

describe('Verdict Classifier & Contradiction Safeguards (FR-8 & Invariants 1 & 3)', () => {
  const directionFlipCases = [
    {
      name: 'Direction Flip 1: costs decreased vs costs rose',
      sentence: 'Operating costs decreased significantly across all segments.',
      passageText: 'Operating costs rose 8% year-over-year to $31.2 million.',
      expectedStatus: 'RED'
    },
    {
      name: 'Direction Flip 2: revenue fell vs revenue increased',
      sentence: 'Consolidated net revenue fell during the third quarter.',
      passageText: 'Consolidated net revenue increased 10% year-over-year to $45 million in Q3.',
      expectedStatus: 'RED'
    },
    {
      name: 'Direction Flip 3: workforce contracted vs workforce expanded',
      sentence: 'The global workforce contracted as headcount was reduced.',
      passageText: 'Headcount additions in artificial intelligence research expanded our full-time workforce.',
      expectedStatus: 'RED'
    },
    {
      name: 'Direction Flip 4: margins compressed vs margins grew',
      sentence: 'Gross profit margins grew substantially to record highs.',
      passageText: 'Gross profit margins compressed by 150 basis points amidst rising raw material costs.',
      expectedStatus: 'RED'
    },
    {
      name: 'Direction Flip 5: cash reserves shrank vs cash reserves gained',
      sentence: 'Cash reserves shrank substantially following aggressive capital deployment.',
      passageText: 'The company gained $14 million in net cash reserves following disciplined allocation.',
      expectedStatus: 'RED'
    }
  ];

  const numberFlipCases = [
    {
      name: 'Number Flip 1: 30% decrease vs 8% increase',
      sentence: 'Operating costs decreased by 30% from last year.',
      passageText: 'Operating costs rose 8% year-over-year to $31.2 million.',
      expectedStatus: 'RED'
    },
    {
      name: 'Number Flip 2: 25% revenue growth vs 10% revenue growth',
      sentence: 'The company generated 25% revenue growth in Q3.',
      passageText: 'Consolidated net revenue increased 10% year-over-year to $45 million in Q3.',
      expectedStatus: 'RED'
    },
    {
      name: 'Number Flip 3: $80 million vs $45 million',
      sentence: 'Consolidated net revenue reached $80 million in Q3.',
      passageText: 'Consolidated net revenue increased 10% year-over-year to $45 million in Q3.',
      expectedStatus: 'RED'
    },
    {
      name: 'Number Flip 4: 50% gross margin vs 68.4% gross margin',
      sentence: 'Gross profit margin was reported at 50% for the third quarter.',
      passageText: 'Gross profit margin held stable at 68.4% despite supply chain pressures.',
      expectedStatus: 'RED'
    },
    {
      name: 'Number Flip 5: $2 million acquisition vs $12 million acquisition',
      sentence: 'The company completed the acquisition of CloudAI Systems for $2 million.',
      passageText: 'The company completed a strategic acquisition of CloudAI Systems for $12 million in cash and stock.',
      expectedStatus: 'RED'
    }
  ];

  describe('Direction-Flip Contradictions (FR-8 Direction Suite)', () => {
    directionFlipCases.forEach((item, idx) => {
      it(`Case ${idx + 1}: ${item.name}`, async () => {
        const candidate: CandidatePassage = {
          chunkId: `dir-chunk-${idx}`,
          text: item.passageText,
          pageNumber: 1,
          charOffsetStart: 0,
          charOffsetEnd: item.passageText.length,
          similarityScore: 0.94 // High similarity to test Invariant 1
        };

        const result = await classifySentenceVerdict(item.sentence, [candidate]);
        expect(result.status).toBe('RED');
      }, 15000);
    });
  });

  describe('Number-Flip Contradictions (FR-8 Number Suite)', () => {
    numberFlipCases.forEach((item, idx) => {
      it(`Case ${idx + 1}: ${item.name}`, async () => {
        const candidate: CandidatePassage = {
          chunkId: `num-chunk-${idx}`,
          text: item.passageText,
          pageNumber: 1,
          charOffsetStart: 0,
          charOffsetEnd: item.passageText.length,
          similarityScore: 0.95 // High similarity to test Invariant 1
        };

        const result = await classifySentenceVerdict(item.sentence, [candidate]);
        expect(result.status).toBe('RED');
      }, 15000);
    });
  });

  describe('Supported Claims & Invariant 3 Failure Handling', () => {
    it('verifies supported sentence with matching numbers as GREEN', async () => {
      const candidate: CandidatePassage = {
        chunkId: 'pass-chunk-1',
        text: 'Acme Corporation net revenue reached $45 million in Q3 2026. Operating costs rose 8% to $31.2 million.',
        pageNumber: 1,
        charOffsetStart: 0,
        charOffsetEnd: 104,
        similarityScore: 0.95
      };

      const sentence = 'Acme Corporation net revenue reached $45 million in Q3 2026.';
      const result = await classifySentenceVerdict(sentence, [candidate]);
      expect(result.status).toBe('GREEN');
    }, 15000);

    it('Invariant 3: defaults to AMBER when no candidate passages are provided', async () => {
      const result = await classifySentenceVerdict('Some factual claim.', []);
      expect(result.status).toBe('AMBER');
      expect(result.status).not.toBe('GREEN');
    });
  });
});
