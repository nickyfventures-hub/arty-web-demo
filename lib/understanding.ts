/**
 * understanding.ts — one sentence in, structured household changes out.
 *
 * This is where "No forms. No fiddling." either becomes true or does not.
 *
 * Two deliberate constraints:
 *
 * MULTI-INTENT IS THE POINT. "Sunny's got Ellie's party at 2 Saturday, we need
 * a present and don't let me forget the card" is one thing a parent says and
 * three things a household organiser has to do. Splitting that sentence is the
 * single clearest way Arty differs from an app where the same request is a
 * calendar form, a list screen and a reminder screen.
 *
 * DETERMINISTIC, AND UNDER THE MODEL. Everything here runs on rules and the
 * temporal engine. A language model may rewrite a messy sentence into a
 * cleaner one before it arrives (see lib/ai.ts), but the model never decides
 * what date something lands on and never invents a household fact. That keeps
 * one code path for everything with consequences, which is why the permission
 * tests and the recurrence tests stay meaningful whichever brain answered.
 */

import type { FactDraft, FactKind, HouseholdMemory } from "./memory.ts";
import { describeFact } from "./memory.ts";
import type { Recurrence, Weekday } from "./temporal.ts";
import {
  addDays,
  civil,
  daysUntilPhrase,
  describeRecurrence,
  isoDate,
  nextOccurrence,
  startOfDay,
} from "./temporal.ts";

// MARK: - Result

export interface EventDraft {
  title: string;
  subject?: string;
  recurrence: Recurrence;
  location?: string;
}

export interface ReminderDraft {
  body: string;
  /** Absent means "no particular time" — a nudge tied to the related event. */
  due?: Recurrence;
}

export interface Understanding {
  facts: FactDraft[];
  events: EventDraft[];
  shopping: string[];
  reminders: ReminderDraft[];
  /** A question about the household, to be answered from memory only. */
  question?: { subject: string; predicate: string; phrasing: string };
  /** Set when Arty should ask one short thing before committing. */
  clarification?: string;
  /** Nothing recognised. Arty must say so rather than improvise. */
  unhandled: boolean;
}

function empty(): Understanding {
  return { facts: [], events: [], shopping: [], reminders: [], unhandled: true };
}

// MARK: - Vocabulary

const WEEKDAYS: Record<string, Weekday> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, weds: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};

const LOW_STOCK = [
  "out of", "run out of", "running out of", "nearly out of", "almost out of",
  "we need", "we need to get", "add", "put on the list", "low on",
];

const REMINDER_TRIGGERS = [
  "don't let me forget", "dont let me forget", "remind me", "remember to",
  "make sure i", "don't forget", "dont forget",
];

// MARK: - Time parsing
//
// Everything returns a Recurrence, which is then handed to the temporal engine.
// Nothing here computes an actual date itself.

