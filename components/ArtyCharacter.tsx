"use client";

/**
 * ArtyCharacter.tsx — the one way any screen draws Arty.
 *
 * Screens say "draw Arty in this state at this size". WHICH Arty appears is
 * resolved here, from the household's profile, and nowhere else. That is the
 * rule that makes the character system safe: no screen is wired to the
 * spaniel, so a household that chose the orb sees the orb on every surface —
 * onboarding, Plan, voice, empty states, alerts, child mode, settings.
 *
 * The `family`/`accent` props exist for exactly one caller: the picker, which
 * has to show Arties the household has not chosen. Nothing else should ever
 * pass them.
 *
 * All four families share the state machine, the eye shape, the "A" mark, the
 * material palette and the listening ring — see lib/character.ts for why.
 */

import { useContext } from "react";
import type { CharacterState } from "@/lib/intent";
import {
  accentHex,
  defaultArtyProfile,
  STATE_DESCRIPTIONS,
  withLevel,
  type ArtyAccent,
  type ArtyCharacterFamily,
} from "@/lib/character";
import { StoreContext } from "@/lib/store";
import { CharacterShell, useBlink } from "./characters/shared";
import Companion from "./characters/Companion";
import Concierge from "./characters/Concierge";
import Visitor from "./characters/Visitor";
import Essence from "./characters/Essence";

interface Props {
  state?: CharacterState;
  /** 0 to 1. Drives the small listening movements, exactly as on iOS. */
  level?: number;
  size?: number;
  className?: string;
  /** Picker only. Everyone else gets the household's Arty. */
  family?: ArtyCharacterFamily;
  /** Picker only. */
  accent?: ArtyAccent;
}

const FAMILIES: Record<
  ArtyCharacterFamily,
  React.ComponentType<{ posture: ReturnType<typeof withLevel>; blinking: boolean; accent: string }>
> = {
  companion: Companion,
  concierge: Concierge,
  visitor: Visitor,
  essence: Essence,
};

export default function ArtyCharacter({
  state = "idle",
  level = 0,
  size = 180,
  className,
  family,
  accent,
}: Props) {
  // Read the profile leniently: the character must render even outside the
  // store (a static page, a test harness) — it falls back to the default.
  const store = useContext(StoreContext);
  const profile = store?.state.artyProfile ?? defaultArtyProfile();

  const resolvedFamily = family ?? profile.family;
  const resolvedAccent = accentHex(accent ?? profile.accent);

  const blinking = useBlink();
  const posture = withLevel(state, level);
  const Body = FAMILIES[resolvedFamily];

  return (
    <CharacterShell
      size={size}
      className={className}
      label={`Arty. ${STATE_DESCRIPTIONS[state]}.`}
      listening={state === "listening"}
      accent={resolvedAccent}
    >
      <Body posture={posture} blinking={blinking} accent={resolvedAccent} />
    </CharacterShell>
  );
}
