/**
 * /api/speak — Arty's voice, via ElevenLabs.
 *
 * The key lives here, server side, and never reaches the browser. With no key
 * configured, GET reports { available: false } and the app stays silent —
 * exactly the pattern /api/understand uses for the brain, so the prototype
 * deploys with zero configuration and comes alive when keys are added.
 *
 * The text spoken is Arty's own reply, never the person's words, and it is
 * not logged: errors record their type, not their content.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API = "https://api.elevenlabs.io/v1";
/** A calm default; override with ELEVENLABS_VOICE_ID in Railway. */
const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";

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

  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (typeof text !== "string" || text.length === 0 || text.length > 600) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const voice = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE;

  try {
    const upstream = await fetch(`${API}/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.55, similarity_boost: 0.7 },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      console.error(`[speak] upstream ${upstream.status}`);
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(`[speak] ${error instanceof Error ? error.name : "error"}`);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