/** "at 2", "at 2pm", "at 10:30", "at 14:00". */
function parseTime(text: string): string | undefined {
  const match = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minutes = match[2] ?? "00";
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  // "at 2" about a family's day means the afternoon. Nobody has a birthday
  // party at two in the morning.
  if (!meridiem && hour >= 1 && hour <= 7) hour += 12;

  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

/**
 * Turns the time language in a sentence into a recurrence.
 * Returns null when there is no date language at all.
 */
export function parseWhen(text: string, now: Date): Recurrence | null {
  const lower = text.toLowerCase();
  const time = parseTime(lower);

  // "every other Wednesday" — checked before plain "every", which would match.
  const fortnightly = lower.match(/every\s+other\s+(\w+)/);
  if (fortnightly) {
    const weekday = WEEKDAYS[fortnightly[1]];
    if (weekday !== undefined) {
      // The anchor is the next such weekday, so "every other Wednesday from
      // now" means this coming one and then alternate weeks.
      const anchor = nextWeekday(now, weekday);
      return { kind: "fortnightly", weekday, anchor: isoDate(anchor), time };
    }
  }

  // "every Saturday", "Tuesdays and Thursdays", "every Tuesday and Thursday"
  const plural = [...lower.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s\b/g)];
  if (plural.length > 0) {
    const weekdays = [...new Set(plural.map((entry) => WEEKDAYS[entry[1]]))].sort() as Weekday[];
    return { kind: "weekly", weekdays, time };
  }

  if (/\bevery\b/.test(lower)) {
    const named = [...lower.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)];
    if (named.length > 0) {
      const weekdays = [...new Set(named.map((entry) => WEEKDAYS[entry[1]]))].sort() as Weekday[];
      return { kind: "weekly", weekdays, time };
    }
  }

  // "14 September", "September 14th", "14th of September"
  const dayMonth = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)\b/);
  if (dayMonth && MONTHS[dayMonth[2]]) {
    return { kind: "annual", month: MONTHS[dayMonth[2]], day: Number(dayMonth[1]), time };
  }
  const monthDay = lower.match(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthDay && MONTHS[monthDay[1]]) {
    return { kind: "annual", month: MONTHS[monthDay[1]], day: Number(monthDay[2]), time };
  }

  // "from 4 to 11 August"
  const range = lower.match(/from\s+(\d{1,2})(?:st|nd|rd|th)?\s+to\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/);
  if (range && MONTHS[range[3]]) {
    const month = MONTHS[range[3]];
    const year = now.getFullYear();
    return {
      kind: "range",
      from: isoDate(new Date(year, month - 1, Number(range[1]))),
      to: isoDate(new Date(year, month - 1, Number(range[2]))),
    };
  }

  if (/\btomorrow\b/.test(lower)) {
    return { kind: "once", date: isoDate(addDays(startOfDay(now), 1)), time };
  }
  if (/\btoday\b|\btonight\b/.test(lower)) {
    return { kind: "once", date: isoDate(startOfDay(now)), time };
  }

  // "Saturday", "this Saturday", "next Tuesday"
  const single = lower.match(/\b(?:this\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (single) {
    const weekday = WEEKDAYS[single[1]];
    const target = /next\s/.test(single[0]) ? nextWeekday(addDays(now, 7), weekday) : nextWeekday(now, weekday);
    return { kind: "once", date: isoDate(target), time };
  }

  return null;
}

function nextWeekday(from: Date, weekday: Weekday): Date {
  const start = startOfDay(from);
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = addDays(start, offset);
    if (day.getDay() === weekday) return day;
  }
  return start;
}

// MARK: - Interpretation

/**
 * Splits a sentence into every household change it implies.
 *
 * Order matters: questions first (they must never mutate anything), then
 * facts, then the clause-by-clause pass that produces events, list items and
 * reminders.
 */
