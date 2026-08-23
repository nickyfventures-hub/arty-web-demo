/**
 * plan.ts
 *
 * The web mirror of PlanBuilder.swift: a calm read of a day, built from the
 * same snapshot the native app uses.
 */

import {
  Snapshot,
  HouseholdEvent,
  addDays,
  atTime,
  copy,
  countdown,
  fill,
  formatLongDay,
  formatTime,
  isSameDay,
  lowerFirst,
  startOfDay,
  weekdayOf,
  wholeDaysBetween,
  capitalise,
} from "./fixtures";

export type PlanStyle = "event" | "anchor" | "insight" | "meal";

export interface PlanItem {
  id: string;
  time: string;
  title: string;
  details: string[];
  style: PlanStyle;
  memberId?: string;
  action?: { title: string; kind: "findSomething" | "addIngredients" };
}

export interface WatchEntry {
  id: string;
  title: string;
  detail: string;
  adultOnly: boolean;
}

export interface PlanDay {
  date: Date;
  headline: string;
  items: PlanItem[];
  watchlist: WatchEntry[];
  commitmentCount: number;
}

export interface WeekRow {
  date: Date;
  weekday: string;
  parts: string[];
  notes: string[];
  busiest: boolean;
}

function visibleEvents(snapshot: Snapshot, role: "adult" | "child"): HouseholdEvent[] {
  if (role === "adult") return snapshot.events;
  return snapshot.events.filter((event) => event.kind !== "renewal");
}

export function buildDay(
  snapshot: Snapshot,
  offsetDays: number,
  now: Date,
  role: "adult" | "child" = "adult",
): PlanDay {
  const date = addDays(startOfDay(now), offsetDays);
  const events = visibleEvents(snapshot, role)
    .filter((event) => isSameDay(event.start, date) && !event.allDay)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const items: PlanItem[] = [];
  const weekday = weekdayOf(date);
  const isWeekend = weekday === "saturday" || weekday === "sunday";

  // Morning framing, when nothing real happens early.
  const firstMorning = events.find((event) => event.start.getHours() < 12);
  if (!firstMorning || firstMorning.start.getHours() >= 10) {
    items.push({
      id: "anchor-morning",
      time: formatTime(atTime(date, "09:00")),
      title: isWeekend ? "Easy morning" : "Quiet morning",
      details: [
        firstMorning
          ? `Nothing until ${formatTime(firstMorning.start)}`
          : isWeekend
            ? "No rush today."
            : "Nothing booked this morning.",
      ],
      style: "anchor",
    });
  }

  // Household routines the family already keeps, from the shared fixtures.
  for (const anchor of anchorsFor(date)) {
    const anchorDate = atTime(date, anchor.time);
    const collides = events.some(
      (event) => Math.abs(event.start.getTime() - anchorDate.getTime()) < 45 * 60_000,
    );
    if (collides) continue;
    items.push({
      id: anchor.id,
      time: formatTime(anchorDate),
      title: anchor.title,
      details: anchor.detail ? [anchor.detail] : [],
      style: "anchor",
    });
  }

  for (const event of events) {
    const details: string[] = [];
    if (event.leaveAt) details.push(`Leave around ${formatTime(event.leaveAt)}`);
    details.push(...event.bring);
    if (details.length === 0 && event.location) details.push(event.location);

    items.push({
      id: event.id,
      time: formatTime(event.start),
      title: event.title,
      details,
      style: "event",
      memberId: event.memberId,
    });
  }

  // Afternoon framing, and an honest offer of help.
  const afternoonBusy = events.some(
    (event) => event.start.getHours() >= 12 && event.start.getHours() < 17,
  );
  if (!afternoonBusy) {
    items.push({
      id: "anchor-afternoon",
      time: formatTime(atTime(date, "13:00")),
      title: "Afternoon",
      details: [copy.plan.looksFree],
      style: "anchor",
    });
    const count = snapshot.household.members.length;
    items.push({
      id: "insight-afternoon",
      time: formatTime(atTime(date, "13:01")),
      title: `The afternoon's free. Want some ideas for ${count >= 2 ? `the ${count} of you` : "you"}?`,
      details: [],
      style: "insight",
      action: { title: "Find something", kind: "findSomething" },
    });
  }

  const meal = snapshot.meals.find((entry) => isSameDay(entry.date, date));
  if (meal) {
    items.push({
      id: `meal-${offsetDays}`,
      time: formatTime(meal.date),
      title: "Dinner",
      details: [meal.title, meal.suggestion].filter(Boolean),
      style: "meal",
      action:
        meal.missingIngredients.length > 0
          ? { title: "Add missing ingredients", kind: "addIngredients" }
          : undefined,
    });
  }

  items.sort((a, b) => a.time.localeCompare(b.time));

  return {
    date,
    headline: headline(offsetDays, date, events.length),
    items,
    watchlist: buildWatchlist(snapshot, now, role),
    commitmentCount: events.length,
  };
}

