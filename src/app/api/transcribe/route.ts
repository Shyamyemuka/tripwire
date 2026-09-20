import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

function getAvailableGeminiKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY
  ].filter((k): k is string => !!k && !k.startsWith('your_google_gemini'));
  return Array.from(new Set(keys));
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const mimeType = audioFile.type || 'audio/webm';

    // 1. If Deepgram API key is configured, use Deepgram Nova-2 for sub-100ms transcription
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramKey && !deepgramKey.startsWith('your_deepgram')) {
      try {
        const dgRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramKey}`,
            'Content-Type': mimeType,
          },
          body: arrayBuffer,
        });

        if (dgRes.ok) {
          const dgData = await dgRes.json();
          const transcript = dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
          if (transcript.trim()) {
            return NextResponse.json({ transcript: transcript.trim(), provider: 'deepgram' });
          }
        } else {
          console.warn('Deepgram returned non-200, falling back to Gemini:', await dgRes.text().catch(() => ''));
        }
      } catch (dgErr) {
        console.warn('Deepgram transcription request failed, falling back to Gemini:', dgErr);
      }
    }

    // 2. Fallback to Gemini Multimodal Audio Transcription
    const keys = getAvailableGeminiKeys();
    if (keys.length === 0) {
      return NextResponse.json({ error: 'Neither Deepgram nor Gemini API key is configured.' }, { status: 500 });
    }

    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    let lastError: unknown;

    for (let i = 0; i < keys.length; i++) {
      try {
        const client = new GoogleGenAI({ apiKey: keys[i] });
        const response = await client.models.generateContent({
          model: process.env.GEMINI_GENERATION_MODEL || 'gemini-2.5-flash',
          contents: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            'Accurately transcribe the spoken words in this audio into plain English text. Return ONLY the transcribed text with no preface, commentary, or punctuation wrappers.',
          ],
          config: {
            temperature: 0.0,
          },
        });

        const transcript = (response.text || '').trim();
        return NextResponse.json({ transcript, provider: 'gemini' });
      } catch (err) {
        lastError = err;
        console.warn(`[Transcribe Failover] Key #${i + 1} failed:`, err);
      }
    }

    throw lastError;
  } catch (err: unknown) {
    console.error('Audio transcription error:', err);
    const message = err instanceof Error ? err.message : 'Transcription failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
