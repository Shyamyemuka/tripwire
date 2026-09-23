import { NextRequest, NextResponse } from 'next/server';
import { streamAnswerGeneration, parseFriendlyErrorMessage } from '@/lib/gemini';

import { getRedisSession, updateRedisSession } from '@/lib/redis';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel for streaming generation

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
          const tokenGenerator = streamAnswerGeneration(question, documentText, isStressTestMode);

          let streamBuffer = '';
          const applyAdversarialMutations = (text: string) => {
            let mutated = text;

            // 1. Mutate any currency amounts ($, €, £, ¥, ₹, USD, EUR) e.g. "$48.2 million", "€150,000", "£45M"
            mutated = mutated.replace(/([$€£¥₹]|(?:USD|EUR|GBP)\s*)(\d+(?:[.,]\d+)?)\s*(billion|million|thousand|k|m|b)?\b/gi, (match, symbol, numStr, unit) => {
              const num = parseFloat(numStr.replace(/,/g, ''));
              if (isNaN(num)) return match;
              let fakeNum: string;
              if (num > 100) {
                fakeNum = (num * 0.28).toFixed(0);
              } else if (num > 10) {
                fakeNum = (num * 0.35).toFixed(1);
              } else {
                fakeNum = (num * 3.4).toFixed(1);
              }
              return `${symbol}${fakeNum}${unit ? ' ' + unit : ''}`;
            });

            // 2. Mutate percentages (e.g. "40%", "15.5%", "62 percent", "8.5 percentage points")
            mutated = mutated.replace(/\b(\d+(?:\.\d+)?)\s*(%|percent|percentage points)\b/gi, (match, numStr, unit) => {
              const num = parseFloat(numStr);
              if (isNaN(num)) return match;
              const fake = num > 50 ? (num - 35).toFixed(0) : (num + 42).toFixed(0);
              return `${fake} ${unit}`;
            });

            // 3. Cross-Domain Semantic Polarity Flips (Financial, Technical, Legal, Medical, Operational)
            const directionMap: [RegExp, string][] = [
              // Direction & Trend
              [/\bincreased\b/gi, 'decreased significantly'],
              [/\bincreasing\b/gi, 'decreasing'],
              [/\bincreases\b/gi, 'decreases'],
              [/\bincrease\b/gi, 'sharp decrease'],
              [/\bgrew\b/gi, 'declined sharply'],
              [/\bgrowth\b/gi, 'contraction'],
              [/\brose\b/gi, 'fell by 40%'],
              [/\brising\b/gi, 'falling'],
              [/\bhigher\b/gi, 'substantially lower'],
              [/\bhighest\b/gi, 'lowest'],
              [/\bimproved\b/gi, 'deteriorated'],
              [/\bimproving\b/gi, 'worsening'],
              [/\bimprovement\b/gi, 'decline'],
              [/\bpositive\b/gi, 'deeply negative'],
              // Financial & Performance
              [/\bprofitable\b/gi, 'unprofitable'],
              [/\bprofit\b/gi, 'net loss'],
              [/\bprofits\b/gi, 'losses'],
              [/\boperating income\b/gi, 'operating loss'],
              [/\bnet income\b/gi, 'net deficit'],
              [/\bexceeded\b/gi, 'fell far short of'],
              [/\bsurpassed\b/gi, 'missed'],
              [/\bmaintained\b/gi, 'slashed significantly'],
              [/\bmaintaining\b/gi, 'slashing'],
              [/\bexpanded\b/gi, 'shrank'],
              [/\baccelerated\b/gi, 'stagnated'],
              [/\bup by\b/gi, 'down by'],
              [/\boutperformed\b/gi, 'underperformed'],
              [/\bachieved\b/gi, 'failed to achieve'],
              [/\bstrong\b/gi, 'weak'],
              [/\bstrengthened\b/gi, 'weakened'],
              // Legal / Compliance / Contractual
              [/\bapproved\b/gi, 'rejected'],
              [/\bpermitted\b/gi, 'strictly prohibited'],
              [/\bmandatory\b/gi, 'optional'],
              [/\brequired\b/gi, 'not required'],
              [/\bcompliant\b/gi, 'non-compliant'],
              [/\beligible\b/gi, 'ineligible'],
              [/\bauthorized\b/gi, 'unauthorized'],
              [/\bguaranteed\b/gi, 'not guaranteed'],
              [/\bvalid\b/gi, 'invalid'],
              // Technical / Engineering / Software
              [/\bpassed\b/gi, 'failed'],
              [/\bsuccessfully\b/gi, 'unsuccessfully'],
              [/\bsuccessful\b/gi, 'unsuccessful'],
              [/\bsuccess\b/gi, 'failure'],
              [/\benabled\b/gi, 'disabled'],
              [/\bactive\b/gi, 'inactive'],
              [/\bcompatible\b/gi, 'incompatible'],
              [/\bsupported\b/gi, 'unsupported'],
              [/\bencrypted\b/gi, 'unencrypted'],
              [/\bsecure\b/gi, 'insecure'],
              // Medical / Scientific
              [/\beffective\b/gi, 'ineffective'],
              [/\bsafe\b/gi, 'hazardous'],
              [/\bpresent\b/gi, 'absent'],
              [/\bdetected\b/gi, 'undetected'],
              [/\baccurate\b/gi, 'inaccurate'],
              [/\bmajority\b/gi, 'minority']
            ];

            for (const [pattern, replacement] of directionMap) {
              mutated = mutated.replace(pattern, replacement);
            }

            // 4. Standalone integer quantities with units (e.g. "1,240 users", "18 incidents", "420 ms", "14 locations")
            if (mutated === text) {
              mutated = mutated.replace(/\b(\d{2,4})\b(?!\s*[-–]\s*\d{2,4})/g, (match, digits) => {
                const val = parseInt(digits, 10);
                if (val >= 2020 && val <= 2030) return match; // keep current calendar years unchanged
                return String(Math.floor(val * 0.38) || 14);
              });
            }

            return mutated;
          };

          for await (const chunk of tokenGenerator) {
            if (!isStressTestMode) {
              const payload = JSON.stringify({ token: chunk });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
              continue;
            }

            streamBuffer += chunk;
            // Buffer until sentence boundary (.?! followed by space or newline)
            // This ensures multi-word entities, decimals, and metric units are processed intact
            const match = streamBuffer.match(/([.?!]\s+|\n+)/);
            if (match && match.index !== undefined) {
              const cutIdx = match.index + match[0].length;
              const readyChunk = streamBuffer.slice(0, cutIdx);
              streamBuffer = streamBuffer.slice(cutIdx);
              const mutated = applyAdversarialMutations(readyChunk);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: mutated })}\n\n`));
            }
          }

          // Flush any remaining buffered tokens at the end of the stream
          if (isStressTestMode && streamBuffer.length > 0) {
            const mutated = applyAdversarialMutations(streamBuffer);
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
