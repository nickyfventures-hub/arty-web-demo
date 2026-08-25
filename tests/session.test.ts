/**
 * Real-household session tests.
 *
 * "Set up your own account, no dummy data" rests on three guarantees: what
 * you tell Arty survives a restart, fixture data never leaks into a real
 * session, and wiping the slate actually wipes it.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  clearSession,
  loadSession,
  saveSession,
  SESSION_VERSION,
  type SessionStorage,
} from "../lib/session.ts";
import { emptySnapshot } from "../lib/emptyHousehold.ts";

function fakeStorage(seed: Record<string, string> = {}): SessionStorage & { data: Record<string, string> } {
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

const HOUSEHOLD = {
  ownerName: "Nicky",
  members: [
    { id: "nicky", name: "Nicky", role: "owner" as const, descriptor: "Adult", colorToken: "artyTeal" },
    { id: "sunny", name: "Sunny", role: "child" as const, descriptor: "Age 2", colorToken: "artyAmber" },
  ],
  facts: [{ name: "Sunny", lines: ["Age 2", "Nursery Tuesday + Thursday"] }],
  items: [{ id: "i1", text: "Nappies", checked: false }],
  memories: ["Katie likes peonies"],
  reminderCount: 1,
  artyProfile: {
    family: "companion" as const,
    accent: "plum" as const,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  },
  notificationAppetite: "balanced",
};

describe("a real household survives a restart", () => {
  test("save then load returns the same household", () => {
    const storage = fakeStorage();
    assert.equal(saveSession(HOUSEHOLD, storage), true);

    const revived = loadSession(storage);
    assert.ok(revived);
    assert.equal(revived!.version, SESSION_VERSION);
    assert.equal(revived!.ownerName, "Nicky");
    assert.equal(revived!.members.length, 2);
    assert.equal(revived!.members[1].descriptor, "Age 2");
    assert.equal(revived!.items[0].text, "Nappies");
    assert.deepEqual(revived!.memories, ["Katie likes peonies"]);
    assert.equal(revived!.artyProfile.family, "companion");
  });

  test("no storage, corrupt data and future versions all fail safe", () => {
    assert.equal(loadSession(null), null);
    assert.equal(saveSession(HOUSEHOLD, null), false);
    assert.equal(loadSession(fakeStorage({ "arty.household.session.v1": "{broken" })), null);
    assert.equal(
      loadSession(
        fakeStorage({
          "arty.household.session.v1": JSON.stringify({ version: 99, ownerName: "X", members: [] }),
        }),
      ),
      null,
      "a payload from a newer build is refused, not reinterpreted",
    );
  });

  test("wiping the slate actually wipes it", () => {
    const storage = fakeStorage();
    saveSession(HOUSEHOLD, storage);
    assert.ok(loadSession(storage));
    clearSession(storage);
    assert.equal(loadSession(storage), null);
    assert.deepEqual(Object.keys(storage.data), []);
  });
});

describe("no dummy data in a real session", () => {
  test("the empty snapshot is genuinely empty", () => {
    const snapshot = emptySnapshot("Nicky");
    assert.equal(snapshot.events.length, 0);
    assert.equal(snapshot.items.length, 0);
    assert.equal(snapshot.insights.length, 0, "no fabricated discoveries");
    assert.equal(snapshot.meals.length, 0);
    assert.equal(snapshot.memories.length, 0);
    assert.equal(snapshot.household.members.length, 0);
    assert.equal(snapshot.household.name, "Nicky's household");
  });

  test("no fixture names anywhere in an empty household", () => {
    const serialised = JSON.stringify(emptySnapshot("Alex"));
    for (const fixtureName of ["Katie", "Sunny", "Posy", "Fairclough", "swimming", "insurance"]) {
      assert.doesNotMatch(serialised, new RegExp(fixtureName, "i"));
    }
  });
});