export function interpret(text: string, now: Date, knownPeople: string[] = []): Understanding {
  const result = empty();
  const trimmed = text.trim();
  if (!trimmed) return result;
  const lower = trimmed.toLowerCase();

  // --- Questions. Read-only, always.
  const question = parseQuestion(trimmed);
  if (question) {
    result.question = question;
    result.unhandled = false;
    return result;
  }

  // --- Standing facts about people and the household.
  const fact = parseFact(trimmed, now);
  if (fact) {
    result.facts.push(fact.draft);
    result.unhandled = false;
    // "Sunny has swimming every Saturday at 10" is both a remembered routine
    // and something that should appear in the week.
    if (fact.alsoEvent) result.events.push(fact.alsoEvent);
    return result;
  }

  // --- A plain list, before the clause splitter gets hold of it.
  //
  // "Add milk, nappies and dishwasher tablets" is one intent whose items are
  // separated by exactly the punctuation that separates clauses elsewhere.
  // Splitting first would strand everything after the first comma. This only
  // applies when there is nothing else going on in the sentence, so the
  // multi-intent path below is untouched.
  const hasReminder = REMINDER_TRIGGERS.some((trigger) => lower.includes(trigger));
  if (!hasReminder && !parseWhen(trimmed, now)) {
    const wholeList = shoppingItems(trimmed);
    if (wholeList.length > 0) {
      result.shopping.push(...wholeList);
      result.unhandled = false;
      return result;
    }
  }

  // --- Clause by clause, for the multi-intent case.
  for (const clause of splitClauses(trimmed)) {
    const clauseLower = clause.toLowerCase();

    if (REMINDER_TRIGGERS.some((trigger) => clauseLower.includes(trigger))) {
      const body = reminderBody(clause);
      if (body) {
        result.reminders.push({ body, due: parseWhen(clause, now) ?? undefined });
        result.unhandled = false;
        continue;
      }
    }

    const items = shoppingItems(clause);
    if (items.length > 0) {
      result.shopping.push(...items);
      result.unhandled = false;
      continue;
    }

    const when = parseWhen(clause, now);
    if (when) {
      const title = eventTitle(clause);
      if (title) {
        result.events.push({
          title,
          subject: mentionedPerson(clause, knownPeople),
          recurrence: when,
          location: locationIn(clause),
        });
        result.unhandled = false;
      }
    }
  }

  // --- One short clarification, never a form.
  if (result.events.length === 1 && !result.events[0].subject && knownPeople.length > 1) {
    const bare = /^(swimming|nursery|school|dentist|doctor|party|club)\b/i.test(result.events[0].title);
    if (bare) result.clarification = `${knownPeople[0]}'s ${result.events[0].title.toLowerCase()}?`;
  }

  return result;
}

