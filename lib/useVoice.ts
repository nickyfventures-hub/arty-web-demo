"use client";

/**
 * useVoice
 *
 * A real microphone, with the scripted one behind it.
 *
 * Two independent things happen when somebody taps the microphone, and keeping
 * them independent is the whole point:
 *
 *   1. LEVEL starts flowing the moment the audio stream opens, straight from a
 *      Web Audio analyser. Arty's ears move because somebody is making a noise,
 *      not because a transcript arrived. This mirrors what the native app does
 *      with AVAudioEngine's tap, and it is why the character feels connected to
 *      a voice rather than to a text box.
 *   2. WORDS arrive later, from the Web Speech API, as interim results and then
 *      a final one.
 *
 * If speech recognition is unavailable — Firefox, an older browser, a locked
 * down device — capture still runs, Arty still reacts, and the caller's scripted
 * fallback supplies the words so a demo never dead-ends. If the microphone
 * itself is refused, typing works exactly the same, which is the rule the
 * native app follows too.
 *
 * ⚠ Where the audio goes. Chrome and Edge implement the Web Speech API by
 * sending audio to Google's servers. Safari uses Apple's. Neither is
 * on-device, and neither is Arty's. This is disclosed on /privacy, and it is
 * the single biggest reason the iPhone app is the real product: on iOS 26 the
 * same sentence is understood by a model running on the phone.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./store";

/** The vendor-prefixed constructor, without pulling in DOM lib typings. */
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechResultEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0: { transcript: string } };
  };
}

type RecognitionConstructor = new () => RecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceMode = "real" | "recorded" | "scripted";

// One probe per session: is the server-side transcriber configured?
let scribeAvailable: boolean | null = null;
async function transcribeAvailable(): Promise<boolean> {
  if (scribeAvailable !== null) return scribeAvailable;
  try {
    const response = await fetch("/api/transcribe", { method: "GET" });
    scribeAvailable = ((await response.json()) as { available?: boolean }).available === true;
  } catch {
    scribeAvailable = false;
  }
  return scribeAvailable;
}

export interface Voice {
  listening: boolean;
  partial: string;
  /** How the last session ran. Shown to the tester so they know which it was. */
  mode: VoiceMode;
  /** Null unless something went wrong in a way worth saying out loud. */
  problem: string | null;
  /** `fallback` is only used when real recognition is unavailable. */
  start: (fallback: string) => void;
  stop: () => void;
}

