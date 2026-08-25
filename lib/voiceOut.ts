"use client";

/**
 * voiceOut.ts — Arty speaks.
 *
 * A thin client for /api/speak. One availability probe per session; with no
 * key configured the hook is a silent no-op and nothing else changes, which
 * is what keeps the zero-configuration deploy working.
 *
 * iOS Safari will only play audio that traces back to a user gesture, so the
 * single shared <audio> element is unlocked on the first tap anywhere and
 * reused for every utterance after that.
 */

import { useCallback, useEffect, useRef, useState } from "react";

let cachedAvailability: boolean | null = null;

async function speakAvailable(): Promise<boolean> {
  if (cachedAvailability !== null) return cachedAvailability;
  try {
    const response = await fetch("/api/speak", { method: "GET" });
    const data = (await response.json()) as { available?: boolean };
    cachedAvailability = data.available === true;
  } catch {
    cachedAvailability = false;
  }
  return cachedAvailability;
}

export interface VoiceOut {
  /** False until the probe confirms a key is configured. */
  available: boolean;
  /** True while Arty's audio is actually playing. */
  speaking: boolean;
  /** Fetch and play one line. Resolves when playback ends or fails. */
  speak: (text: string, voiceId?: string) => Promise<void>;
  stop: () => void;
}

export function useSpeak(): VoiceOut {
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);
  const currentUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    speakAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });

    // Unlock the audio element inside the first genuine gesture, so later
    // programmatic playback is allowed on iOS.
    const unlock = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      const element = new Audio();
      element.muted = true;
      element.play().catch(() => {});
      audioRef.current = element;
    };
    window.addEventListener("touchend", unlock, { once: true, passive: true });
    window.addEventListener("click", unlock, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("touchend", unlock);
      window.removeEventListener("click", unlock);
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (currentUrl.current) {
      URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = null;
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, voiceId?: string) => {
      if (!(await speakAvailable())) return;
      try {
        const response = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // voiceId is the character's LOGICAL id; the server resolves it.
          body: JSON.stringify({ text, voice: voiceId }),
        });
        if (!response.ok || !response.headers.get("Content-Type")?.includes("audio")) return;

        const url = URL.createObjectURL(await response.blob());
        const element = audioRef.current ?? new Audio();
        audioRef.current = element;
        stop();
        currentUrl.current = url;
        element.muted = false;
        element.src = url;

        await new Promise<void>((resolve) => {
          element.onended = () => resolve();
          element.onerror = () => resolve();
          setSpeaking(true);
          element.play().catch(() => resolve());
        });
      } catch {
        /* silence is the graceful failure for a voice */
      } finally {
        setSpeaking(false);
        if (currentUrl.current) {
          URL.revokeObjectURL(currentUrl.current);
          currentUrl.current = null;
        }
      }
    },
    [stop],
  );

  return { available, speaking, speak, stop };
}
