/**
 * character.ts — the Arty character system.
 *
 * Four families, one character. A household's Arty can be a spaniel, a
 * concierge, a visitor or an orb, but they are different expressions of the
 * same assistant, not four avatars. Three things enforce that:
 *
 *   ONE STATE MODEL. Every family renders the same seven states from the same
 *   posture numbers. The spaniel's ears rise; the visitor's antennae rise; the
 *   concierge leans in; the orb contracts and gains a halo. Different anatomy,
 *   identical meaning.
 *
 *   ONE BRAND LANGUAGE. The same eye shape (the orb expresses it as light),
 *   the same small "A" mark, the same warm palette, and the same listening
 *   ring with the same timing on every family.
 *
 *   ONE HOUSEHOLD ARTY. The profile belongs to the household, not a person.
 *   Changing it changes appearance and nothing else — Arty's knowledge is not
 *   stored anywhere near this file.
 */

import type { CharacterState } from "./intent";

// MARK: - Families

export type ArtyCharacterFamily = "companion" | "concierge" | "visitor" | "essence";

/**
 * The one registry. Every screen resolves name, description, voice and accent
 * pairing from here via the household's characterId — never from scattered
 * per-component tables, and never `if (family === "companion")` in a view.
 *
 * voiceId is a LOGICAL id. The server maps it to a real provider voice via
 * environment configuration (ELEVENLABS_VOICE_COMPANION and friends), so a
 * real voice can be assigned per character later without touching any UI
 * logic — and no provider id or key ever appears in this bundle.
 */
export interface ArtyCharacterProfileConfig {
  id: ArtyCharacterFamily;
  name: string;
  description: string;
  voiceId: string;
  /** The character's own accent pairing (§brand); user accent still applies. */
  accentPair: { primary: string; secondary: string };
}

export const ARTY_CHARACTERS: Record<ArtyCharacterFamily, ArtyCharacterProfileConfig> = {
  companion: {
    id: "companion",
    name: "Companion",
    description: "Warm, loyal and always keeping an eye on things.",
    voiceId: "ARTY_VOICE_COMPANION",
    accentPair: { primary: "#C89A6B", secondary: "#4E7BFF" },
  },
  concierge: {
    id: "concierge",
    name: "Concierge",
    description: "Calm, capable and quietly organised.",
    voiceId: "ARTY_VOICE_CONCIERGE",
    accentPair: { primary: "#182230", secondary: "#FF766D" },
  },
  visitor: {
    id: "visitor",
    name: "Visitor",
    description: "Curious, clever and always paying attention.",
    voiceId: "ARTY_VOICE_VISITOR",
    accentPair: { primary: "#66D6A3", secondary: "#A98BFF" },
  },
  essence: {
    id: "essence",
    name: "Essence",
    description: "Simple, quiet and always there when you need it.",
    voiceId: "ARTY_VOICE_ESSENCE",
    accentPair: { primary: "#4E7BFF", secondary: "#FFD84D" },
  },
};

export function characterProfile(family: ArtyCharacterFamily): ArtyCharacterProfileConfig {
  return ARTY_CHARACTERS[family];
}

/** The canonical resolution: characterId -> voiceId. Nothing else decides. */
export function voiceIdFor(family: ArtyCharacterFamily): string {
  return ARTY_CHARACTERS[family].voiceId;
}

export const FAMILY_ORDER: ArtyCharacterFamily[] = [
  "companion",
  "concierge",
  "visitor",
  "essence",
];

// MARK: - Accents
//
// One lightweight choice, from a curated palette. Not a character creator:
// no sliders, no outfits, no unlocks.

export type ArtyAccent = "navy" | "forest" | "terracotta" | "plum" | "sand";

export const ACCENTS: { id: ArtyAccent; name: string; hex: string }[] = [
  { id: "navy", name: "Navy", hex: "#33445C" },
  { id: "forest", name: "Forest", hex: "#3E5C46" },
  { id: "terracotta", name: "Terracotta", hex: "#A65A3F" },
  { id: "plum", name: "Plum", hex: "#7A3B45" },
  { id: "sand", name: "Sand", hex: "#B08D4F" },
];

export function accentHex(accent: ArtyAccent): string {
  return ACCENTS.find((entry) => entry.id === accent)?.hex ?? "#7A3B45";
}

