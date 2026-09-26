import { chunkPlainText, chunkMultipleDocuments, InputDocument } from '@/lib/chunker';

describe('Document Chunker & Multi-Document Ingestion (FR-3 & FR-4)', () => {
  const sampleText = `Acme Corporation Financial Report Q3 2026.
Consolidated net revenue was $45 million, representing a 10% increase year-over-year.
Operating costs rose 8% to $31.2 million. The rise in operating expenses was driven by headcount additions in AI research.
Cash reserves stood at $14 million. The company declared a regular quarterly dividend.`;

  describe('Single Plain Text Document Chunking', () => {
    it('creates chunks with correct structure and metadata', () => {
      const { chunks, meta } = chunkPlainText(sampleText, 'sample.txt');

      expect(chunks.length).toBeGreaterThan(0);
      expect(meta.filename).toBe('sample.txt');
      expect(meta.wordCount).toBeGreaterThan(0);
      expect(meta.pageCount).toBe(1);

      chunks.forEach((chunk) => {
        expect(chunk.chunkId).toBeDefined();
        expect(chunk.text.length).toBeGreaterThan(0);
        expect(chunk.pageNumber).toBe(1);
        expect(chunk.charOffsetStart).toBeLessThanOrEqual(chunk.charOffsetEnd);
      });
    });
  });

  describe('Multi-Document Chunking & Document Attribution', () => {
    it('attaches documentName to every chunk and calculates multi-document totals', () => {
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

      expect(result.meta.documents?.length).toBe(2);
      expect(result.meta.pageCount).toBe(3);
      expect(result.chunks.length).toBeGreaterThanOrEqual(2);

      const missingDocName = result.chunks.some((c) => !c.documentName);
      expect(missingDocName).toBe(false);

      const docNames = new Set(result.chunks.map((c) => c.documentName));
      expect(docNames.has('Q3_Report.pdf')).toBe(true);
      expect(docNames.has('Board_Minutes.pdf')).toBe(true);
    });
  });
});
