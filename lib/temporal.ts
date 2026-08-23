/**
 * temporal.ts — the deterministic date engine.
 *
 * A language model may decide that "every other Wednesday" is a fortnightly
 * recurrence. It must never be the thing that decides WHICH Wednesdays. Those
 * are computed here, by ordinary calendar arithmetic, and they are tested.
 *
 * Everything works in LOCAL WALL-CLOCK terms on purpose. "Swimming every
 * Saturday at 10" means ten o'clock as the family reads a clock, in March and
 * in July alike. Constructing dates from local components (rather than adding
 * 7 × 86_400_000 milliseconds) is what makes that survive a daylight saving
 * transition, and there is a test for exactly that.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday = 0, matching Date

export type Recurrence =
  /** A single moment. "Ellie's party at 2 on Saturday." */
  | { kind: "once"; date: string; time?: string }
  /** "Mum's birthday is 14 September." Year-independent by design. */
  | { kind: "annual"; month: number; day: number; time?: string }
  /** "Swimming every Saturday at 10." "Nursery Tuesdays and Thursdays." */
  | { kind: "weekly"; weekdays: Weekday[]; time?: string }
  /** "Bin day alternates every Wednesday." `anchor` fixes which week. */
  | { kind: "fortnightly"; weekday: Weekday; anchor: string; time?: string }
  /** "The rent goes out on the 1st." */
  | { kind: "monthly"; day: number; time?: string }
  /** "We're away from 4 to 11 August." */
  | { kind: "range"; from: string; to: string };

/** Dates the recurrence would otherwise produce but which do not happen. */
export interface RecurrenceExceptions {
  /** ISO dates (YYYY-MM-DD) to skip. Half term, a cancelled week. */
  skip?: string[];
}

// MARK: - Civil dates
//
// An ISO YYYY-MM-DD is a civil date, not an instant. Parsing it with `new
// Date(string)` yields UTC midnight, which in the UK is the *previous day*
// during British Summer Time. That single mistake is the source of most
// off-by-one-day bugs in calendar software, so it is never done here.

export function civil(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/** Adds days by calendar, not by milliseconds, so DST cannot shift the clock. */
export function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    0,
  );
}

/** Applies "HH:MM" to a day in local time. Absent time means all day. */
export function atTime(day: Date, time?: string): Date {
  if (!time) return startOfDay(day);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hours ?? 0,
    minutes ?? 0,
    0,
    0,
  );
}

/** Whole days between two civil dates, ignoring clock time. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

// MARK: - Occurrences

/**
 * The next time this happens at or after `from`.
 *
 * Returns null when a recurrence has genuinely finished — a `once` in the past,
 * a `range` that has ended. Callers must handle null rather than assume there
 * is always a next time.
 */
export function nextOccurrence(
  recurrence: Recurrence,
  from: Date,
  exceptions: RecurrenceExceptions = {},
): Date | null {
  const skip = new Set(exceptions.skip ?? []);
  const floor = startOfDay(from);

  const notSkipped = (day: Date) => !skip.has(isoDate(day));

  switch (recurrence.kind) {
    case "once": {
      const when = atTime(civil(recurrence.date), recurrence.time);
      return when.getTime() >= from.getTime() && notSkipped(when) ? when : null;
    }

    case "annual": {
      for (let yearOffset = 0; yearOffset <= 1; yearOffset += 1) {
        const year = floor.getFullYear() + yearOffset;
        const day = normaliseMonthDay(year, recurrence.month, recurrence.day);
        const when = atTime(day, recurrence.time);
        if (when.getTime() >= from.getTime() && notSkipped(when)) return when;
      }
      return null;
    }

    case "weekly": {
      if (recurrence.weekdays.length === 0) return null;
      // Two weeks is always enough to find the next matching weekday, even
      // when the nearest ones are excepted.
      for (let offset = 0; offset <= 21; offset += 1) {
        const day = addDays(floor, offset);
        if (!recurrence.weekdays.includes(day.getDay() as Weekday)) continue;
        const when = atTime(day, recurrence.time);
        if (when.getTime() >= from.getTime() && notSkipped(when)) return when;
      }
      return null;
    }

    case "fortnightly": {
      const anchor = startOfDay(civil(recurrence.anchor));
      for (let offset = 0; offset <= 35; offset += 1) {
        const day = addDays(floor, offset);
        if (day.getDay() !== recurrence.weekday) continue;
        // Which side of the fortnight is this? Measured in whole days from the
        // anchor so that clock changes cannot flip the parity.
        const weeks = Math.floor(daysBetween(anchor, day) / 7);
        if (Math.abs(weeks % 2) !== 0) continue;
        const when = atTime(day, recurrence.time);
        if (when.getTime() >= from.getTime() && notSkipped(when)) return when;
      }
      return null;
    }

    case "monthly": {
      for (let monthOffset = 0; monthOffset <= 12; monthOffset += 1) {
        const cursor = new Date(floor.getFullYear(), floor.getMonth() + monthOffset, 1);
        const day = normaliseMonthDay(
          cursor.getFullYear(),
          cursor.getMonth() + 1,
          recurrence.day,
        );
        const when = atTime(day, recurrence.time);
        if (when.getTime() >= from.getTime() && notSkipped(when)) return when;
      }
      return null;
    }

    case "range": {
      const start = startOfDay(civil(recurrence.from));
      const end = startOfDay(civil(recurrence.to));
      if (floor.getTime() <= start.getTime()) return start;
      if (floor.getTime() <= end.getTime()) return floor; // in progress
      return null;
    }
  }
}

