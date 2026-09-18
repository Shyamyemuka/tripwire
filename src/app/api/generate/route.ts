import { NextRequest, NextResponse } from 'next/server';
import { streamAnswerGeneration } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { question, documentText } = await req.json();

    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Question cannot be empty.' }, { status: 400 });
    }

    if (!documentText || !documentText.trim()) {
      return NextResponse.json({ error: 'Document context is missing.' }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const tokenGenerator = streamAnswerGeneration(question, documentText);

          for await (const token of tokenGenerator) {
            const payload = JSON.stringify({ token });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (err: unknown) {
          console.error('Streaming generation error:', err);
          const message = err instanceof Error ? err.message : 'Generation failed.';
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
