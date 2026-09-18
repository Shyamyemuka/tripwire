import { NextRequest, NextResponse } from 'next/server';
import { generateMismatchExplanation } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { sentence, matchedPassageText, status } = await req.json();

    if (!sentence || !matchedPassageText) {
      return NextResponse.json({ explanation: null }, { status: 400 });
    }

    if (status !== 'RED' && status !== 'AMBER') {
      return NextResponse.json({ explanation: null });
    }

    const explanation = await generateMismatchExplanation(
      sentence,
      matchedPassageText,
      status
    );

    return NextResponse.json({ explanation });
  } catch (err: unknown) {
    console.error('Explanation error:', err);
    // Fallback: Return null explanation without failing color status
    return NextResponse.json({ explanation: null });
  }
}
