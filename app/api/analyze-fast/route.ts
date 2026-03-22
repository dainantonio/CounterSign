import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getFastTriageInstruction, DEFAULT_SETTINGS, PricingSettings } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const { offerText, settings } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured.' }, { status: 500 });
    }

    const genAI = new GoogleGenAI({ apiKey });
    const mergedSettings: PricingSettings = settings || DEFAULT_SETTINGS;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: offerText }] }],
      config: {
        systemInstruction: getFastTriageInstruction(mergedSettings),
        responseMimeType: 'application/json',
        maxOutputTokens: 1500,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini');

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr: any) {
      console.error('analyze-fast parse error. Raw:', text.slice(0, 500));
      return NextResponse.json({ error: `JSON parse failed: ${parseErr.message}`, raw: text.slice(0, 500) }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    const detail = err?.message || err?.toString() || 'Unknown error';
    console.error('analyze-fast error:', detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