/** "and", "then", commas — the joins people actually use when they list things. */
function splitClauses(text: string): string[] {
  return text
    .split(/,\s*(?:and\s+)?|\s+and\s+(?=(?:we|i|don'?t|dont|remind|remember|make sure|get|add)\b)|\s*;\s*/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

// MARK: - Facts

interface ParsedFact {
  draft: FactDraft;
  alsoEvent?: EventDraft;
}

function parseFact(text: string, now: Date): ParsedFact | null {
  const lower = text.toLowerCase();

  // "Mum's birthday is 14 September", "Katie's birthday is on the 3rd of May"
  const birthday = text.match(/^(.+?)(?:'s|s')\s+(birthday|anniversary)\s+(?:is|are)\s+(?:on\s+)?(.+)$/i);
  if (birthday) {
    const when = parseWhen(birthday[3], now);
    if (when && when.kind === "annual") {
      return {
        draft: {
          subject: birthday[1].trim(),
          kind: birthday[2].toLowerCase() === "anniversary" ? "anniversary" : "birthday",
          predicate: birthday[2].toLowerCase(),
          value: describeRecurrence(when).replace(/^every /, ""),
          recurrence: when,
          source: "user",
          confidence: "confirmed",
        } as FactDraft,
      };
    }
  }

  // "Katie doesn't eat mushrooms", "Katie hates mushrooms", "Sunny won't eat peas"
  const dislike = text.match(
    /^(.+?)\s+(?:doesn'?t\s+(?:eat|like)|does\s+not\s+(?:eat|like)|hates|won'?t\s+eat|dislikes)\s+(.+)$/i,
  );
  if (dislike) {
    return {
      draft: {
        subject: dislike[1].trim(),
        kind: "mealPreference",
        predicate: "dislikes",
        value: dislike[2].trim().replace(/[.!]$/, ""),
        source: "user",
        confidence: "confirmed",
      } as FactDraft,
    };
  }

  // "Sunny has swimming every Saturday at 10", "Sunny goes to nursery Tuesdays and Thursdays"
  const routine = text.match(/^(.+?)\s+(?:has|goes to|does|is at)\s+(.+)$/i);
  if (routine) {
    const when = parseWhen(routine[2], now);
    if (when && (when.kind === "weekly" || when.kind === "fortnightly")) {
      const activity = stripWhen(routine[2]);
      return {
        draft: {
          subject: routine[1].trim(),
          kind: "routine",
          predicate: activity.toLowerCase(),
          value: `${activity} ${describeRecurrence(when)}`,
          recurrence: when,
          source: "user",
          confidence: "confirmed",
        } as FactDraft,
        alsoEvent: { title: activity, subject: routine[1].trim(), recurrence: when },
      };
    }
  }

  // "Bin day alternates every Wednesday", "the bins go out every other Wednesday"
  if (/\bbins?\b|\bbin day\b/.test(lower)) {
    const when = parseWhen(text, now);
    if (when) {
      return {
        draft: {
          subject: "household",
          kind: "routine",
          predicate: "bin day",
          value: `Bins ${describeRecurrence(when)}`,
          recurrence: when,
          source: "user",
          confidence: "confirmed",
        } as FactDraft,
        alsoEvent: { title: "Bins out", recurrence: when },
      };
    }
  }

  // "our car insurance renews in October", "the car insurance is due 14 October"
  const renewal = text.match(/^(?:our|the|my)?\s*(.+?)\s+(?:renews|is due|expires|runs out)\s+(?:in\s+|on\s+)?(.+)$/i);
  if (renewal) {
    const when = parseWhen(renewal[2], now);
    const monthOnly = MONTHS[renewal[2].trim().toLowerCase().replace(/[.!]$/, "")];
    if (when || monthOnly) {
      const recurrence: Recurrence | undefined = when ?? undefined;
      return {
        draft: {
          subject: renewal[1].trim(),
          kind: "renewal",
          predicate: "renewal",
          value: when ? describeRecurrence(when).replace(/^every /, "") : `sometime in ${renewal[2].trim()}`,
          recurrence,
          source: "user",
          // A month without a day is genuinely less certain, and saying so is
          // what lets a renewal email upgrade it later without an argument.
          confidence: when ? "confirmed" : "medium",
        } as FactDraft,
      };
    }
  }

  return null;
}

function stripWhen(text: string): string {
  return text
    .replace(/\b(every\s+other\s+\w+|every\s+\w+day|on\s+)/gi, "")
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/gi, "")
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, "")
    .replace(/\band\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,.]$/, "");
}

// MARK: - Questions

const QUESTION_PATTERNS: { pattern: RegExp; predicate: string }[] = [
  { pattern: /when(?:'s| is| are)\s+(.+?)(?:'s|s')\s+(birthday|anniversary)/i, predicate: "$2" },
  { pattern: /when does\s+(.+?)\s+(?:expire|renew|run out)/i, predicate: "renewal" },
  { pattern: /when(?:'s| is)\s+(.+?)\s+(?:due|renewal)/i, predicate: "renewal" },
  { pattern: /what does\s+(.+?)\s+(?:not eat|dislike|hate)/i, predicate: "dislikes" },
];

function parseQuestion(text: string): Understanding["question"] {
  if (!/\?|^\s*(when|what|who|where|does|is|are)\b/i.test(text)) return undefined;

  for (const { pattern, predicate } of QUESTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const resolved = predicate.startsWith("$")
        ? match[Number(predicate.slice(1))].toLowerCase()
        : predicate;
      return { subject: match[1].trim(), predicate: resolved, phrasing: text.trim() };
    }
  }

  // "when is my passport expiry", "who was our plumber"
  const possessive = text.match(/(?:my|our|the)\s+([a-z ]+?)\s*\??$/i);
  if (possessive) {
    return { subject: possessive[1].trim(), predicate: "renewal", phrasing: text.trim() };
  }
  return undefined;
}

// MARK: - Clause helpers

function shoppingItems(clause: string): string[] {
  const lower = clause.toLowerCase();
  const trigger = LOW_STOCK.find((phrase) => lower.includes(phrase));
  if (!trigger) return [];

  let remainder = lower.slice(lower.indexOf(trigger) + trigger.length);
  remainder = remainder
    .replace(/^\s*(to\s+get|to\s+buy|some|any|more|a|an|the)\b/g, "")
    .replace(/\b(to the list|on the list|from the shop|at the shops)\b/g, "")
    .replace(/[.!?]/g, "")
    .trim();
  if (!remainder) return [];

  return remainder
    .split(/,|\band\b/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length < 40)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1));
}

function reminderBody(clause: string): string | null {
  let body = clause;
  for (const trigger of REMINDER_TRIGGERS) {
    const index = body.toLowerCase().indexOf(trigger);
    if (index !== -1) {
      body = body.slice(index + trigger.length);
      break;
    }
  }
  body = body.replace(/^\s*(about|to|the)\b/i, "").replace(/[.!?]$/, "").trim();
  if (!body) return null;
  return body.charAt(0).toUpperCase() + body.slice(1);
}

function eventTitle(clause: string): string | null {
  let title = clause
    .replace(/^\s*(we've got|we have|there's|there is|i've got|i have)\b/i, "")
    .replace(/\b(has|have|got|is|are)\b/i, " ")
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, "")
    .replace(/\b(this|next|every|other)\b/gi, "")
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/gi, "")
    .replace(/\b(today|tomorrow|tonight)\b/gi, "")
    .replace(/\bat\s+[A-Z][\w ]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,.]$/, "");
  if (title.length < 2) return null;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function locationIn(clause: string): string | undefined {
  const match = clause.match(/\bat\s+([A-Z][\w' ]+?)(?:\s+at\s+\d|,|$)/);
  return match ? match[1].trim() : undefined;
}

function mentionedPerson(clause: string, people: string[]): string | undefined {
  const lower = clause.toLowerCase();
  return people.find((person) => lower.includes(person.toLowerCase()));
}

// MARK: - Grounded answers
//
// The rule that matters most for trust: if it is not in memory, Arty says so.

export interface GroundedAnswer {
  text: string;
  /** False when Arty had to admit it does not know. Never a guess. */
  known: boolean;
  /** Where the answer came from, for "how do you know that?". */
  provenance?: string;
}

export function answerFromMemory(
  question: NonNullable<Understanding["question"]>,
  memory: HouseholdMemory,
  now: Date,
  visibility: "household" | "adults_only" = "adults_only",
): GroundedAnswer {
  const fact = memory.recall(question.subject, question.predicate, visibility);

  if (!fact) {
    // Deliberately not a plausible answer. This is the whole point.
    return {
      known: false,
      text: `I don't have ${question.subject}'s ${question.predicate} yet. Tell me and I'll remember it.`,
    };
  }

  const next = fact.recurrence ? nextOccurrence(fact.recurrence, now) : null;
  const when = next ? ` — ${daysUntilPhrase(next, now)}` : "";
  return {
    known: true,
    text: `${describeFact(fact, now)}${when}.`,
    provenance: fact.sourceReference
      ? `${fact.source}:${fact.sourceReference}`
      : fact.source,
  };
}

/** Used by the confirmation line: "Got it. Party at 2 Saturday, and …". */
export function summarise(understanding: Understanding, now: Date): string {
  const parts: string[] = [];

  for (const event of understanding.events) {
    const next = nextOccurrence(event.recurrence, now);
    const when =
      event.recurrence.kind === "weekly" || event.recurrence.kind === "fortnightly"
        ? describeRecurrence(event.recurrence)
        : next
          ? `${daysUntilPhrase(next, now)}`
          : "";
    parts.push(`${event.title}${when ? ` ${when}` : ""}`);
  }
  if (understanding.shopping.length > 0) {
    parts.push(`${listPhrase(understanding.shopping)} on the shopping list`);
  }
  for (const reminder of understanding.reminders) {
    parts.push(`a reminder about ${reminder.body.toLowerCase()}`);
  }
  return listPhrase(parts);
}

function listPhrase(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export const __testing = { parseTime, splitClauses, shoppingItems, eventTitle, civil };
