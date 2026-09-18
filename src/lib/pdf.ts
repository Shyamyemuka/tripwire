import { PageInput } from './chunker';

/**
 * FR-1: Document Intake (PDF text extraction)
 * Fallback: If PDF text extraction returns empty or near-empty content,
 * throw an explicit error rather than proceeding with an empty index.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<PageInput[]> {
  try {
    // Dynamic import to support various environments
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfModule = require('pdf-parse');
    const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule;

    if (typeof PDFParse === 'function' && PDFParse.prototype?.load) {
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const info = await parser.getInfo();
      const numPages = info.numPages || 1;

      const pages: PageInput[] = [];
      let fullTextLength = 0;

      for (let p = 1; p <= numPages; p++) {
        const pageText = await parser.getPageText(p);
        const text = (pageText || '').trim();
        fullTextLength += text.length;
        if (text) {
          pages.push({
            pageNumber: p,
            text
          });
        }
      }

      await parser.destroy();

      if (fullTextLength < 40 || pages.length === 0) {
        throw new Error(
          "Couldn't extract text from this PDF - the document appears to be scanned or empty. Please use a text-based PDF or paste the content directly."
        );
      }

      return pages;
    } else {
      // Fallback to legacy functional pdf-parse if applicable
      const data = await pdfModule(buffer);
      const text = (data.text || '').trim();
      if (text.length < 40) {
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
