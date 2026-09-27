import { ChunkRecord, DocumentMeta } from './types';

export interface ChunkingResult {
  chunks: ChunkRecord[];
  meta: DocumentMeta;
  indexedText?: string;
}

const MAX_PAGES = 200;
const MAX_WORDS = 100000;
const CHUNK_SIZE_WORDS = 140;
const CHUNK_OVERLAP_WORDS = 30;

function isSentenceEndWord(word: string): boolean {
  if (!/[.!?]["']?$/.test(word)) return false;
  const clean = word.toLowerCase().replace(/["']/g, '');
  // Ignore standard abbreviations
  if (/^(e\.g\.|i\.e\.|u\.s\.|dr\.|mr\.|mrs\.|ms\.|vs\.|inc\.|corp\.|ltd\.|\d+\.)$/.test(clean)) {
    return false;
  }
  return true;
}

export function slicePageIntoChunks(
  pageText: string,
  pageNumber: number,
  documentName: string,
  startChunkIndex: number,
  globalCharOffset: number
): { chunks: ChunkRecord[]; nextChunkIndex: number } {
  const words = pageText.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { chunks: [], nextChunkIndex: startChunkIndex };
  }

  const chunks: ChunkRecord[] = [];
  let chunkIndex = startChunkIndex;
  let startIndex = 0;
  let lastSearchPos = 0;

  while (startIndex < words.length) {
    let endIndex: number;

    if (startIndex + CHUNK_SIZE_WORDS >= words.length) {
      endIndex = words.length;
    } else {
      // Search backward from target end for a sentence boundary
      const targetEnd = startIndex + CHUNK_SIZE_WORDS;
      const minEnd = startIndex + Math.floor(CHUNK_SIZE_WORDS * 0.65);
      let foundEnd = -1;

      for (let k = targetEnd - 1; k >= minEnd; k--) {
        if (isSentenceEndWord(words[k])) {
          foundEnd = k + 1; // slice is non-inclusive, so includes word k
          break;
        }
      }

      endIndex = foundEnd !== -1 ? foundEnd : targetEnd;
    }

    const chunkWords = words.slice(startIndex, endIndex);
    const chunkText = chunkWords.join(' ').trim();

    if (chunkText.length > 0) {
      // Find accurate character offset within page
      const searchProbe = chunkText.slice(0, Math.min(40, chunkText.length));
      const foundPos = pageText.indexOf(searchProbe, lastSearchPos);
      const pageOffset = foundPos >= 0 ? foundPos : lastSearchPos;
      lastSearchPos = pageOffset;

      const startOffset = globalCharOffset + pageOffset;
      const endOffset = startOffset + chunkText.length;

      chunks.push({
        chunkId: `chunk-${chunkIndex++}`,
        text: chunkText,
        pageNumber,
        charOffsetStart: startOffset,
        charOffsetEnd: endOffset,
        documentName
      });
    }

    if (endIndex >= words.length) {
      break;
    }

    // Advance startIndex with overlap, preferably at a sentence start
    const rawNextStart = Math.max(startIndex + 1, endIndex - CHUNK_OVERLAP_WORDS);
    let nextStart = rawNextStart;

    // Check if there is a sentence boundary near rawNextStart to start cleanly on a sentence
    const searchWindowStart = Math.max(startIndex + 1, rawNextStart - 10);
    const searchWindowEnd = Math.min(endIndex - 5, rawNextStart + 10);
    for (let k = searchWindowEnd; k >= searchWindowStart; k--) {
      if (isSentenceEndWord(words[k]) && k + 1 < endIndex && k + 1 > startIndex) {
        nextStart = k + 1;
        break;
      }
    }

    startIndex = nextStart;
  }

  return { chunks, nextChunkIndex: chunkIndex };
}

export interface PageInput {
  pageNumber: number;
  text: string;
}

/**
 * FR-2: Document Chunking and Size Limit Enforcement
 * Enforces max 200 pages / 100,000 words with ~140 word sentence-bounded chunks.
 */
export function chunkDocument(
  filename: string,
  pages: PageInput[]
): ChunkingResult {
  let truncated = false;
  let truncatedPageRange: string | undefined;

  // Avoid counting empty pages against document limits (Finding 5)
  const nonEmptyPages = pages.filter(p => p.text && p.text.trim().length > 0);
  let processedPages = nonEmptyPages.length > 0 ? nonEmptyPages : pages.slice(0, 1);

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

  // 2. Enforce Word Limit (~100,000 words)
  if (totalWords > MAX_WORDS) {
    truncated = true;
    truncatedPageRange = (truncatedPageRange ? truncatedPageRange + '; ' : '') +
      `Exceeded ${MAX_WORDS.toLocaleString()} words cap (truncated to first ${MAX_WORDS.toLocaleString()} words)`;
    
    // Trim pages to first 100,000 words
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

  // 3. Generate Overlapping Sentence-Bounded Chunks (~140 words)
  const chunks: ChunkRecord[] = [];
  let globalCharOffset = 0;
  let chunkIndex = 0;

  for (const page of processedPages) {
    const pageText = page.text.trim();
    if (!pageText) continue;

    const result = slicePageIntoChunks(pageText, page.pageNumber, filename, chunkIndex, globalCharOffset);
    chunks.push(...result.chunks);
    chunkIndex = result.nextChunkIndex;

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
    },
    indexedText: processedPages.map(p => p.text.trim()).filter(Boolean).join('\n\n')
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

export interface InputDocument {
  filename: string;
  pages: PageInput[];
}

/**
 * Multi-Document Chunking with combined session caps (20 pages / 8,000 words max).
 * Sequentially processes documents until the combined limit is reached.
 */
export function chunkMultipleDocuments(documents: InputDocument[]): ChunkingResult {
  if (documents.length === 1) {
    const single = chunkDocument(documents[0].filename, documents[0].pages);
    return {
      chunks: single.chunks,
      meta: {
        ...single.meta,
        documents: [{
          filename: single.meta.filename,
          pageCount: single.meta.pageCount,
          wordCount: single.meta.wordCount,
          truncated: single.meta.truncated,
          truncatedPageRange: single.meta.truncatedPageRange
        }]
      }
    };
  }

  const allChunks: ChunkRecord[] = [];
  const documentItems: import('./types').DocumentItem[] = [];
  const indexedSections: string[] = [];

  let remainingPages = MAX_PAGES;
  let remainingWords = MAX_WORDS;

  let totalSessionPages = 0;
  let totalSessionWords = 0;
  let globalTruncated = false;
  const truncationNotes: string[] = [];

  let globalChunkIndex = 0;

  for (const doc of documents) {
    const docName = doc.filename;

    if (remainingPages <= 0 || remainingWords <= 0) {
      globalTruncated = true;
      truncationNotes.push(`"${docName}" excluded (session cap reached)`);
      documentItems.push({
        filename: docName,
        pageCount: 0,
        wordCount: 0,
        truncated: true,
        truncatedPageRange: `Excluded: session limit of ${MAX_PAGES} pages / ${MAX_WORDS.toLocaleString()} words reached`
      });
      continue;
    }

    let docTruncated = false;
    let docTruncatedRange: string | undefined;

    // Avoid counting empty pages against document limits (Finding 5)
    const nonEmptyPages = doc.pages.filter(p => p.text && p.text.trim().length > 0);
    let processedPages = [...nonEmptyPages];

    // Enforce remaining page limit for this doc
    if (processedPages.length > remainingPages) {
      docTruncated = true;
      globalTruncated = true;
      docTruncatedRange = `Pages 1-${remainingPages} indexed (${processedPages.length - remainingPages} pages excluded by session cap)`;
      processedPages = processedPages.slice(0, remainingPages);
    }

    // Calculate word count in processed pages
    let docWords = 0;
    for (const p of processedPages) {
      const wc = p.text.trim().split(/\s+/).filter(Boolean).length;
      docWords += wc;
    }

    // Enforce remaining word limit for this doc
    if (docWords > remainingWords) {
      docTruncated = true;
      globalTruncated = true;
      const note = `Truncated to fit remaining session word budget (${remainingWords} words)`;
      docTruncatedRange = docTruncatedRange ? `${docTruncatedRange}; ${note}` : note;

      let wordsLeft = remainingWords;
      const trimmedPages: PageInput[] = [];
      for (const p of processedPages) {
        const words = p.text.trim().split(/\s+/).filter(Boolean);
        if (words.length <= wordsLeft) {
          trimmedPages.push(p);
          wordsLeft -= words.length;
        } else {
          const keptText = words.slice(0, wordsLeft).join(' ');
          trimmedPages.push({ pageNumber: p.pageNumber, text: keptText });
          wordsLeft = 0;
          break;
        }
      }
      processedPages = trimmedPages;
      docWords = remainingWords;
    }

    // Generate chunks for processed pages
    let globalCharOffset = 0;
    const docPageCount = processedPages.length;

    for (const page of processedPages) {
      const pageText = page.text.trim();
      if (!pageText) continue;

      const result = slicePageIntoChunks(pageText, page.pageNumber, docName, globalChunkIndex, globalCharOffset);
      allChunks.push(...result.chunks);
      globalChunkIndex = result.nextChunkIndex;

      globalCharOffset += pageText.length + 1;
    }

    remainingPages -= docPageCount;
    remainingWords -= docWords;

    totalSessionPages += docPageCount;
    totalSessionWords += docWords;

    if (processedPages.length > 0) {
      const docText = processedPages.map(p => p.text.trim()).filter(Boolean).join('\n\n');
      indexedSections.push(`=== DOCUMENT: ${docName} ===\n${docText}`);
    }

    if (docTruncatedRange) {
      truncationNotes.push(`"${docName}": ${docTruncatedRange}`);
    }

    documentItems.push({
      filename: docName,
      pageCount: docPageCount,
      wordCount: docWords,
      truncated: docTruncated,
      truncatedPageRange: docTruncatedRange
    });
  }

  const primaryFilename = documents.length === 1
    ? documents[0].filename
    : `${documents.length} Documents (${documents.map(d => d.filename).join(', ')})`;

  return {
    chunks: allChunks,
    meta: {
      filename: primaryFilename,
      pageCount: totalSessionPages,
      wordCount: totalSessionWords,
      truncated: globalTruncated,
      truncatedPageRange: truncationNotes.length > 0 ? truncationNotes.join(' | ') : undefined,
      documents: documentItems
    },
    indexedText: indexedSections.join('\n\n').trim()
  };
}
