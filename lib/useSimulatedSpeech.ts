"use client";

/**
 * useSimulatedSpeech
 *
 * A scripted microphone.
 *
 * It emits levels and partial text on a believable cadence, which is what makes
 * Arty's ears feel connected to a voice. Real browser microphone access is
 * deliberately optional in this prototype — typing always works, and on iOS the
 * capture is genuine.
 *
 * The important behaviour it mirrors from the native app: the character reacts
 * on the tap, before a single word has been recognised.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./store";

export function useSimulatedSpeech(onFinish: (text: string) => void) {
  const { dispatch } = useStore();
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setListening(false);
    dispatch({ type: "setMicLevel", level: 0 });
  }, [dispatch]);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(
    (utterance: string) => {
      // Immediately, before anything else happens.
      dispatch({ type: "setCharacter", state: "listening" });
      setListening(true);
      setPartial("");

      const words = utterance.split(" ");
      words.forEach((_, index) => {
        timers.current.push(
          setTimeout(() => {
            dispatch({ type: "setMicLevel", level: 0.35 + ((index % 5) * 0.12) });
            setPartial(words.slice(0, index + 1).join(" "));
          }, index * 190),
        );
      });

      timers.current.push(
        setTimeout(
          () => {
            stop();
            setPartial("");
            onFinish(utterance);
          },
          words.length * 190 + 320,
        ),
      );
    },
    [dispatch, onFinish, stop],
  );

  return { listening, partial, start, stop };
}
