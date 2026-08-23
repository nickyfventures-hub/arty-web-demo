"use client";

/**
 * CharacterStep — meeting the possible versions of your Arty.
 *
 * Not an avatar grid. One character at a time, prominently, gently animating
 * in idle; swipe or arrow between them; "Say hello" runs the real state
 * machine so the household feels the character before choosing it. One
 * lightweight secondary choice — the accent — and nothing else: no sliders,
 * no outfits, no unlocks.
 *
 * The intended reaction is "that's our Arty", not "I picked an avatar".
 */

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ArtyCharacter from "@/components/ArtyCharacter";
import { ArtySays, PrimaryButton, Reveal, SecondaryButton } from "@/components/ui";
import { track } from "@/lib/analytics";
import { ACCENTS, FAMILY_ORDER, type ArtyAccent, type ArtyCharacterFamily } from "@/lib/character";
import { copy } from "@/lib/fixtures";
import type { CharacterState } from "@/lib/intent";
import { useStore } from "@/lib/store";

/**
 * The picker itself, reused by Settings → Your Arty → Change Arty. Onboarding
 * and settings differ only in what happens after choosing.
 */
export function CharacterPicker({
  stage,
  onChosen,
}: {
  stage: "onboarding" | "settings";
  onChosen: (family: ArtyCharacterFamily, accent: ArtyAccent) => void;
}) {
  const { state } = useStore();
  const [index, setIndex] = useState(
    Math.max(FAMILY_ORDER.indexOf(state.artyProfile.family), 0),
  );
  const [accent, setAccent] = useState<ArtyAccent>(state.artyProfile.accent);
  const [previewState, setPreviewState] = useState<CharacterState>("idle");
  const [direction, setDirection] = useState(1);
  const previewTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const family = FAMILY_ORDER[index];
  const option = copy.character.options.find((entry) => entry.id === family);

  useEffect(() => {
    track("arty_character_picker_viewed", { onboarding_stage: stage });
    return () => previewTimers.current.forEach(clearTimeout);
  }, [stage]);

  const go = useCallback(
    (step: number) => {
      previewTimers.current.forEach(clearTimeout);
      setPreviewState("idle");
      setDirection(step);
      setIndex((current) => (current + step + FAMILY_ORDER.length) % FAMILY_ORDER.length);
    },
    [],
  );

  // Swipe between Arties. Buttons exist too, for keyboards and VoiceOver.
  const touchStart = useRef<number | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    touchStart.current = event.touches[0].clientX;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) > 48) go(delta < 0 ? 1 : -1);
  };

  /** The real state machine, briefly: listening, then speaking, then pleased. */
  const sayHello = () => {
    track("arty_character_previewed", { character_family: family, onboarding_stage: stage });
    previewTimers.current.forEach(clearTimeout);
    setPreviewState("listening");
    previewTimers.current = [
      setTimeout(() => setPreviewState("speaking"), 900),
      setTimeout(() => setPreviewState("pleased"), 2300),
      setTimeout(() => setPreviewState("idle"), 3400),
    ];
  };

  const speaking = previewState === "speaking" || previewState === "pleased";

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pb-7 pt-2">
      <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto">
        <Reveal className="space-y-2">
          <ArtySays lines={[copy.character.lead]} />
          <p className="text-[15px] text-ink-secondary">{copy.character.support}</p>
        </Reveal>

        {/* One Arty at a time, centre stage */}
        <div
          className="relative flex flex-col items-center"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex w-full items-center justify-between">
            <button
              onClick={() => go(-1)}
              aria-label="Previous Arty"
              className="flex h-11 w-11 items-center justify-center text-ink-secondary"
            >
              <ChevronLeft size={22} />
            </button>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={family}
                initial={{ opacity: 0, x: direction * 46 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -46 }}
                transition={{ duration: 0.24 }}
                className="flex flex-col items-center"
              >
                <ArtyCharacter family={family} accent={accent} state={previewState} size={196} />
              </motion.div>
            </AnimatePresence>

            <button
              onClick={() => go(1)}
              aria-label="Next Arty"
              className="flex h-11 w-11 items-center justify-center text-ink-secondary"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Which of the four, without counting swipes */}
          <div className="mt-1 flex gap-1.5" aria-hidden="true">
            {FAMILY_ORDER.map((entry) => (
              <span
                key={entry}
                className={`h-[6px] w-[6px] rounded-full transition ${entry === family ? "bg-accent" : "bg-hairline"}`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[86px] text-center">
          <h2 className="text-[24px] font-semibold text-ink">{option?.label}</h2>
          <p className="mx-auto mt-1 max-w-[300px] text-[15px] text-ink-secondary">
            {option?.subtext}
          </p>
          {speaking && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-[15px] font-medium text-accent"
            >
              &ldquo;{copy.character.helloLine}&rdquo;
            </motion.p>
          )}
          {previewState === "listening" && (
            <p className="mt-2 text-[13px] font-medium text-accent">{copy.assistant.listening}</p>
          )}
        </div>

        {/* The one secondary choice */}
        <div className="space-y-2">
          <p className="text-center text-[13px] font-medium text-ink-secondary">
            {copy.character.accentTitle}
          </p>
          <div className="flex justify-center gap-3">
            {ACCENTS.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setAccent(entry.id)}
                aria-label={`${entry.name} accent`}
                aria-pressed={accent === entry.id}
                className="flex h-11 w-11 items-center justify-center rounded-full"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 transition"
                  style={{
                    backgroundColor: entry.hex,
                    borderColor: accent === entry.id ? "#1C1B19" : "transparent",
                  }}
                >
                  {accent === entry.id && <Check size={14} className="text-white" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2.5 pt-4">
        <PrimaryButton onClick={() => onChosen(family, accent)}>
          {copy.character.choose}
        </PrimaryButton>
        <SecondaryButton onClick={sayHello}>{copy.character.sayHello}</SecondaryButton>
      </div>
    </div>
  );
}

/** The onboarding step: pick, then a brief "Meet your Arty" payoff. */
export default function CharacterStep({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useStore();
  const [chosen, setChosen] = useState(false);

  if (!chosen) {
    return (
      <CharacterPicker
        stage="onboarding"
        onChosen={(family, accent) => {
          dispatch({ type: "setArtyProfile", family, accent });
          dispatch({ type: "setCharacter", state: "pleased" });
          track("arty_character_selected", {
            character_family: family,
            accent,
            onboarding_stage: "onboarding",
          });
          setChosen(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-between px-6 pb-7 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <ArtyCharacter state={state.characterState} size={220} />
        <Reveal className="space-y-2 text-center">
          <h1 className="text-[30px] font-semibold text-ink">{copy.character.meetTitle}</h1>
          <p className="mx-auto max-w-[300px] text-[16px] leading-relaxed text-ink-secondary">
            {copy.character.meetBody}
          </p>
        </Reveal>
      </div>
      <Reveal delay={0.15} className="w-full">
        <PrimaryButton onClick={onNext}>{copy.montage.continue}</PrimaryButton>
      </Reveal>
    </div>
  );
}
