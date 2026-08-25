"use client";

/**
 * MontageStep — the capability montage, performed by the Arty the household
 * just chose.
 *
 * Five natural sentences, one after another; each produces its object beside
 * the character; then everything collapses back into Arty under "Tell Arty
 * once." The choice of character was the previous step, so this doubles as
 * the first real demonstration that their Arty — the one they picked — is the
 * one doing the work.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calendar, Gift, Mail, ShoppingCart, Utensils, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import ArtyCharacter from "@/components/ArtyCharacter";
import { PrimaryButton, Reveal } from "@/components/ui";
import { copy } from "@/lib/fixtures";
import { track } from "@/lib/analytics";
import { useStore } from "@/lib/store";

const ICONS: Record<string, LucideIcon> = {
  gift: Gift,
  cart: ShoppingCart,
  calendar: Calendar,
  meal: Utensils,
  envelope: Mail,
};

const STEP_MS = 1900;

export default function MontageStep({ onNext }: { onNext: () => void }) {
  const { dispatch } = useStore();
  const reduceMotion = useReducedMotion();
  const lines = copy.montage.lines;

  /** -1 before the first line; lines.length means collapsed → headline. */
  const [stage, setStage] = useState(-1);
  const finished = stage >= lines.length;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const stepTime = reduceMotion ? 1100 : STEP_MS;

    lines.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          setStage(index);
          // The character speaks each line, then settles.
          dispatch({ type: "setCharacter", state: "speaking" });
          timers.push(
            setTimeout(() => dispatch({ type: "setCharacter", state: "confirming" }), stepTime * 0.45),
          );
        }, 400 + index * stepTime),
      );
    });

    timers.push(
      setTimeout(() => {
        setStage(lines.length);
        // The montage IS the tell-once and multi-intent demonstration.
        track("onboarding_tell_once_completed", {});
        track("onboarding_multi_intent_completed", {});
        dispatch({ type: "setCharacter", state: "pleased" });
      }, 400 + lines.length * stepTime + 300),
    );

    return () => timers.forEach(clearTimeout);
  }, [dispatch, lines, reduceMotion]);

  const { state } = useStore();

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pb-7 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="relative">
          <ArtyCharacter state={state.characterState} size={176} />

          {/* The objects appear around Arty, then collapse back into him */}
          <AnimatePresence>
            {!finished &&
              lines.slice(0, Math.max(stage + 1, 0)).map((line, index) => {
                const Icon = ICONS[line.icon] ?? Gift;
                const angle = -90 + index * (360 / lines.length);
                const radians = (angle * Math.PI) / 180;
                return (
                  <motion.span
                    key={line.icon}
                    className="absolute left-1/2 top-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted text-accent shadow-sm"
                    initial={{ x: -20, y: -20, scale: 0.4, opacity: 0 }}
                    animate={{
                      x: Math.cos(radians) * 104 - 20,
                      y: Math.sin(radians) * 92 - 20,
                      scale: 1,
                      opacity: 1,
                    }}
                    exit={{ x: -20, y: -20, scale: 0.3, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 230, damping: 20 }}
                  >
                    <Icon size={18} />
                  </motion.span>
                );
              })}
          </AnimatePresence>
        </div>

        <div className="min-h-[96px] w-full text-center">
          <AnimatePresence mode="wait">
            {!finished && stage >= 0 && (
              <motion.div
                key={stage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-1.5"
              >
                <p className="text-[18px] font-medium text-ink">&ldquo;{lines[stage].say}&rdquo;</p>
                <p className="text-[15px] font-medium text-accent">{lines[stage].show}</p>
              </motion.div>
            )}

            {finished && (
              <motion.div
                key="headline"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-2"
              >
                <h1 className="text-[32px] font-semibold text-ink">{copy.montage.headline}</h1>
                <p className="mx-auto max-w-[300px] text-[16px] leading-relaxed text-ink-secondary">
                  {copy.montage.subheading}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {finished && (
        <Reveal className="pt-4">
          <PrimaryButton onClick={onNext}>{copy.montage.continue}</PrimaryButton>
        </Reveal>
      )}
    </div>
  );
}
