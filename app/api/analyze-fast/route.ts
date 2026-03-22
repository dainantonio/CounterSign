import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFastTriageInstruction, DEFAULT_SETTINGS, PricingSettings } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const { offerText, settings } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured.' }, { status: 500 });

    const genAI = new GoogleGenAI({ apiKey });
    const mergedSettings: PricingSettings = settings || DEFAULT_SETTINGS;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: offerText }] }],
      config: {
        systemInstruction: getFastTriageInstruction(mergedSettings),
        responseMimeType: 'application/json',
        // Smaller token budget = faster response
        maxOutputTokens: 600,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response');
    return NextResponse.json(JSON.parse(text));
  } catch (err: any) {
    const msg = err?.message || err?.toString() || 'Analysis failed.';
    console.error('analyze-fast error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