function anchorsFor(date: Date): { id: string; time: string; title: string; detail: string }[] {
  const weekday = weekdayOf(date);
  // Only the lunch anchor is a genuine household routine in the fixtures.
  if (weekday === "saturday") {
    return [{ id: "anchor-lunch", time: "12:00", title: "Lunch", detail: "" }];
  }
  return [];
}

function headline(offsetDays: number, date: Date, eventCount: number): string {
  if (offsetDays === 1) {
    return eventCount <= 1 ? copy.plan.tomorrowRelaxed : copy.plan.tomorrowBusy;
  }
  return formatLongDay(date);
}

export function statusLine(day: PlanDay): string {
  if (day.commitmentCount === 0) return copy.plan.statusCalm;
  if (day.commitmentCount === 1) return copy.plan.statusOne;
  return fill(copy.plan.statusMany, { count: String(day.commitmentCount) });
}

export function greeting(name: string, now: Date): string {
  const hour = now.getHours();
  const template =
    hour < 12
      ? copy.plan.greetingMorning
      : hour < 18
        ? copy.plan.greetingAfternoon
        : copy.plan.greetingEvening;
  return fill(template, { name: name.trim() }).replace(", .", ".");
}

export function buildWatchlist(
  snapshot: Snapshot,
  now: Date,
  role: "adult" | "child" = "adult",
): WatchEntry[] {
  const entries: WatchEntry[] = [];
  const upcoming = visibleEvents(snapshot, role)
    .filter((event) => event.start.getTime() >= startOfDay(now).getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const birthday = upcoming.find((event) => event.kind === "birthday");
  if (birthday) {
    const member = snapshot.household.members.find((entry) => entry.id === birthday.memberId);
    entries.push({
      id: birthday.id,
      title: member ? `${member.name}'s birthday` : birthday.title,
      detail: countdown(wholeDaysBetween(now, birthday.start)),
      adultOnly: false,
    });
  }

  const renewal = upcoming.find((event) => event.kind === "renewal");
  if (renewal) {
    entries.push({
      id: renewal.id,
      title: renewal.title.replace(" renews", ""),
      detail: countdown(wholeDaysBetween(now, renewal.start)),
      adultOnly: true,
    });
  }

  const outstanding = snapshot.items.filter((item) => !item.checked);
  if (outstanding.length > 0) {
    entries.push({
      id: "shopping",
      title: "Shopping",
      detail: `${outstanding.length} items`,
      adultOnly: false,
    });
  }

  return entries;
}

export function buildWeek(
  snapshot: Snapshot,
  now: Date,
  role: "adult" | "child" = "adult",
): WeekRow[] {
  const start = startOfDay(now);
  // Monday first, the way a British household reads a week.
  const offsetToMonday = (start.getDay() + 6) % 7;
  const monday = addDays(start, -offsetToMonday);

  const rows: WeekRow[] = [];
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(monday, index);
    const events = visibleEvents(snapshot, role)
      .filter((event) => isSameDay(event.start, date))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const parts: string[] = [];
    const notes: string[] = [];
    const seen = new Set<string>();

    for (const event of events) {
      if (event.kind === "reminderItem") {
        notes.push(...(event.bring.length > 0 ? event.bring : [event.title]));
        continue;
      }
      const label =
        event.kind === "appointment" || event.kind === "familyPlan"
          ? `${event.title} · ${formatTime(event.start)}`
          : event.title;
      if (seen.has(label)) continue;
      seen.add(label);
      parts.push(label);
    }

    rows.push({ date, weekday: capitalise(weekdayOf(date)), parts, notes, busiest: false });
  }

  const most = Math.max(...rows.map((row) => row.parts.length));
  return rows.map((row) => ({ ...row, busiest: most >= 2 && row.parts.length === most }));
}

export function weekInsights(rows: WeekRow[]): string[] {
  const insights: string[] = [];
  const busiest = rows.find((row) => row.busiest);
  if (busiest) insights.push(`${busiest.weekday} looks like your busiest day.`);
  const free = [...rows].reverse().find((row) => row.parts.length === 0);
  if (free) insights.push(`You've got nothing planned ${free.weekday} afternoon.`);
  return insights;
}

export function sentenceCase(text: string): string {
  return lowerFirst(text);
}
