import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSystemInstruction, DEFAULT_SETTINGS, PricingSettings } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const { offerText, settings } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    const genAI = new GoogleGenAI({ apiKey });
    const mergedSettings: PricingSettings = settings || DEFAULT_SETTINGS;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: offerText }] }],
      config: {
        systemInstruction: getSystemInstruction(mergedSettings),
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini');

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('Analyze error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to analyze job offer.' },
      { status: 500 }
    );
  }
}
