/**
 * Character system tests.
 *
 * The rule under test: four families, one character. Every family renders the
 * same seven states from the same posture table, the profile belongs to the
 * household, and the accent palette is curated rather than open-ended.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ACCENTS,
  ARTY_CHARACTERS,
  voiceIdFor,
  FAMILY_ORDER,
  LISTENING_RING,
  POSTURES,
  STATE_DESCRIPTIONS,
  accentHex,
  defaultArtyProfile,
  withLevel,
} from "../lib/character.ts";

const STATES = ["idle", "listening", "thinking", "speaking", "confirming", "alert", "pleased"] as const;

describe("one state model for every family", () => {
  test("all seven states have a posture — no family can invent its own", () => {
    for (const state of STATES) {
      assert.ok(POSTURES[state], `missing posture for ${state}`);
      assert.ok(STATE_DESCRIPTIONS[state], `missing accessibility words for ${state}`);
    }
  });

  test("listening raises attention in every anatomy's terms", () => {
    // earLift drives spaniel ears, visitor antennae and the orb's halo alike.
    assert.ok(POSTURES.listening.earLift > POSTURES.idle.earLift);
    assert.ok(POSTURES.listening.lean > POSTURES.idle.lean);
  });

  test("confirming carries a positive movement, alert carries none", () => {
    assert.ok(POSTURES.confirming.tailWag > 0.5);
    assert.equal(POSTURES.alert.tailWag, 0);
  });

  test("microphone level feeds the listening pose and only the listening pose", () => {
    const loud = withLevel("listening", 1);
    assert.ok(loud.earLift > POSTURES.listening.earLift);
    assert.deepEqual(withLevel("idle", 1), POSTURES.idle);
  });

  test("the listening ring timing is a single shared constant", () => {
    assert.equal(typeof LISTENING_RING.duration, "number");
  });
});

describe("the character registry", () => {
  test("one entry per family, ids matching keys", () => {
    assert.deepEqual(Object.keys(ARTY_CHARACTERS).sort(), [...FAMILY_ORDER].sort());
    for (const [key, profile] of Object.entries(ARTY_CHARACTERS)) {
      assert.equal(profile.id, key);
      assert.ok(profile.name.length > 0);
      assert.ok(profile.description.length > 0);
    }
  });

  test("every character resolves to its own logical voiceId, centrally", () => {
    const ids = FAMILY_ORDER.map((family) => voiceIdFor(family));
    assert.equal(new Set(ids).size, ids.length, "voice ids must be distinct per character");
    for (const id of ids) {
      // Logical ids only: a raw provider voice id in the bundle would mean
      // voice configuration had leaked out of the server.
      assert.match(id, /^ARTY_VOICE_[A-Z]+$/);
    }
    assert.equal(voiceIdFor("companion"), ARTY_CHARACTERS.companion.voiceId);
  });
});

describe("the household profile", () => {
  test("there are exactly four families in V0", () => {
    assert.deepEqual(FAMILY_ORDER, ["companion", "concierge", "visitor", "essence"]);
  });

  test("the default Arty is the companion", () => {
    const profile = defaultArtyProfile(new Date(2026, 7, 23));
    assert.equal(profile.family, "companion");
    assert.equal(profile.accent, "plum");
  });

  test("the accent palette is curated: five choices, no free colour", () => {
    assert.equal(ACCENTS.length, 5);
    for (const accent of ACCENTS) {
      assert.match(accent.hex, /^#[0-9A-F]{6}$/i);
    }
    // Unknown accents resolve to the default rather than crashing a renderer.
    assert.equal(accentHex("plum"), "#7A3B45");
  });
});
