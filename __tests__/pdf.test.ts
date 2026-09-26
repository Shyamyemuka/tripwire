import { extractTextFromPdf } from '@/lib/pdf';

jest.mock('@/lib/gemini', () => {
  const actual = jest.requireActual('@/lib/gemini');
  return {
    ...actual,
    extractPdfTextWithGemini: jest.fn().mockRejectedValue(new Error('Corrupted or invalid PDF content')),
  };
});

describe('PDF Extraction (FR-1 Multi-Layer Ingestion)', () => {
  const minimalValidPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 65 >> stream
BT /F1 18 Tf 50 100 Td (Hello World Tripwire Test PDF Extraction Long Text) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000246 00000 n 
0000000363 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
444
%%EOF`;

  it('extracts readable text pages from PDF buffer', async () => {
    const buf = Buffer.from(minimalValidPdf);
    const pages = await extractTextFromPdf(buf);

    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].text).toContain('Tripwire');
  });

  it('throws informative error for corrupted or empty PDF buffer', async () => {
    const invalidBuf = Buffer.from('NOT_A_PDF_FILE');
    await expect(extractTextFromPdf(invalidBuf)).rejects.toThrow(
      'Failed to extract readable text from this PDF'
    );
  });
});
