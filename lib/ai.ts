/**
 * ai.ts
 *
 * The client half of AI-powered understanding.
 *
 * Every function here tries the model first and falls back to the rules in
 * `intent.ts` if anything at all goes wrong — no key, rate limit, network,
 * a malformed answer. Onboarding must never dead-end because a model was
 * unavailable, so the fallback is the design rather than an afterthought.
 *
 * Mirrors IntelligenceRouter.swift in the native app.
 */

import { capitalise } from "./fixtures";

export type Role = "owner" | "adult" | "child";
export interface ExtractedMember {
  id: string;
  name: string;
  role: Role;
}
export interface ExtractedFact {
  name: string;
  lines: string[];
}

const COLOURS = ["artyTeal", "artyPlum", "artyAmber", "artySage"];

/** Whether the deployment has a key configured. Cached for the session. */
let availability: Promise<boolean> | null = null;

export function isAIAvailable(): Promise<boolean> {
  availability ??= fetch("/api/understand")
    .then((response) => response.json())
    .then((data: { available?: boolean }) => Boolean(data.available))
    .catch(() => false);
  return availability;
}

async function ask<T>(body: unknown): Promise<T | null> {
  try {
    const response = await fetch("/api/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.available ? (data as T) : null;
  } catch {
    return null;
  }
}

// MARK: - Who do you live with?

export async function extractMembers(
  text: string,
  ownerName: string,
  fallback: (text: string, ownerName: string) => ExtractedMember[],
): Promise<ExtractedMember[]> {
  const data = await ask<{ household: { people: { name: string; role: Role }[] } }>({
    kind: "household",
    text,
    ownerName,
  });

  if (!data) return fallback(text, ownerName);

  const members: ExtractedMember[] = [];
  if (ownerName) members.push({ id: ownerName.toLowerCase(), name: ownerName, role: "owner" });

  for (const person of data.household.people) {
    const name = person.name.trim();
    if (!name || name.length > 40) continue;
    if (name.toLowerCase() === ownerName.toLowerCase()) continue;
    if (members.some((member) => member.name.toLowerCase() === name.toLowerCase())) continue;
    members.push({ id: name.toLowerCase(), name, role: person.role === "child" ? "child" : "adult" });
  }

  // A model that found nobody is worse than the rules.
  if (members.length <= (ownerName ? 1 : 0)) return fallback(text, ownerName);
  return members;
}

// MARK: - Anything else that's useful?

export async function extractDetails(
  text: string,
  members: ExtractedMember[],
  fallback: (text: string, members: ExtractedMember[]) => ExtractedFact[],
): Promise<ExtractedFact[]> {
  const data = await ask<{
    details: { people: { name: string; lines: string[] }[]; householdFacts: string[] };
  }>({ kind: "details", text, knownNames: members.map((member) => member.name) });

  if (!data) return fallback(text, members);

  const facts: ExtractedFact[] = [];
  for (const detail of data.details.people) {
    const lines = detail.lines.map((line) => line.trim()).filter((line) => line && line.length < 60);
    if (lines.length === 0) continue;
    const member = members.find(
      (entry) => entry.name.toLowerCase() === detail.name.trim().toLowerCase(),
    );
    if (!member) continue;
    facts.push({ name: member.name, lines });
  }

  const householdLines = (data.details.householdFacts ?? [])
    .map((line) => line.trim())
    .filter((line) => line && line.length < 60);
  if (householdLines.length > 0) facts.push({ name: "Household", lines: householdLines });

  if (facts.length === 0) return fallback(text, members);
  return facts;
}

// MARK: - What did they just ask for?

export interface AIIntent {
  kind: string;
  items: string[];
  subject: string;
  dayOffset: number;
}

/**
 * Returns a sentence the rules engine will classify the way the model did, so
 * replies and effects stay on one code path whichever brain understood it.
 * Returns null when the model was unavailable or unsure.
 */
export async function canonicaliseUtterance(text: string): Promise<string | null> {
  const data = await ask<{ intent: AIIntent }>({ kind: "intent", text });
  if (!data) return null;

  const intent = data.intent;
  switch (intent.kind) {
    case "addToList": {
      const items = intent.items.map((item) => item.trim()).filter(Boolean).map(capitalise);
      return items.length > 0 ? `Add ${items.join(", ")}` : null;
    }
    case "createReminder":
      return intent.subject ? `Remind me to ${intent.subject}` : null;
    case "queryDay":
      return intent.dayOffset === 1 ? "What's happening tomorrow?" : "What's happening today?";
    case "queryWeek":
      return "What should I know this week?";
    case "queryShopping":
      return "What's on the shopping list?";
    case "queryFact":
      return intent.subject ? `When is ${intent.subject}?` : null;
    default:
      return null;
  }
}

export function memberColour(index: number): string {
  return COLOURS[index % COLOURS.length];
}
