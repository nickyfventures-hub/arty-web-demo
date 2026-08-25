/**
 * fixtures.ts
 *
 * The TypeScript half of the shared demo household. This is a deliberate mirror
 * of DemoHouseholdBuilder in the native app: the same JSON, the same relative
 * schedules, the same resulting household.
 *
 * Run `node scripts/sync-shared.mjs` after editing /shared.
 */

import fixturesJson from "./demo-fixtures.json";
import copyJson from "./copy.json";

export const copy = copyJson;
export const fixtures = fixturesJson;

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export type Role = "owner" | "adult" | "child";

export interface Member {
  id: string;
  name: string;
  role: Role;
  descriptor: string;
  colorToken: string;
  ageYears?: number;
}

export interface HouseholdEvent {
  id: string;
  fixtureId: string;
  title: string;
  memberId?: string;
  kind: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location: string;
  leaveAt?: Date;
  bring: string[];
  notes: string;
}

export interface ListItem {
  id: string;
  text: string;
  checked: boolean;
  addedByMemberId?: string;
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  body: string;
  action: string;
  acceptedResponse: string;
  kind: string;
  source: string;
  date?: Date;
  adultOnly: boolean;
}

export interface Meal {
  date: Date;
  title: string;
  suggestion: string;
  missingIngredients: string[];
}

export interface Household {
  name: string;
  surname: string;
  members: Member[];
}

export interface Snapshot {
  household: Household;
  events: HouseholdEvent[];
  items: ListItem[];
  insights: Insight[];
  meals: Meal[];
  memories: string[];
}

// MARK: - Date helpers

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[date.getDay()];
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function wholeDaysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function atTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const copy = startOfDay(day);
  copy.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return copy;
}

/** "10:00" — 24 hour, to match the household's own calendar. */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "14 October" */
export function formatDayAndMonth(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

/** "Saturday, 22 August" */
export function formatLongDay(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function countdown(days: number): string {
  if (days < 0) return "Passed";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

export function capitalise(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

export function lowerFirst(text: string): string {
  return text.length === 0 ? text : text[0].toLowerCase() + text.slice(1);
}

// MARK: - Materialisation

interface FixtureSchedule {
  kind: string;
  weekday?: Weekday;
  month?: number;
  day?: number;
  offset?: number;
}

function nextOccurrence(month: number, day: number, after: Date): Date {
  const today = startOfDay(after);
  const candidate = new Date(today.getFullYear(), month - 1, day);
  if (candidate.getTime() >= today.getTime()) return candidate;
  return new Date(today.getFullYear() + 1, month - 1, day);
}

function occurrences(schedule: FixtureSchedule, now: Date): Date[] {
  const today = startOfDay(now);
  switch (schedule.kind) {
    case "weekly": {
      const dates: Date[] = [];
      for (let offset = -7; offset <= 45; offset += 1) {
        const day = addDays(today, offset);
        if (weekdayOf(day) === schedule.weekday) dates.push(day);
      }
      return dates;
    }
    case "annual":
      return [nextOccurrence(schedule.month ?? 1, schedule.day ?? 1, today)];
    case "relativeDay":
      return [addDays(today, schedule.offset ?? 0)];
    default:
      return [];
  }
}

export function buildSnapshot(now: Date = new Date(), scenarioId = "default"): Snapshot {
  const scenario =
    fixtures.scenarios.find((entry) => entry.id === scenarioId) ?? fixtures.scenarios[0];

  const excluded = new Set(scenario.excludeEventIds ?? []);
  const definitions = [
    ...fixtures.events.filter((event) => !excluded.has(event.id)),
    ...((scenario.extraEvents ?? []) as typeof fixtures.events),
  ];

  const events: HouseholdEvent[] = [];
  for (const definition of definitions) {
    for (const day of occurrences(definition.schedule as FixtureSchedule, now)) {
      const allDay = Boolean((definition as { allDay?: boolean }).allDay);
      const start = allDay ? startOfDay(day) : atTime(day, definition.startTime);
      const end = new Date(start.getTime() + (definition.durationMinutes ?? 0) * 60_000);
      events.push({
        id: `${definition.id}-${startOfDay(day).getTime()}`,
        fixtureId: definition.id,
        title: definition.title,
        memberId: definition.memberId ?? undefined,
        kind: definition.kind,
        start,
        end,
        allDay,
        location: definition.location ?? "",
        leaveAt: definition.leaveAt ? atTime(day, definition.leaveAt) : undefined,
        bring: definition.bring ?? [],
        notes: definition.notes ?? "",
      });
    }
  }
  events.sort((a, b) => a.start.getTime() - b.start.getTime());

  const meals: Meal[] = [];
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = addDays(startOfDay(now), offset);
    const meal = fixtures.meals.find((entry) => entry.weekday === weekdayOf(day));
    if (!meal) continue;
    meals.push({
      date: atTime(day, meal.time),
      title: meal.title,
      suggestion: meal.suggestion,
      missingIngredients: meal.missingIngredients,
    });
  }

  return {
    household: {
      name: fixtures.household.name,
      surname: fixtures.household.surname,
      members: fixtures.household.members as Member[],
    },
    events,
    items: fixtures.shopping.items.map((item) => ({
      id: item.id,
      text: item.text,
      checked: item.checked,
      addedByMemberId: item.addedByMemberId ?? undefined,
    })),
    insights: buildInsights(events, now, scenario.forceInsightIds ?? []),
    meals,
    memories: fixtures.memories.map((memory) => memory.text),
  };
}

function buildInsights(events: HouseholdEvent[], now: Date, forced: string[]): Insight[] {
  const built: Insight[] = [];

  for (const definition of fixtures.insights) {
    const related = events.find((event) => event.fixtureId === definition.relatedEventId);
    if (!related) continue;
    const days = wholeDaysBetween(now, related.start);
    const detail = definition.detailTemplate
      .replace("{days}", String(days))
      .replace("{date}", formatDayAndMonth(related.start))
      .replace("{weekday}", capitalise(weekdayOf(related.start)))
      .replace("{time}", formatTime(related.start));

    built.push({
      id: definition.id,
      title: definition.title,
      detail,
      body: definition.body,
      action: definition.action,
      acceptedResponse: definition.acceptedResponse,
      kind: definition.kind,
      source: definition.source,
      date: related.start,
      adultOnly: definition.source === "email",
    });
  }

  if (forced.length > 0) {
    built.sort((a, b) => Number(forced.includes(b.id)) - Number(forced.includes(a.id)));
  }
  return built;
}

export function memberById(snapshot: Snapshot, id?: string): Member | undefined {
  if (!id) return undefined;
  return snapshot.household.members.find((member) => member.id === id);
}

export function memberColour(token: string): string {
  // Token names are stored data and never change; the hues resolve here, so
  // the bright palette needed no migration. Each carries white initials at
  // >= 3:1 (chips are graphics, verified by check-contrast).
  switch (token) {
    case "artyTeal":
      return "#4064D0";
    case "artyPlum":
      return "#A94E48";
    case "artyAmber":
      return "#8A6420";
    case "artySage":
      return "#39785C";
    default:
      return "#5A6273";
  }
}

export function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (partial, [key, value]) => partial.split(`{${key}}`).join(value),
    template,
  );
}
