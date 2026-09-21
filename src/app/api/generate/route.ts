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

          for await (let token of tokenGenerator) {
            // Adversarial Stress-Test Injection: If stress test mode is enabled, deliberately inject a subtle hallucination
            if (isStressTestMode) {
              if (token.includes('increased')) token = token.replace('increased', 'decreased significantly');
              else if (token.includes('grew')) token = token.replace('grew', 'declined sharply');
              else if (token.includes('rose')) token = token.replace('rose', 'fell by 40%');
              else if (token.includes('10%')) token = token.replace('10%', '85%');
              else if (token.includes('$45 million')) token = token.replace('$45 million', '$2.1 million');
            }

            const payload = JSON.stringify({ token });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
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
