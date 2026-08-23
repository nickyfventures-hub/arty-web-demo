/**
 * notifications.ts — Arty's job is to reduce noise, not to relay it.
 *
 * A household organiser that emits one notification per underlying event is
 * worse than no organiser, because a family learns to ignore it. The rule here
 * is that a DAY gets a notification, not an EVENT: everything worth knowing
 * about tomorrow is composed into one line, once.
 *
 * "Arty only interrupts when it's useful" is a claim about this file.
 */

import type { Recurrence } from "./temporal.ts";
import { daysBetween, isoDate, nextOccurrence, startOfDay } from "./temporal.ts";

export type Appetite = "essential" | "balanced" | "everything";

export interface Candidate {
  /** Stable across runs. Two runs of the same day must produce the same key. */
  key: string;
  title: string;
  /** What Arty would say about this one thing. */
  line: string;
  when: Date;
  /** 0–1. Anything the household cannot act on scores low by definition. */
  importance: number;
  actionable: boolean;
  /** Adults-only items never reach a child's device. */
  visibility: "household" | "adults_only";
}

export interface Delivery {
  /** One notification, however many candidates fed it. */
  id: string;
  body: string;
  scheduledFor: Date;
  /** The candidate keys folded into this delivery, for the dedup ledger. */
  covers: string[];
}

export interface NotificationLedger {
  /** Candidate keys already delivered. Nothing is ever said twice. */
  delivered: string[];
  /** ISO dates on which a briefing has already gone out. */
  briefedOn: string[];
}

export function emptyLedger(): NotificationLedger {
  return { delivered: [], briefedOn: [] };
}

/** Below this importance, a candidate is not worth anybody's attention. */
const THRESHOLD: Record<Appetite, number> = {
  essential: 0.7,
  balanced: 0.4,
  everything: 0.15,
};

/** How many notifications a household may receive in a day, at most. */
const DAILY_CAP: Record<Appetite, number> = {
  essential: 1,
  balanced: 2,
  everything: 4,
};

/** Nothing is delivered inside these hours. Local time, inclusive of start. */
export const QUIET_HOURS = { from: 21, to: 7 };

export function inQuietHours(moment: Date): boolean {
  const hour = moment.getHours();
  return hour >= QUIET_HOURS.from || hour < QUIET_HOURS.to;
}

/** Moves a moment to the next time somebody would want to be spoken to. */
export function nextSpeakableMoment(moment: Date): Date {
  if (!inQuietHours(moment)) return moment;
  const shifted = new Date(moment);
  if (moment.getHours() >= QUIET_HOURS.from) {
    shifted.setDate(shifted.getDate() + 1);
  }
  shifted.setHours(QUIET_HOURS.to, 30, 0, 0);
  return shifted;
}

/**
 * Composes at most one notification from everything happening tomorrow.
 *
 * The bad version of this function returns four notifications for one swimming
 * lesson. This one returns a single line covering all of it, and records what
 * it covered so the same thing is never announced twice.
 */
export function composeBriefing(
  candidates: Candidate[],
  options: {
    now: Date;
    appetite: Appetite;
    ledger: NotificationLedger;
    visibility?: "household" | "adults_only";
  },
): { delivery: Delivery | null; ledger: NotificationLedger } {
  const { now, appetite, ledger } = options;
  const visibility = options.visibility ?? "adults_only";
  const today = isoDate(now);

  // One briefing per day, whatever else happens.
  if (ledger.briefedOn.includes(today)) {
    return { delivery: null, ledger };
  }

  const seen = new Set(ledger.delivered);
  const threshold = THRESHOLD[appetite];

  // Two candidates can describe the same underlying thing — a lesson and the
  // nag about the lesson. Folding them by key here is what turns four
  // notifications about one swimming lesson into one line about it.
  const byKey = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const existing = byKey.get(candidate.key);
    if (!existing || candidate.importance > existing.importance) {
      byKey.set(candidate.key, candidate);
    }
  }

  const worthSaying = [...byKey.values()]
    .filter((candidate) => !seen.has(candidate.key))
    .filter((candidate) => visibility === "adults_only" || candidate.visibility === "household")
    .filter((candidate) => candidate.importance >= threshold)
    // "Only important things" means exactly that: if you cannot act on it, it
    // is not an interruption, it is a fact for the Plan screen.
    .filter((candidate) => appetite !== "essential" || candidate.actionable)
    .sort((a, b) => b.importance - a.importance || a.when.getTime() - b.when.getTime());

  if (worthSaying.length === 0) {
    return { delivery: null, ledger };
  }

  const included = worthSaying.slice(0, DAILY_CAP[appetite] === 1 ? 3 : 4);

  return {
    delivery: {
      id: `briefing-${today}`,
      body: joinLines(included.map((candidate) => candidate.line)),
      scheduledFor: nextSpeakableMoment(now),
      covers: included.map((candidate) => candidate.key),
    },
    ledger: {
      delivered: [...ledger.delivered, ...included.map((candidate) => candidate.key)],
      briefedOn: [...ledger.briefedOn, today],
    },
  };
}

function joinLines(lines: string[]): string {
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0];
  const head = lines.slice(0, -1).join(" ");
  return `${head} ${lines[lines.length - 1]}`;
}

/**
 * Turns a due thing into a candidate, scoring it honestly.
 *
 * Importance is derived, never authored, so the same event always scores the
 * same and a test can pin it.
 */
export function candidateFor(input: {
  key: string;
  title: string;
  line: string;
  recurrence: Recurrence;
  now: Date;
  actionable?: boolean;
  visibility?: "household" | "adults_only";
  /** Renewals and deadlines matter more as they approach. */
  deadline?: boolean;
}): Candidate | null {
  const when = nextOccurrence(input.recurrence, input.now);
  if (!when) return null;

  const days = daysBetween(startOfDay(input.now), startOfDay(when));
  let importance: number;

  if (days < 0) importance = 0;
  else if (days === 0) importance = 0.9;
  else if (days === 1) importance = 0.8;
  else if (input.deadline && days <= 30) importance = 0.75;
  else if (days <= 7) importance = 0.5;
  else importance = 0.2;

  return {
    key: input.key,
    title: input.title,
    line: input.line,
    when,
    importance,
    actionable: input.actionable ?? true,
    visibility: input.visibility ?? "household",
  };
}