export function useVoice(onFinish: (text: string) => void): Voice {
  const { dispatch } = useStore();
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [mode, setMode] = useState<VoiceMode>("real");
  const [problem, setProblem] = useState<string | null>(null);

  const recognition = useRef<RecognitionLike | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settled = useRef(false);

  const teardown = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    recognition.current?.abort();
    recognition.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    audio.current?.close().catch(() => {});
    audio.current = null;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    teardown();
    setListening(false);
    dispatch({ type: "setMicLevel", level: 0 });
  }, [teardown, dispatch]);

  useEffect(() => () => teardown(), [teardown]);

  /** The scripted microphone, kept for browsers that cannot do the real one. */
  const runScripted = useCallback(
    (utterance: string) => {
      setMode("scripted");
      const words = utterance.split(" ");
      words.forEach((_, index) => {
        timers.current.push(
          setTimeout(
            () => {
              setPartial(words.slice(0, index + 1).join(" "));
              dispatch({ type: "setMicLevel", level: 0.25 + Math.random() * 0.5 });
            },
            160 + index * 110,
          ),
        );
      });
      timers.current.push(
        setTimeout(
          () => {
            dispatch({ type: "setMicLevel", level: 0 });
            dispatch({ type: "setCharacter", state: "thinking" });
            setListening(false);
            onFinish(utterance);
            setPartial("");
          },
          260 + words.length * 110,
        ),
      );
    },
    [dispatch, onFinish],
  );

  const start = useCallback(
    (fallback: string) => {
      // Before anything else, and before a single word has been recognised.
      dispatch({ type: "setCharacter", state: "listening" });
      setListening(true);
      setPartial("");
      setProblem(null);
      settled.current = false;

      const Recognition = recognitionConstructor();

      if (!navigator.mediaDevices?.getUserMedia) {
        runScripted(fallback);
        return;
      }

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((granted) => {
          stream.current = granted;

          // Level first. This is the part that makes the character feel alive,
          // and it works even when recognition does not.
          const Context =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const context = new Context();
          audio.current = context;
          const analyser = context.createAnalyser();
          analyser.fftSize = 512;
          context.createMediaStreamSource(granted).connect(analyser);
          const samples = new Uint8Array(analyser.frequencyBinCount);

          const tick = () => {
            analyser.getByteTimeDomainData(samples);
            let sum = 0;
            for (const sample of samples) {
              const centred = (sample - 128) / 128;
              sum += centred * centred;
            }
            // Root mean square, scaled so ordinary speech lands near the top
            // without clipping the whole time.
            const level = Math.min(1, Math.sqrt(sum / samples.length) * 3.2);
            dispatch({ type: "setMicLevel", level });
            frame.current = requestAnimationFrame(tick);
          };
          frame.current = requestAnimationFrame(tick);

          if (!Recognition) {
            // No recogniser in this browser. If the server-side transcriber
            // is configured, record the real words and send them up on stop;
            // otherwise fall back to the scripted example, and say so.
            void transcribeAvailable().then((canTranscribe) => {
              if (!canTranscribe || typeof MediaRecorder === "undefined") {
                setProblem("This browser can't transcribe speech, so Arty is using an example.");
                runScripted(fallback);
                return;
              }
              setMode("recorded");
              const capture = new MediaRecorder(granted);
              recorder.current = capture;
              const chunks: Blob[] = [];
              capture.ondataavailable = (event) => {
                if (event.data.size > 0) chunks.push(event.data);
              };
              capture.onstop = async () => {
                setPartial("");
                dispatch({ type: "setCharacter", state: "thinking" });
                try {
                  const response = await fetch("/api/transcribe", {
                    method: "POST",
                    body: new Blob(chunks, { type: capture.mimeType || "audio/webm" }),
                  });
                  const data = (await response.json()) as { text?: string };
                  const heard = data.text?.trim();
                  if (heard) {
                    onFinish(heard);
                  } else {
                    setProblem("I didn't catch that. Try again, or type instead.");
                    dispatch({ type: "setCharacter", state: "idle" });
                  }
                } catch {
                  setProblem("I couldn't reach transcription. Typing works exactly the same.");
                  dispatch({ type: "setCharacter", state: "idle" });
                }
              };
              capture.start();
            });
            return;
          }

          setMode("real");
          const engine = new Recognition();
          recognition.current = engine;
          engine.lang = "en-GB";
          engine.continuous = false;
          engine.interimResults = true;
          engine.maxAlternatives = 1;

          engine.onresult = (event) => {
            let text = "";
            for (let index = 0; index < event.results.length; index += 1) {
              text += event.results[index][0].transcript;
            }
            setPartial(text.trim());
          };

          engine.onerror = (event) => {
            if (event.error === "no-speech") {
              setProblem("I didn't hear anything. Try again, or type instead.");
            } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
              setProblem("Microphone access is off. Typing works exactly the same.");
            } else if (event.error !== "aborted") {
              setProblem("Speech recognition stopped. Typing works exactly the same.");
            }
          };

          // `onend` fires for success, silence and error alike, which makes it
          // the one honest place to settle the session exactly once.
          engine.onend = () => {
            if (settled.current) return;
            settled.current = true;
            const heard = partialRef.current.trim();
            stop();
            if (heard) {
              dispatch({ type: "setCharacter", state: "thinking" });
              onFinish(heard);
              setPartial("");
            } else {
              dispatch({ type: "setCharacter", state: "idle" });
            }
          };

          engine.start();
        })
        .catch(() => {
          // Refused, or no microphone at all. Say so, and carry on.
          setProblem("Microphone access is off. Typing works exactly the same.");
          runScripted(fallback);
        });
    },
    [dispatch, onFinish, runScripted, stop],
  );

  // `onend` reads the latest partial without re-creating the engine each render.
  const partialRef = useRef("");
  useEffect(() => {
    partialRef.current = partial;
  }, [partial]);

  return { listening, partial, mode, problem, start, stop };
}
