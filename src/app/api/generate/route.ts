import { NextRequest, NextResponse } from 'next/server';
import { streamAnswerGeneration, parseFriendlyErrorMessage } from '@/lib/gemini';

import { getRedisSession, updateRedisSession } from '@/lib/redis';

export async function POST(req: NextRequest) {
  try {
    const { question, documentText, sessionId, isStressTestMode } = await req.json();

    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Question cannot be empty.' }, { status: 400 });
    }

    if (!documentText || !documentText.trim()) {
      return NextResponse.json({ error: 'Document context is missing.' }, { status: 400 });
    }

    // Externalize session state: read from Redis to keep session alive, and create turn entry
    if (sessionId) {
      const session = await getRedisSession(sessionId);
      if (session) {
         // Optionally append a placeholder turn to be completed in client state sync
         session.qaTurns.push({
             turnId: `turn-${Date.now()}`,
             questionText: question,
             mode: 'moss',
             answerSentences: [],
             isStreaming: true
         });
         await updateRedisSession(sessionId, session);
      }
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const tokenGenerator = streamAnswerGeneration(question, documentText);

          let streamBuffer = '';
          const applyMutations = (text: string) => {
            return text
              .replace(/\bincreased\b/gi, 'decreased significantly')
              .replace(/\bgrew\b/gi, 'declined sharply')
              .replace(/\brose\b/gi, 'fell by 40%')
              .replace(/\b10%\b/g, '85%')
              .replace(/\$45\s*million\b/gi, '$2.1 million');
          };

          for await (const chunk of tokenGenerator) {
            if (!isStressTestMode) {
              const payload = JSON.stringify({ token: chunk });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
              continue;
            }

            streamBuffer += chunk;
            // Buffer until whitespace or punctuation boundary to ensure whole-word mutations
            const boundaryIdx = Math.max(
              streamBuffer.lastIndexOf(' '),
              streamBuffer.lastIndexOf('\n'),
              streamBuffer.lastIndexOf('.'),
              streamBuffer.lastIndexOf(',')
            );

            if (boundaryIdx !== -1) {
              const readyChunk = streamBuffer.slice(0, boundaryIdx + 1);
              streamBuffer = streamBuffer.slice(boundaryIdx + 1);
              const mutated = applyMutations(readyChunk);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: mutated })}\n\n`));
            }
          }

          // Flush any remaining buffered tokens at the end of the stream
          if (isStressTestMode && streamBuffer.length > 0) {
            const mutated = applyMutations(streamBuffer);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: mutated })}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (err: unknown) {
          console.error('Streaming generation error:', err);
          const message = parseFriendlyErrorMessage(err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    });
  } catch (err: unknown) {
    console.error('Generate route error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