/** Every occurrence in [start, end], inclusive of both ends' days. */
export function occurrencesBetween(
  recurrence: Recurrence,
  start: Date,
  end: Date,
  exceptions: RecurrenceExceptions = {},
): Date[] {
  const found: Date[] = [];
  let cursor = startOfDay(start);
  const limit = startOfDay(end);

  // Bounded so a malformed recurrence can never spin forever.
  for (let guard = 0; guard < 800; guard += 1) {
    const next = nextOccurrence(recurrence, cursor, exceptions);
    if (!next || startOfDay(next).getTime() > limit.getTime()) break;
    found.push(next);
    cursor = addDays(startOfDay(next), 1);
  }
  return found;
}

/**
 * 29 February in a non-leap year, or the 31st of a 30-day month, has to land
 * somewhere. It lands on the last day of that month: a birthday still gets
 * marked, and a monthly renewal still happens.
 */
function normaliseMonthDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay), 0, 0, 0, 0);
}

// MARK: - Description
//
// One place that turns a recurrence into words, so "every other Wednesday"
// reads the same in Plan, in a confirmation, and on the What Arty knows screen.

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function describeRecurrence(recurrence: Recurrence): string {
  const clock = (time?: string) => (time ? ` at ${time}` : "");

  switch (recurrence.kind) {
    case "once": {
      const day = civil(recurrence.date);
      return `${day.getDate()} ${MONTH_NAMES[day.getMonth()]}${clock(recurrence.time)}`;
    }
    case "annual":
      return `every ${recurrence.day} ${MONTH_NAMES[recurrence.month - 1]}`;
    case "weekly": {
      const names = recurrence.weekdays.map((day) => DAY_NAMES[day]);
      const list =
        names.length <= 1
          ? names[0] ?? ""
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
      return `every ${list}${clock(recurrence.time)}`;
    }
    case "fortnightly":
      return `every other ${DAY_NAMES[recurrence.weekday]}${clock(recurrence.time)}`;
    case "monthly":
      return `the ${ordinal(recurrence.day)} of each month${clock(recurrence.time)}`;
    case "range": {
      const from = civil(recurrence.from);
      const to = civil(recurrence.to);
      return `${from.getDate()} ${MONTH_NAMES[from.getMonth()]} to ${to.getDate()} ${MONTH_NAMES[to.getMonth()]}`;
    }
  }
}

export function ordinal(value: number): string {
  const remainderTen = value % 10;
  const remainderHundred = value % 100;
  if (remainderTen === 1 && remainderHundred !== 11) return `${value}st`;
  if (remainderTen === 2 && remainderHundred !== 12) return `${value}nd`;
  if (remainderTen === 3 && remainderHundred !== 13) return `${value}rd`;
  return `${value}th`;
}

/** "in 22 days", "tomorrow", "today". Whole days, so DST cannot skew it. */
export function daysUntilPhrase(target: Date, now: Date): string {
  const days = daysBetween(now, target);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}
