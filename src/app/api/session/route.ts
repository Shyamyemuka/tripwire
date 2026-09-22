import { NextRequest, NextResponse } from 'next/server';
import { chunkDocument, chunkPlainText, chunkMultipleDocuments, InputDocument, PageInput } from '@/lib/chunker';
import { extractTextFromPdf } from '@/lib/pdf';
import { indexDocumentInMoss } from '@/lib/moss';
import { generateTextEmbedding } from '@/lib/gemini';
import { ChunkRecord } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let chunkResult;
    let fullText = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const files = formData.getAll('files') as File[];
      const singleFile = formData.get('file') as File | null;
      const allFiles = files.length > 0 ? files : (singleFile ? [singleFile] : []);

      const rawTexts = formData.getAll('pastedTexts') as string[];
      const rawTitles = formData.getAll('pastedTitles') as string[];
      const singleRawText = (formData.get('text') as string | null) || '';

      const inputDocs: InputDocument[] = [];
      const fullTextSections: string[] = [];

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        const filename = file.name;
        const buffer = Buffer.from(await file.arrayBuffer());

        if (filename.toLowerCase().endsWith('.pdf')) {
          const pages = await extractTextFromPdf(buffer);
          inputDocs.push({ filename, pages });
          fullTextSections.push(`=== DOCUMENT: ${filename} ===\n${pages.map(p => p.text).join('\n\n')}`);
        } else if (filename.toLowerCase().endsWith('.txt') || filename.toLowerCase().endsWith('.md')) {
          const text = buffer.toString('utf-8');
          const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
          const pages: PageInput[] = [];
          let curText: string[] = [];
          let curWords = 0;
          let pNum = 1;
          for (const para of paragraphs) {
            const pw = para.split(/\s+/).filter(Boolean).length;
            if (curWords + pw > 400 && curText.length > 0) {
              pages.push({ pageNumber: pNum++, text: curText.join('\n\n') });
              curText = [para];
              curWords = pw;
            } else {
              curText.push(para);
              curWords += pw;
            }
          }
          if (curText.length > 0) pages.push({ pageNumber: pNum, text: curText.join('\n\n') });
          if (pages.length === 0 && text.trim().length > 0) pages.push({ pageNumber: 1, text: text.trim() });

          inputDocs.push({ filename, pages });
          fullTextSections.push(`=== DOCUMENT: ${filename} ===\n${text}`);
        } else {
          return NextResponse.json(
            { error: `Unsupported file type for "${filename}". Please upload PDF (.pdf), plain text (.txt), or Markdown (.md) files.` },
            { status: 400 }
          );
        }
      }

      if (rawTexts.length > 0) {
        for (let i = 0; i < rawTexts.length; i++) {
          const txt = rawTexts[i];
          if (!txt.trim()) continue;
          const title = rawTitles[i] || `Pasted Note ${i + 1}`;
          const paragraphs = txt.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
          const pages: PageInput[] = [];
          let curText: string[] = [];
          let curWords = 0;
          let pNum = 1;
          for (const para of paragraphs) {
            const pw = para.split(/\s+/).filter(Boolean).length;
            if (curWords + pw > 400 && curText.length > 0) {
              pages.push({ pageNumber: pNum++, text: curText.join('\n\n') });
              curText = [para];
              curWords = pw;
            } else {
              curText.push(para);
              curWords += pw;
            }
          }
          if (curText.length > 0) pages.push({ pageNumber: pNum, text: curText.join('\n\n') });
          if (pages.length === 0 && txt.trim().length > 0) pages.push({ pageNumber: 1, text: txt.trim() });

          inputDocs.push({ filename: title, pages });
          fullTextSections.push(`=== DOCUMENT: ${title} ===\n${txt}`);
        }
      } else if (singleRawText.trim() && allFiles.length === 0) {
        const title = 'pasted-text.txt';
        const txt = singleRawText;
        const paragraphs = txt.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        const pages: PageInput[] = [];
        let curText: string[] = [];
        let curWords = 0;
        let pNum = 1;
        for (const para of paragraphs) {
          const pw = para.split(/\s+/).filter(Boolean).length;
          if (curWords + pw > 400 && curText.length > 0) {
            pages.push({ pageNumber: pNum++, text: curText.join('\n\n') });
            curText = [para];
            curWords = pw;
          } else {
            curText.push(para);
            curWords += pw;
          }
        }
        if (curText.length > 0) pages.push({ pageNumber: pNum, text: curText.join('\n\n') });
        if (pages.length === 0 && txt.trim().length > 0) pages.push({ pageNumber: 1, text: txt.trim() });

        inputDocs.push({ filename: title, pages });
        fullTextSections.push(`=== DOCUMENT: ${title} ===\n${txt}`);
      }

      if (inputDocs.length === 0) {
        return NextResponse.json(
          { error: 'No file or text content provided.' },
          { status: 400 }
        );
      }

      chunkResult = chunkMultipleDocuments(inputDocs);
      fullText = fullTextSections.join('\n\n');
    } else {
      // JSON body
      const body = await req.json();

      if (body.documents && Array.isArray(body.documents) && body.documents.length > 0) {
        const inputDocs: InputDocument[] = [];
        const fullTextSections: string[] = [];

        for (let i = 0; i < body.documents.length; i++) {
          const docItem = body.documents[i];
          const text = docItem.text || '';
          const filename = docItem.filename || `Document ${i + 1}`;

          if (!text.trim()) continue;

          const paragraphs = text.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
          const pages: PageInput[] = [];
          let curText: string[] = [];
          let curWords = 0;
          let pNum = 1;
          for (const para of paragraphs) {
            const pw = para.split(/\s+/).filter(Boolean).length;
            if (curWords + pw > 400 && curText.length > 0) {
              pages.push({ pageNumber: pNum++, text: curText.join('\n\n') });
              curText = [para];
              curWords = pw;
            } else {
              curText.push(para);
              curWords += pw;
            }
          }
          if (curText.length > 0) pages.push({ pageNumber: pNum, text: curText.join('\n\n') });
          if (pages.length === 0 && text.trim().length > 0) pages.push({ pageNumber: 1, text: text.trim() });

          inputDocs.push({ filename, pages });
          fullTextSections.push(`=== DOCUMENT: ${filename} ===\n${text}`);
        }

        if (inputDocs.length === 0) {
          return NextResponse.json({ error: 'Provided documents contain no text.' }, { status: 400 });
        }

        chunkResult = chunkMultipleDocuments(inputDocs);
        fullText = fullTextSections.join('\n\n');
      } else {
        const text = body.text || '';
        const filename = body.filename || 'pasted-text.txt';

        if (!text || text.trim().length === 0) {
          return NextResponse.json(
            { error: 'Pasted text is empty.' },
            { status: 400 }
          );
        }

        chunkResult = chunkPlainText(text, filename);
        fullText = `=== DOCUMENT: ${filename} ===\n${text}`;
      }
    }

    const { chunks, meta, indexedText } = chunkResult;
    fullText = (indexedText || fullText).trim();

    // Generate baseline embeddings for each chunk (for FR-12)
    // Concurrency-controlled batch processing to prevent API burst limits
    const enrichedChunks: ChunkRecord[] = [];
    const BATCH_SIZE = 8;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const slice = chunks.slice(i, i + BATCH_SIZE);
      const batchEnriched = await Promise.all(
        slice.map(async (chunk) => {
          const embedding = await generateTextEmbedding(chunk.text);
          return {
            ...chunk,
            embedding
          };
        })
      );
      enrichedChunks.push(...batchEnriched);
    }

    // Index into Moss
    await indexDocumentInMoss(sessionId, enrichedChunks);

    // Store session state in Redis (Externalize session state)
    const { createRedisSession } = await import('@/lib/redis');
    await createRedisSession(sessionId, meta, enrichedChunks);

    return NextResponse.json({
      success: true,
      sessionId,
      documentMeta: meta,
      chunks: enrichedChunks,
      documentFullText: fullText
    });
  } catch (err: unknown) {
    console.error('Session creation error:', err);
    const message = err instanceof Error ? err.message : 'Failed to process document.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
