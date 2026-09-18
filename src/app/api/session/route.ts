import { NextRequest, NextResponse } from 'next/server';
import { chunkDocument, chunkPlainText } from '@/lib/chunker';
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
      const file = formData.get('file') as File | null;
      const rawText = (formData.get('text') as string | null) || '';

      if (file) {
        const filename = file.name;
        const buffer = Buffer.from(await file.arrayBuffer());

        if (filename.toLowerCase().endsWith('.pdf')) {
          const pages = await extractTextFromPdf(buffer);
          chunkResult = chunkDocument(filename, pages);
          fullText = pages.map(p => p.text).join('\n\n');
        } else if (filename.toLowerCase().endsWith('.txt') || filename.toLowerCase().endsWith('.md')) {
          const text = buffer.toString('utf-8');
          chunkResult = chunkPlainText(text, filename);
          fullText = text;
        } else {
          return NextResponse.json(
            { error: 'Unsupported file type. Please upload a PDF or plain text file (.txt).' },
            { status: 400 }
          );
        }
      } else if (rawText.trim()) {
        chunkResult = chunkPlainText(rawText, 'pasted-text.txt');
        fullText = rawText;
      } else {
        return NextResponse.json(
          { error: 'No file or text content provided.' },
          { status: 400 }
        );
      }
    } else {
      // JSON body with pasted text
      const body = await req.json();
      const text = body.text || '';
      const filename = body.filename || 'pasted-text.txt';

      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          { error: 'Pasted text is empty.' },
          { status: 400 }
        );
      }

      chunkResult = chunkPlainText(text, filename);
      fullText = text;
    }

    const { chunks, meta } = chunkResult;

    // Generate baseline embeddings for each chunk (for FR-12)
    // Batch processing to keep indexing fast
    const enrichedChunks: ChunkRecord[] = await Promise.all(
      chunks.map(async (chunk) => {
        const embedding = await generateTextEmbedding(chunk.text);
        return {
          ...chunk,
          embedding
        };
      })
    );

    // Index into Moss
    await indexDocumentInMoss(sessionId, enrichedChunks);

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
