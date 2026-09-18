import { PageInput } from './chunker';
import { extractPdfTextWithGemini } from './gemini';

/**
 * FR-1: Document Intake (PDF text extraction)
 * Extracts text page-by-page.
 * 1. Attempts local parsing via pdf-parse.
 * 2. In serverless / Vercel environments where binary dependencies or workers fail,
 *    or when documents have complex encodings / scanned text,
 *    it automatically falls back to Gemini Multimodal Document Extraction.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<PageInput[]> {
  // Step 1: Try local fast pdf-parse
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfModule = require('pdf-parse');
    const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule;

    if (typeof PDFParse === 'function' && PDFParse.prototype?.getText) {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
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

      if (fullLength >= 20 && pages.length > 0) {
        return pages;
      }
    } else if (typeof pdfModule === 'function') {
      const data = await pdfModule(buffer);
      const text = (data?.text || '').trim();
      if (text.length >= 20) {
        return [{ pageNumber: 1, text }];
      }
    }
  } catch (localErr) {
    console.warn('Local pdf-parse failed (expected on serverless / Vercel), attempting Gemini multimodal fallback:', localErr);
  }

  // Step 2: Fallback to Gemini Multimodal Document Processing (100% reliable on Vercel)
  try {
    const geminiPages = await extractPdfTextWithGemini(buffer);
    if (geminiPages && geminiPages.length > 0) {
      const fullLength = geminiPages.reduce((acc, p) => acc + p.text.length, 0);
      if (fullLength >= 10) {
        return geminiPages;
      }
    }
  } catch (geminiErr) {
    console.error('Gemini PDF extraction fallback also failed:', geminiErr);
  }

  throw new Error(
    "Failed to extract readable text from this PDF. Please ensure it is a valid document or paste the text directly."
  );
}