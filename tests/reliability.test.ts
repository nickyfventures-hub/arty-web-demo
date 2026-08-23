/**
 * Reliability tests — notifications, calendar import and persistence.
 *
 * These three are where family organisers actually lose users: too many
 * alerts, duplicated events, and information that quietly disappears. Each
 * suite below is a specific complaint, turned into an assertion.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  composeBriefing,
  candidateFor,
  emptyLedger,
  inQuietHours,
  nextSpeakableMoment,
  type Candidate,
} from "../lib/notifications.ts";
import { importEvents, liveEvents, type IncomingEvent, type StoredEvent } from "../lib/sync.ts";
import {
  load,
  save,
  migrate,
  emptyHousehold,
  memoryFrom,
  withMemory,
  PERSISTENCE_SCOPE,
  type Storage,
} from "../lib/persist.ts";
import { HouseholdMemory, type FactDraft } from "../lib/memory.ts";
import { civil } from "../lib/temporal.ts";

const NOW = new Date(2026, 7, 23, 18, 0); // Sunday evening

// MARK: - Notifications

describe("one useful notification, not four naggy ones", () => {
  function swimmingCandidates(): Candidate[] {
    // Exactly the bad pattern: the same lesson, announced four times.
    return [
      { key: "swim-2026-08-24", title: "Swimming", line: "Swimming at 10 tomorrow.", when: civil("2026-08-24"), importance: 0.8, actionable: true, visibility: "household" },
      { key: "swim-2026-08-24", title: "Swimming", line: "Remember swimming!", when: civil("2026-08-24"), importance: 0.8, actionable: true, visibility: "household" },
      { key: "swim-bag-2026-08-24", title: "Swimming bag", line: "The swimming bag is on your list.", when: civil("2026-08-24"), importance: 0.5, actionable: true, visibility: "household" },
    ];
  }

  test("everything about tomorrow arrives as a single delivery", () => {
    const { delivery } = composeBriefing(swimmingCandidates(), {
      now: NOW,
      appetite: "balanced",
      ledger: emptyLedger(),
    });

    assert.ok(delivery, "expected one briefing");
    assert.match(delivery!.body, /Swimming at 10 tomorrow/);
    assert.match(delivery!.body, /swimming bag/i);
    // The duplicate key must not appear twice in one body.
    assert.equal(delivery!.covers.filter((key) => key === "swim-2026-08-24").length, 1);
  });

  test("the same thing is never announced twice", () => {
    const first = composeBriefing(swimmingCandidates(), {
      now: NOW,
      appetite: "balanced",
      ledger: emptyLedger(),
    });

    // A later run on the SAME day: nothing more to say.
    const second = composeBriefing(swimmingCandidates(), {
      now: NOW,
      appetite: "balanced",
      ledger: first.ledger,
    });
    assert.equal(second.delivery, null);

    // And the next day, the already-delivered items stay quiet.
    const third = composeBriefing(swimmingCandidates(), {
      now: new Date(2026, 7, 24, 18, 0),
      appetite: "balanced",
      ledger: first.ledger,
    });
    assert.equal(third.delivery, null, "already-delivered candidates must not resurface");
  });

  test("appetite changes what is delivered, not just the wording", () => {
    const mixed: Candidate[] = [
      { key: "a", title: "Dentist", line: "Dentist at 9 tomorrow.", when: civil("2026-08-24"), importance: 0.8, actionable: true, visibility: "household" },
      { key: "b", title: "Bin", line: "It's blue bin night.", when: civil("2026-08-24"), importance: 0.5, actionable: true, visibility: "household" },
      { key: "c", title: "Trivia", line: "Nothing much next week.", when: civil("2026-08-30"), importance: 0.2, actionable: false, visibility: "household" },
    ];

    const essential = composeBriefing(mixed, { now: NOW, appetite: "essential", ledger: emptyLedger() });
    assert.deepEqual(essential.delivery?.covers, ["a"], "only important things means only the dentist");

    const balanced = composeBriefing(mixed, { now: NOW, appetite: "balanced", ledger: emptyLedger() });
    assert.deepEqual(balanced.delivery?.covers.sort(), ["a", "b"]);

    const everything = composeBriefing(mixed, { now: NOW, appetite: "everything", ledger: emptyLedger() });
    assert.equal(everything.delivery?.covers.length, 3);
  });

  test("a child's device never receives an adults-only item", () => {
    const candidates: Candidate[] = [
      { key: "ins", title: "Insurance", line: "Car insurance renews in 31 days.", when: civil("2026-09-23"), importance: 0.75, actionable: true, visibility: "adults_only" },
      { key: "swim", title: "Swimming", line: "Swimming at 10 tomorrow.", when: civil("2026-08-24"), importance: 0.8, actionable: true, visibility: "household" },
    ];

    const child = composeBriefing(candidates, {
      now: NOW,
      appetite: "everything",
      ledger: emptyLedger(),
      visibility: "household",
    });
    assert.deepEqual(child.delivery?.covers, ["swim"]);
    assert.doesNotMatch(child.delivery!.body, /insurance/i);
  });

  test("nothing worth saying means nothing is said", () => {
    const quiet: Candidate[] = [
      { key: "z", title: "Something", line: "Nothing much.", when: civil("2026-09-30"), importance: 0.2, actionable: false, visibility: "household" },
    ];
    const result = composeBriefing(quiet, { now: NOW, appetite: "balanced", ledger: emptyLedger() });
    assert.equal(result.delivery, null, "silence is a valid outcome");
  });

  test("quiet hours are respected", () => {
    assert.equal(inQuietHours(new Date(2026, 7, 23, 22, 0)), true);
    assert.equal(inQuietHours(new Date(2026, 7, 23, 3, 0)), true);
    assert.equal(inQuietHours(new Date(2026, 7, 23, 18, 0)), false);

    const lateNight = new Date(2026, 7, 23, 23, 30);
    const moved = nextSpeakableMoment(lateNight);
    assert.equal(moved.getDate(), 24);
    assert.equal(moved.getHours(), 7);

    const delivery = composeBriefing(
      [{ key: "x", title: "Dentist", line: "Dentist at 9.", when: civil("2026-08-24"), importance: 0.9, actionable: true, visibility: "household" }],
      { now: lateNight, appetite: "balanced", ledger: emptyLedger() },
    );
    assert.equal(inQuietHours(delivery.delivery!.scheduledFor), false);
  });

  test("importance is derived, so the same event always scores the same", () => {
    const tomorrow = candidateFor({
      key: "swim", title: "Swimming", line: "Swimming at 10 tomorrow.",
      recurrence: { kind: "weekly", weekdays: [1], time: "10:00" }, now: NOW,
    });
    const distant = candidateFor({
      key: "later", title: "Thing", line: "A thing.",
      recurrence: { kind: "annual", month: 12, day: 25 }, now: NOW,
    });
    assert.ok(tomorrow!.importance > distant!.importance);
  });
});

// MARK: - Calendar import

describe("importing the same calendar ten times gives one event", () => {
  const incoming: IncomingEvent[] = [
    { origin: "deviceCalendar", externalId: "abc-123", title: "Swimming", recurrence: { kind: "weekly", weekdays: [6], time: "10:00" } },
    { origin: "deviceCalendar", externalId: "def-456", title: "Dentist", recurrence: { kind: "once", date: "2026-09-02", time: "09:00" } },
  ];

  test("ten imports produce two events", () => {
    let events: StoredEvent[] = [];
    let last;
    for (let run = 0; run < 10; run += 1) {
      const result = importEvents(events, incoming, { now: NOW, householdId: "h1" });
      events = result.events;
      last = result.outcome;
    }
    assert.equal(liveEvents(events).length, 2);
    assert.deepEqual(last, { created: 0, updated: 0, unchanged: 2, deleted: 0 });
  });

  test("ids are stable across a reinstall", () => {
    const first = importEvents([], incoming, { now: NOW, householdId: "h1" });
    const afterWipe = importEvents([], incoming, { now: NOW, householdId: "h1" });
    assert.deepEqual(
      first.events.map((event) => event.id),
      afterWipe.events.map((event) => event.id),
    );
  });

  test("a changed event updates in place rather than duplicating", () => {
    const first = importEvents([], incoming, { now: NOW, householdId: "h1" });
    const moved: IncomingEvent[] = [
      { ...incoming[0], title: "Swimming lesson", recurrence: { kind: "weekly", weekdays: [6], time: "11:00" } },
      incoming[1],
    ];
    const second = importEvents(first.events, moved, { now: NOW, householdId: "h1" });

    assert.equal(liveEvents(second.events).length, 2);
    assert.equal(second.outcome.updated, 1);
    assert.equal(second.outcome.created, 0);
    const swimming = liveEvents(second.events).find((event) => event.externalId === "abc-123");
    assert.equal(swimming?.title, "Swimming lesson");
    assert.equal(swimming?.id, first.events[0].id, "the id must survive an edit");
  });

  test("an event deleted at the source disappears here too", () => {
    const first = importEvents([], incoming, { now: NOW, householdId: "h1" });
    const second = importEvents(first.events, [incoming[0]], {
      now: NOW,
      householdId: "h1",
      completeFor: ["deviceCalendar"],
    });

    assert.equal(second.outcome.deleted, 1);
    assert.equal(liveEvents(second.events).length, 1);
  });

  test("a deleted event that returns is undeleted, not duplicated", () => {
    const first = importEvents([], incoming, { now: NOW, householdId: "h1" });
    const removed = importEvents(first.events, [incoming[0]], {
      now: NOW, householdId: "h1", completeFor: ["deviceCalendar"],
    });
    const restored = importEvents(removed.events, incoming, {
      now: NOW, householdId: "h1", completeFor: ["deviceCalendar"],
    });

    assert.equal(liveEvents(restored.events).length, 2);
    assert.equal(restored.outcome.created, 0, "it must not come back as a second copy");
  });

  test("a partial import does not delete events from other origins", () => {
    const withArtyEvent: StoredEvent[] = [
      {
        id: "own-1", householdId: "h1", origin: "arty", title: "Ellie's party",
        recurrence: { kind: "once", date: "2026-08-29", time: "14:00" },
        updatedAt: NOW.toISOString(), createdBy: "owner",
      },
    ];
    const result = importEvents(withArtyEvent, incoming, {
      now: NOW, householdId: "h1", completeFor: ["deviceCalendar"],
    });
    assert.equal(liveEvents(result.events).length, 3);
    assert.ok(liveEvents(result.events).some((event) => event.id === "own-1"));
  });
});

// MARK: - Persistence

function fakeStorage(seed: Record<string, string> = {}): Storage & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe("a fact survives a restart", () => {
  test("save then load returns the same household", () => {
    const storage = fakeStorage();
    const memory = new HouseholdMemory();
    memory.remember(
      {
        subject: "Mum", kind: "birthday", predicate: "birthday", value: "14 September",
        recurrence: { kind: "annual", month: 9, day: 14 }, source: "user", confidence: "confirmed",
      } as FactDraft,
      NOW,
    );

    assert.equal(save(withMemory(emptyHousehold(), memory), storage), true);

    // A completely fresh process would do exactly this.
    const reloaded = memoryFrom(load(storage));
    assert.equal(reloaded.recall("Mum", "birthday")?.value, "14 September");
    assert.equal(reloaded.recall("Mum", "birthday")?.recurrence?.kind, "annual");
  });

  test("no storage at all is not a crash", () => {
    assert.deepEqual(load(null).facts, []);
    assert.equal(save(emptyHousehold(), null), false);
  });

  test("a storage that throws is not a crash", () => {
    const hostile: Storage = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("quota"); },
      removeItem() { throw new Error("blocked"); },
    };
    assert.deepEqual(load(hostile).facts, []);
    assert.equal(save(emptyHousehold(), hostile), false);
  });
});

describe("an update must never wipe a household", () => {
  test("a version 0 payload is migrated, not discarded", () => {
    const legacy = { householdId: "h1", facts: [{ id: "f1", subject: "Mum" }] };
    const migrated = migrate(legacy);
    assert.ok(migrated);
    assert.equal(migrated!.version, 1);
    assert.equal(migrated!.facts.length, 1, "the fact must survive the migration");
  });

  test("a payload from a newer build is refused rather than reinterpreted", () => {
    assert.equal(migrate({ version: 99, facts: [] }), null);
  });

  test("unreadable data is kept aside rather than deleted", () => {
    const storage = fakeStorage({ "arty.household.v1": JSON.stringify({ version: 99 }) });
    const result = load(storage);
    assert.deepEqual(result.facts, []);
    const rescued = Object.keys(storage.data).filter((key) => key.includes("unreadable"));
    assert.equal(rescued.length, 1, "a household's memory is not ours to throw away");
  });

  test("corrupt JSON does not throw", () => {
    const storage = fakeStorage({ "arty.household.v1": "{not json" });
    assert.deepEqual(load(storage).facts, []);
  });
});

describe("the persistence boundary is stated in code", () => {
  test("local persistence does not claim to be household sync", () => {
    assert.equal(PERSISTENCE_SCOPE.survivesReload, true);
    assert.equal(PERSISTENCE_SCOPE.survivesAppUpdate, true);
    // The one that stops "Arty keeps your household in sync" being written.
    assert.equal(PERSISTENCE_SCOPE.sharedAcrossDevices, false);
  });
});