// MARK: - The household profile
//
// One home. One Arty. This is household state, never per-adult state, and
// when household cloud sync exists this syncs with the rest of it.

export interface HouseholdArtyProfile {
  family: ArtyCharacterFamily;
  accent: ArtyAccent;
  createdAt: string;
  updatedAt: string;
}

export function defaultArtyProfile(now = new Date()): HouseholdArtyProfile {
  return { family: "companion", accent: "plum", createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

// MARK: - Shared material language
//
// Warm off-white, charcoal/deep navy, restrained brass. Every family draws
// from this table so no option can drift into another brand.

export const MATERIAL = {
  warmLight: "#F7ECDD",
  warmMid: "#E7CFB2",
  warmShade: "#CBAA85",
  charcoal: "#333F4C",
  charcoalDeep: "#26303A",
  ink: "#2E2A2E",
  soft: "#3A3238",
  brass: "#B08D4F",
  paper: "#FAF7F2",
} as const;

// MARK: - Behavioural DNA
//
// The same posture table drives every family. This mirrors ArtyState.swift's
// ArtyPosture exactly: plain numbers, no animation code, so a future renderer
// in any technology interprets the same state machine.

export interface Posture {
  headTilt: number;
  /** Ears, antennae, or the orb's halo. -1 flat, +1 fully raised. */
  earLift: number;
  /** Tail, hands, or the orb's inner glow. 0 still, 1 delighted. */
  tailWag: number;
  /** 0 upright, 1 leaning towards the person. The orb contracts instead. */
  lean: number;
  eyeOpen: number;
  browLift: number;
  mouthOpen: number;
  /** Degrees of gentle sway while thinking; the orb rotates instead. */
  sway: number;
}

export const POSTURES: Record<CharacterState, Posture> = {
  idle: { headTilt: 0, earLift: 0, tailWag: 0.12, lean: 0, eyeOpen: 1, browLift: 0, mouthOpen: 0, sway: 0 },
  listening: { headTilt: 6, earLift: 0.85, tailWag: 0.25, lean: 0.7, eyeOpen: 1.05, browLift: 0.3, mouthOpen: 0, sway: 0 },
  thinking: { headTilt: 11, earLift: 0.15, tailWag: 0.05, lean: 0.15, eyeOpen: 0.8, browLift: -0.15, mouthOpen: 0, sway: 3 },
  speaking: { headTilt: 2, earLift: 0.4, tailWag: 0.35, lean: 0.35, eyeOpen: 1, browLift: 0.1, mouthOpen: 0.55, sway: 0 },
  confirming: { headTilt: -3, earLift: 0.55, tailWag: 0.75, lean: 0.25, eyeOpen: 0.95, browLift: 0.25, mouthOpen: 0, sway: 0 },
  alert: { headTilt: 0, earLift: 1, tailWag: 0, lean: 0.5, eyeOpen: 1.1, browLift: -0.4, mouthOpen: 0, sway: 0 },
  pleased: { headTilt: -6, earLift: 0.6, tailWag: 1, lean: 0.2, eyeOpen: 0.7, browLift: 0.4, mouthOpen: 0.25, sway: 0 },
};

/**
 * The words VoiceOver hears. State is never conveyed by the drawing alone,
 * whichever family is rendering it.
 */
export const STATE_DESCRIPTIONS: Record<CharacterState, string> = {
  idle: "Arty is waiting",
  listening: "Arty is listening",
  thinking: "Arty is thinking",
  speaking: "Arty is answering",
  confirming: "Arty has understood",
  alert: "Arty has something to flag",
  pleased: "Arty is pleased",
};

/** Level feeds the listening pose exactly the same way in every family. */
export function withLevel(state: CharacterState, level: number): Posture {
  const base = POSTURES[state];
  if (state !== "listening") return base;
  return {
    ...base,
    earLift: Math.min(base.earLift + level * 0.2, 1.2),
    headTilt: base.headTilt + level * 3,
  };
}

/** One spring for every family, so nothing moves like a different product. */
export const SPRING = { type: "spring" as const, stiffness: 260, damping: 22 };

/** The listening ring's timing is a brand signature. Never per-family. */
export const LISTENING_RING = { duration: 1.6, scaleFrom: 0.94, scaleTo: 1.04, opacity: 0.5 };
