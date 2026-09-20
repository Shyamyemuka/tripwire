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

    const keys = getAvailableGeminiKeys();
    if (keys.length === 0) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = audioFile.type || 'audio/webm';

    // Call Gemini with failover
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
        return NextResponse.json({ transcript });
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
