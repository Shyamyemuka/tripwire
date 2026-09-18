import { PageInput } from './chunker';

/**
 * FR-1: Document Intake (PDF text extraction)
 * Extracts text page-by-page.
 * Fallback: If PDF text extraction returns empty or near-empty content,
 * throw an explicit error rather than proceeding with an empty index.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<PageInput[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfModule = require('pdf-parse');
    const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule;

    if (typeof PDFParse === 'function' && PDFParse.prototype?.getText) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();

      const rawPages = (result && result.pages) ? result.pages : [];
      const pages: PageInput[] = rawPages
        .map((p: { text?: string; num?: number }) => ({
          pageNumber: p.num || 1,
          text: (p.text || '').trim()
        }))
        .filter((p: PageInput) => p.text.length > 0);

      const fullLength = pages.reduce((acc: number, p: PageInput) => acc + p.text.length, 0);

      if (fullLength < 20 || pages.length === 0) {
        throw new Error(
          "Couldn't extract text from this PDF - the document appears to be scanned or empty. Please use a text-based PDF or paste the content directly."
        );
      }

      return pages;
    } else {
      // Fallback for functional pdf-parse
      const data = await pdfModule(buffer);
      const text = (data.text || '').trim();
      if (text.length < 20) {
        throw new Error(
          "Couldn't extract text from this PDF - the document appears to be scanned or empty. Please use a text-based PDF or paste the content directly."
        );
      }
      return [{ pageNumber: 1, text }];
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Couldn't extract text")) {
      throw err;
    }
    console.error('PDF parsing error:', err);
    throw new Error(
      "Failed to parse PDF file. Please ensure it is a valid, uncorrupted text PDF, or paste text directly."
    );
  }
}