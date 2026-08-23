/**
 * Temporal engine tests.
 *
 * These exist because "Arty remembers" is a claim about dates, and dates are
 * where organiser apps actually fail: events that duplicate, drift by a day,
 * or move an hour when the clocks change. Every case below is one of those.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  civil,
  isoDate,
  addDays,
  daysBetween,
  nextOccurrence,
  occurrencesBetween,
  describeRecurrence,
  daysUntilPhrase,
  type Recurrence,
} from "../lib/temporal.ts";

describe("civil dates", () => {
  test("an ISO date survives a round trip in local time", () => {
    // The classic failure: new Date("2026-08-23") is UTC midnight, which in
    // British Summer Time is 23:00 on the 22nd.
    assert.equal(isoDate(civil("2026-08-23")), "2026-08-23");
    assert.equal(civil("2026-08-23").getDate(), 23);
  });

  test("adding days is calendar arithmetic, not milliseconds", () => {
    // Crossing the UK spring transition (29 March 2026).
    const before = civil("2026-03-28");
    const after = addDays(before, 2);
    assert.equal(isoDate(after), "2026-03-30");
    assert.equal(daysBetween(before, after), 2);
  });
});

describe("annual — Mum's birthday is 14 September", () => {
  const birthday: Recurrence = { kind: "annual", month: 9, day: 14 };

  test("finds this year's while it is still ahead", () => {
    const next = nextOccurrence(birthday, civil("2026-08-23"));
    assert.equal(isoDate(next!), "2026-09-14");
  });

  test("rolls to next year once it has passed — told once, known every year", () => {
    const next = nextOccurrence(birthday, civil("2026-09-15"));
    assert.equal(isoDate(next!), "2027-09-14");
  });

  test("is still right a decade later without being told again", () => {
    const next = nextOccurrence(birthday, civil("2036-01-01"));
    assert.equal(isoDate(next!), "2036-09-14");
  });

  test("29 February lands on the 28th in a non-leap year rather than vanishing", () => {
    const leapling: Recurrence = { kind: "annual", month: 2, day: 29 };
    assert.equal(isoDate(nextOccurrence(leapling, civil("2027-01-01"))!), "2027-02-28");
    assert.equal(isoDate(nextOccurrence(leapling, civil("2028-01-01"))!), "2028-02-29");
  });
});

describe("weekly — swimming every Saturday at 10", () => {
  const swimming: Recurrence = { kind: "weekly", weekdays: [6], time: "10:00" };

  test("finds the coming Saturday", () => {
    const next = nextOccurrence(swimming, civil("2026-08-23")); // a Sunday
    assert.equal(isoDate(next!), "2026-08-29");
    assert.equal(next!.getHours(), 10);
  });

  test("today counts when it has not happened yet", () => {
    const saturdayMorning = new Date(2026, 7, 29, 7, 0);
    assert.equal(isoDate(nextOccurrence(swimming, saturdayMorning)!), "2026-08-29");
  });

  test("today does not count once it has passed", () => {
    const saturdayAfternoon = new Date(2026, 7, 29, 14, 0);
    assert.equal(isoDate(nextOccurrence(swimming, saturdayAfternoon)!), "2026-09-05");
  });

  test("stays at 10 o'clock across the autumn clock change", () => {
    // UK clocks go back on 25 October 2026. Adding 7×86_400_000 ms would make
    // this 09:00, which is precisely the bug families complain about.
    const occurrences = occurrencesBetween(swimming, civil("2026-10-17"), civil("2026-11-07"));
    assert.ok(occurrences.length >= 3);
    for (const occurrence of occurrences) {
      assert.equal(occurrence.getHours(), 10, `${isoDate(occurrence)} drifted`);
    }
  });

  test("stays at 10 o'clock across the spring clock change", () => {
    const occurrences = occurrencesBetween(swimming, civil("2026-03-21"), civil("2026-04-11"));
    assert.ok(occurrences.length >= 3);
    for (const occurrence of occurrences) {
      assert.equal(occurrence.getHours(), 10, `${isoDate(occurrence)} drifted`);
    }
  });
});

describe("weekly, several days — nursery Tuesdays and Thursdays", () => {
  const nursery: Recurrence = { kind: "weekly", weekdays: [2, 4], time: "09:00" };

  test("produces exactly two days a week and no others", () => {
    const days = occurrencesBetween(nursery, civil("2026-08-24"), civil("2026-08-30"));
    assert.deepEqual(days.map(isoDate), ["2026-08-25", "2026-08-27"]);
  });

  test("a skipped week produces nothing without disturbing the rest", () => {
    const days = occurrencesBetween(
      nursery,
      civil("2026-08-24"),
      civil("2026-09-06"),
      { skip: ["2026-08-25", "2026-08-27"] },
    );
    assert.deepEqual(days.map(isoDate), ["2026-09-01", "2026-09-03"]);
  });
});

describe("fortnightly — the bins alternate every Wednesday", () => {
  const blueBin: Recurrence = { kind: "fortnightly", weekday: 3, anchor: "2026-08-26" };

  test("hits the anchor week and skips the one between", () => {
    const days = occurrencesBetween(blueBin, civil("2026-08-24"), civil("2026-09-30"));
    assert.deepEqual(days.map(isoDate), ["2026-08-26", "2026-09-09", "2026-09-23"]);
  });

  test("parity holds across a clock change months later", () => {
    // If parity were computed from elapsed milliseconds, the hour lost in
    // March or gained in October would eventually flip the fortnight.
    const days = occurrencesBetween(blueBin, civil("2026-10-14"), civil("2026-11-12"));
    assert.deepEqual(days.map(isoDate), ["2026-10-21", "2026-11-04"]);
  });

  test("works backwards from the anchor too", () => {
    const days = occurrencesBetween(blueBin, civil("2026-08-01"), civil("2026-08-26"));
    assert.deepEqual(days.map(isoDate), ["2026-08-12", "2026-08-26"]);
  });
});

describe("monthly", () => {
  test("the 31st falls back to the last day of a short month", () => {
    const rent: Recurrence = { kind: "monthly", day: 31 };
    assert.equal(isoDate(nextOccurrence(rent, civil("2026-09-01"))!), "2026-09-30");
    assert.equal(isoDate(nextOccurrence(rent, civil("2026-10-01"))!), "2026-10-31");
  });
});

describe("range — we're away from 4 to 11 August", () => {
  const away: Recurrence = { kind: "range", from: "2026-08-04", to: "2026-08-11" };

  test("reports the start before it begins", () => {
    assert.equal(isoDate(nextOccurrence(away, civil("2026-07-20"))!), "2026-08-04");
  });

  test("reports today while it is in progress", () => {
    assert.equal(isoDate(nextOccurrence(away, civil("2026-08-07"))!), "2026-08-07");
  });

  test("returns null once it is over, rather than inventing another", () => {
    assert.equal(nextOccurrence(away, civil("2026-08-12")), null);
  });
});

describe("a one-off does not repeat", () => {
  test("returns null after the date has passed", () => {
    const party: Recurrence = { kind: "once", date: "2026-08-29", time: "14:00" };
    assert.equal(isoDate(nextOccurrence(party, civil("2026-08-23"))!), "2026-08-29");
    assert.equal(nextOccurrence(party, civil("2026-08-30")), null);
  });
});

describe("wording", () => {
  test("recurrences describe themselves consistently", () => {
    assert.equal(describeRecurrence({ kind: "annual", month: 9, day: 14 }), "every 14 September");
    assert.equal(
      describeRecurrence({ kind: "weekly", weekdays: [6], time: "10:00" }),
      "every Saturday at 10:00",
    );
    assert.equal(
      describeRecurrence({ kind: "weekly", weekdays: [2, 4] }),
      "every Tuesday and Thursday",
    );
    assert.equal(
      describeRecurrence({ kind: "fortnightly", weekday: 3, anchor: "2026-08-26" }),
      "every other Wednesday",
    );
  });

  test("counts whole days, so a clock change cannot make it read 21 days", () => {
    assert.equal(daysUntilPhrase(civil("2026-09-14"), civil("2026-08-23")), "in 22 days");
    assert.equal(daysUntilPhrase(civil("2026-08-24"), civil("2026-08-23")), "tomorrow");
    assert.equal(daysUntilPhrase(civil("2026-08-23"), civil("2026-08-23")), "today");
    // Spanning the October transition.
    assert.equal(daysUntilPhrase(civil("2026-10-26"), civil("2026-10-24")), "in 2 days");
  });
});
