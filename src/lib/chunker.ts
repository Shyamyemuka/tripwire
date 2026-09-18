import { ChunkRecord, DocumentMeta } from './types';

export interface ChunkingResult {
  chunks: ChunkRecord[];
  meta: DocumentMeta;
}

const MAX_PAGES = 20;
const MAX_WORDS = 8000;
const CHUNK_SIZE_WORDS = 200;
const CHUNK_OVERLAP_WORDS = 40;

export interface PageInput {
  pageNumber: number;
  text: string;
}

/**
 * FR-2: Document Chunking and Size Limit Enforcement
 * Enforces max 20 pages / 8,000 words with ~200 word chunks and ~40 word overlap.
 */
export function chunkDocument(
  filename: string,
  pages: PageInput[]
): ChunkingResult {
  let truncated = false;
  let truncatedPageRange: string | undefined;

  let processedPages = [...pages];

  // 1. Enforce Page Limit
  if (processedPages.length > MAX_PAGES) {
    truncated = true;
    truncatedPageRange = `Pages 1-${MAX_PAGES} indexed (pages ${MAX_PAGES + 1}-${processedPages.length} excluded)`;
    processedPages = processedPages.slice(0, MAX_PAGES);
  }

  // Calculate total word count across pages
  let totalWords = 0;
  for (const p of processedPages) {
    const wordCount = p.text.trim().split(/\s+/).filter(Boolean).length;
    totalWords += wordCount;
  }

  // 2. Enforce Word Limit (~8,000 words)
  if (totalWords > MAX_WORDS) {
    truncated = true;
    truncatedPageRange = (truncatedPageRange ? truncatedPageRange + '; ' : '') +
      `Exceeded 8,000 words cap (truncated to first 8,000 words)`;
    
    // Trim pages to first 8,000 words
    let remainingWords = MAX_WORDS;
    const trimmedPages: PageInput[] = [];
    for (const p of processedPages) {
      const words = p.text.trim().split(/\s+/).filter(Boolean);
      if (words.length <= remainingWords) {
        trimmedPages.push(p);
        remainingWords -= words.length;
      } else {
        const keptText = words.slice(0, remainingWords).join(' ');
        trimmedPages.push({ pageNumber: p.pageNumber, text: keptText });
        remainingWords = 0;
        break;
      }
    }
    processedPages = trimmedPages;
    totalWords = MAX_WORDS;
  }

  // 3. Generate Overlapping Chunks (~200 words with ~40-word overlap)
  const chunks: ChunkRecord[] = [];
  let globalCharOffset = 0;
  let chunkIndex = 0;

  for (const page of processedPages) {
    const pageText = page.text.trim();
    if (!pageText) continue;

    const words = pageText.split(/\s+/).filter(Boolean);
    const step = CHUNK_SIZE_WORDS - CHUNK_OVERLAP_WORDS; // 160 words per step

    for (let i = 0; i < words.length; i += step) {
      const chunkWords = words.slice(i, i + CHUNK_SIZE_WORDS);
      const chunkText = chunkWords.join(' ');
      
      // Calculate approximate character offset within page
      const pageOffset = pageText.indexOf(chunkWords[0]);
      const startOffset = globalCharOffset + (pageOffset >= 0 ? pageOffset : 0);
      const endOffset = startOffset + chunkText.length;

      chunks.push({
        chunkId: `chunk-${chunkIndex++}`,
        text: chunkText,
        pageNumber: page.pageNumber,
        charOffsetStart: startOffset,
        charOffsetEnd: endOffset
      });

      // If we reached the end of the page's words
      if (i + CHUNK_SIZE_WORDS >= words.length) {
        break;
      }
    }

    globalCharOffset += pageText.length + 1; // +1 for newline between pages
  }

  return {
    chunks,
    meta: {
      filename,
      pageCount: processedPages.length,
      wordCount: totalWords,
      truncated,
      truncatedPageRange
    }
  };
}

/**
 * Convenience helper for raw pasted text.
 * Divides into ~400-word blocks treated as pages.
 */
export function chunkPlainText(text: string, filename = 'pasted-text.txt'): ChunkingResult {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const pages: PageInput[] = [];

  let currentPageText: string[] = [];
  let currentWords = 0;
  let pageNumber = 1;

  for (const para of paragraphs) {
    const pWords = para.split(/\s+/).filter(Boolean).length;
    if (currentWords + pWords > 400 && currentPageText.length > 0) {
      pages.push({
        pageNumber: pageNumber++,
        text: currentPageText.join('\n\n')
      });
      currentPageText = [para];
      currentWords = pWords;
    } else {
      currentPageText.push(para);
      currentWords += pWords;
    }
  }

  if (currentPageText.length > 0) {
    pages.push({
      pageNumber: pageNumber,
      text: currentPageText.join('\n\n')
    });
  }

  if (pages.length === 0 && text.trim().length > 0) {
    pages.push({ pageNumber: 1, text: text.trim() });
  }

  return chunkDocument(filename, pages);
}
