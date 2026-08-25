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

/**
 * Clients send a LOGICAL voice id — the character's, from the one registry.
 * Only these are accepted; each maps to its own env variable so a real
 * provider voice can be assigned per character without a code change. Unset
 * variables fall through to the household default, then the stock voice.
 */
const CHARACTER_VOICES: Record<string, string | undefined> = {
  ARTY_VOICE_COMPANION: process.env.ELEVENLABS_VOICE_COMPANION,
  ARTY_VOICE_CONCIERGE: process.env.ELEVENLABS_VOICE_CONCIERGE,
  ARTY_VOICE_VISITOR: process.env.ELEVENLABS_VOICE_VISITOR,
  ARTY_VOICE_ESSENCE: process.env.ELEVENLABS_VOICE_ESSENCE,
};

function resolveVoice(logical: unknown): string {
  const configured =
    typeof logical === "string" ? CHARACTER_VOICES[logical]?.trim() : undefined;
  return configured || process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE;
}

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
  let voice: unknown;
  try {
    ({ text, voice } = await request.json());
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (typeof text !== "string" || text.length === 0 || text.length > 600) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const resolved = resolveVoice(voice);

  try {
    const upstream = await fetch(`${API}/text-to-speech/${resolved}?output_format=mp3_44100_64`, {
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
