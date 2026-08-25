/**
 * /api/transcribe — better ears, via ElevenLabs Scribe.
 *
 * The browser's own recognition stays the default: it is instant and free.
 * This route exists for where it is weak — browsers without SpeechRecognition
 * at all, and accuracy-critical moments — using the same server-side
 * ElevenLabs key as /api/speak, so one key buys both directions of voice.
 *
 * The audio is transcribed and discarded. It is not stored, and errors log
 * their type rather than any content.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function key(): string | null {
  return process.env.ELEVENLABS_API_KEY?.trim() || null;
}

export async function GET() {
  return NextResponse.json({ available: key() !== null });
}

export async function POST(request: NextRequest) {
  const apiKey = key();
  if (!apiKey) {
    return NextResponse.json({ available: false, reason: "no-key" }, { status: 200 });
  }

  const audio = await request.blob();
  if (audio.size === 0 || audio.size > 8_000_000) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  try {
    const body = new FormData();
    body.append("file", audio, "utterance.webm");
    body.append("model_id", "scribe_v1");

    const upstream = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body,
    });

    if (!upstream.ok) {
      console.error(`[transcribe] upstream ${upstream.status}`);
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    const result = (await upstream.json()) as { text?: string };
    return NextResponse.json({ available: true, text: (result.text ?? "").trim() });
  } catch (error) {
    console.error(`[transcribe] ${error instanceof Error ? error.name : "error"}`);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
