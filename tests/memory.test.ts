/**
 * Household memory tests.
 *
 * "Tell Arty once" is only a real capability if a fact can be stored, recalled
 * after a restart, corrected without leaving a contradiction behind, deleted
 * for good, and defended against a machine that disagrees with a person.
 * Those five things are what this file checks.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  HouseholdMemory,
  reconcile,
  subjectKey,
  provenanceLabel,
  defaultVisibility,
  type FactDraft,
} from "../lib/memory.ts";
import { civil, isoDate, nextOccurrence } from "../lib/temporal.ts";

const NOW = civil("2026-08-23");

function birthdayDraft(overrides: Partial<FactDraft> = {}): FactDraft {
  return {
    subject: "Mum",
    kind: "birthday",
    predicate: "birthday",
    value: "14 September",
    recurrence: { kind: "annual", month: 9, day: 14 },
    source: "user",
    confidence: "confirmed",
    ...overrides,
  } as FactDraft;
}

describe("telling Arty once", () => {
  test("a birthday is stored and recalled", () => {
    const memory = new HouseholdMemory();
    const result = memory.remember(birthdayDraft(), NOW);
    assert.equal(result.action, "create");

    const recalled = memory.recall("Mum", "birthday");
    assert.equal(recalled?.value, "14 September");
  });

  test("it is still known next year, without being told again", () => {
    const memory = new HouseholdMemory();
    memory.remember(birthdayDraft(), NOW);
    const fact = memory.recall("Mum", "birthday")!;
    const next = nextOccurrence(fact.recurrence!, civil("2027-06-01"));
    assert.equal(isoDate(next!), "2027-09-14");
  });

  test("it survives a restart", () => {
    const memory = new HouseholdMemory();
    memory.remember(birthdayDraft(), NOW);
    memory.remember(
      {
        subject: "Katie",
        kind: "preference",
        predicate: "dislikes",
        value: "mushrooms",
        source: "user",
        confidence: "confirmed",
      } as FactDraft,
      NOW,
    );

    // Exactly what persistence does: serialise, throw the object away, reload.
    const revived = HouseholdMemory.fromJSON(JSON.parse(JSON.stringify(memory.toJSON())));

    assert.equal(revived.recall("Mum", "birthday")?.value, "14 September");
    assert.equal(revived.recall("Katie", "dislikes")?.value, "mushrooms");
    assert.equal(revived.recall("Mum", "birthday")?.recurrence?.kind, "annual");
  });

  test("Mum, mum and Mum's are the same person", () => {
    assert.equal(subjectKey("Mum"), subjectKey("mum"));
    assert.equal(subjectKey("Mum's"), subjectKey("Mum"));
    assert.equal(subjectKey("  Mum  "), subjectKey("Mum"));

    const memory = new HouseholdMemory();
    memory.remember(birthdayDraft({ subject: "Mum" }), NOW);
    memory.remember(birthdayDraft({ subject: "mum's", value: "15 September" }), NOW);
    // One slot, not two contradictory ones.
    assert.equal(memory.all().filter((fact) => fact.predicate === "birthday").length, 1);
    assert.equal(memory.recall("Mum", "birthday")?.value, "15 September");
  });
});

describe("corrections", () => {
  test("'Mum's birthday is the 15th, not the 14th' updates rather than duplicates", () => {
    const memory = new HouseholdMemory();
    memory.remember(birthdayDraft(), NOW);

    const result = memory.remember(
      birthdayDraft({ value: "15 September", recurrence: { kind: "annual", month: 9, day: 15 } }),
      NOW,
    );

    assert.equal(result.action, "replace");
    assert.equal(memory.all().length, 1, "a correction must not leave two birthdays");
    assert.equal(memory.recall("Mum", "birthday")?.value, "15 September");
    assert.equal(memory.recall("Mum", "birthday")?.supersededValue, "14 September");
  });

  test("the id is stable through a correction, so references survive", () => {
    const memory = new HouseholdMemory();
    const created = memory.remember(birthdayDraft(), NOW).fact;
    memory.remember(birthdayDraft({ value: "15 September" }), NOW);
    assert.equal(memory.recall("Mum", "birthday")?.id, created.id);
  });

  test("a direct correction wins and clears any dispute", () => {
    const memory = new HouseholdMemory();
    const fact = memory.remember(birthdayDraft(), NOW).fact;
    const corrected = memory.correct(fact.id, { value: "15 September" }, NOW);
    assert.equal(corrected?.value, "15 September");
    assert.equal(corrected?.source, "user");
    assert.equal(corrected?.confirmationState, "confirmed");
  });
});

describe("forgetting", () => {
  test("delete actually deletes", () => {
    const memory = new HouseholdMemory();
    const fact = memory.remember(birthdayDraft(), NOW).fact;

    assert.equal(memory.forget(fact.id, NOW), true);
    assert.equal(memory.recall("Mum", "birthday"), null);
    assert.equal(memory.all().length, 0);
  });

  test("it stays deleted across a restart", () => {
    const memory = new HouseholdMemory();
    const fact = memory.remember(birthdayDraft(), NOW).fact;
    memory.forget(fact.id, NOW);

    const revived = HouseholdMemory.fromJSON(JSON.parse(JSON.stringify(memory.toJSON())));
    assert.equal(revived.recall("Mum", "birthday"), null);
    assert.equal(revived.all().length, 0);
  });

  test("deleting frees the slot for a genuinely new fact", () => {
    const memory = new HouseholdMemory();
    const fact = memory.remember(birthdayDraft(), NOW).fact;
    memory.forget(fact.id, NOW);
    const again = memory.remember(birthdayDraft({ value: "1 January" }), NOW);
    assert.equal(again.action, "create");
    assert.equal(memory.recall("Mum", "birthday")?.value, "1 January");
  });
});

describe("conflicts are never resolved silently", () => {
  const insurance = (): FactDraft =>
    ({
      subject: "the car",
      kind: "renewal",
      predicate: "insurance renewal",
      value: "14 October",
      source: "user",
      confidence: "confirmed",
    }) as FactDraft;

  test("an email that disagrees with a person raises a question, it does not overwrite", () => {
    const memory = new HouseholdMemory();
    memory.remember(insurance(), NOW);

    const result = memory.remember(
      {
        ...insurance(),
        value: "18 October",
        source: "email",
        sourceReference: "gmail:18ab29",
        confidence: "high",
      } as FactDraft,
      NOW,
    );

    assert.equal(result.action, "conflict");
    assert.match(result.question!, /14 October/);
    assert.match(result.question!, /18 October/);
    // Crucially: the stored value has not moved.
    assert.equal(memory.recall("the car", "insurance renewal")?.value, "14 October");
    assert.equal(memory.openConflicts().length, 1);
  });

  test("resolving in favour of the email updates the fact and closes the question", () => {
    const memory = new HouseholdMemory();
    memory.remember(insurance(), NOW);
    memory.remember({ ...insurance(), value: "18 October", source: "email", confidence: "high" } as FactDraft, NOW);

    const conflict = memory.openConflicts()[0];
    const resolved = memory.resolveConflict(conflict.id, "incoming", NOW);

    assert.equal(resolved?.value, "18 October");
    assert.equal(resolved?.confirmationState, "confirmed");
    assert.equal(memory.openConflicts().length, 0);
    assert.equal(memory.all().length, 1, "resolution must not leave two renewals");
  });

  test("resolving in favour of what the user said keeps it and raises its standing", () => {
    const memory = new HouseholdMemory();
    memory.remember(insurance(), NOW);
    memory.remember({ ...insurance(), value: "18 October", source: "email", confidence: "high" } as FactDraft, NOW);

    const conflict = memory.openConflicts()[0];
    const resolved = memory.resolveConflict(conflict.id, "existing", NOW);

    assert.equal(resolved?.value, "14 October");
    assert.equal(resolved?.source, "user");
    assert.equal(memory.openConflicts().length, 0);
  });

  test("a better source quietly improves a guess", () => {
    const memory = new HouseholdMemory();
    memory.remember(
      { ...insurance(), value: "sometime in October", source: "inference", confidence: "low" } as FactDraft,
      NOW,
    );

    const result = memory.remember(
      { ...insurance(), value: "18 October", source: "email", confidence: "high" } as FactDraft,
      NOW,
    );

    assert.equal(result.action, "replace");
    assert.equal(memory.openConflicts().length, 0, "no need to bother anyone about an upgrade");
  });

  test("a worse source cannot undo a better one", () => {
    const memory = new HouseholdMemory();
    memory.remember({ ...insurance(), value: "18 October", source: "email", confidence: "high" } as FactDraft, NOW);

    const result = memory.remember(
      { ...insurance(), value: "sometime in October", source: "inference", confidence: "low" } as FactDraft,
      NOW,
    );

    assert.equal(result.action, "ignore");
    assert.equal(memory.recall("the car", "insurance renewal")?.value, "18 October");
  });

  test("the user always wins, immediately and without a question", () => {
    const memory = new HouseholdMemory();
    memory.remember({ ...insurance(), value: "18 October", source: "email", confidence: "high" } as FactDraft, NOW);

    const result = memory.remember({ ...insurance(), value: "2 November", source: "user" } as FactDraft, NOW);

    assert.equal(result.action, "replace");
    assert.equal(memory.recall("the car", "insurance renewal")?.value, "2 November");
    assert.equal(memory.openConflicts().length, 0);
  });

  test("hearing the same thing again is not a conflict, it is confirmation", () => {
    const memory = new HouseholdMemory();
    memory.remember(insurance(), NOW);
    const result = memory.remember(
      { ...insurance(), source: "email", confidence: "high" } as FactDraft,
      civil("2026-09-01"),
    );
    assert.equal(result.action, "unchanged");
    assert.equal(result.fact.lastVerifiedAt, civil("2026-09-01").toISOString());
  });
});

describe("child access is a property of the data", () => {
  test("financial and administrative kinds default to adults only", () => {
    assert.equal(defaultVisibility("renewal"), "adults_only");
    assert.equal(defaultVisibility("service"), "adults_only");
    assert.equal(defaultVisibility("document"), "adults_only");
    assert.equal(defaultVisibility("birthday"), "household");
    assert.equal(defaultVisibility("routine"), "household");
  });

  test("a child querying the store cannot see the insurance at all", () => {
    const memory = new HouseholdMemory();
    memory.remember(birthdayDraft(), NOW);
    memory.remember(
      {
        subject: "the car",
        kind: "renewal",
        predicate: "insurance renewal",
        value: "14 October",
        source: "user",
        confidence: "confirmed",
      } as FactDraft,
      NOW,
    );

    const asChild = memory.all("household");
    assert.equal(asChild.length, 1);
    assert.equal(asChild[0].kind, "birthday");
    assert.equal(memory.recall("the car", "insurance renewal", "household"), null);

    // And an adult still sees both.
    assert.equal(memory.all("adults_only").length, 2);
  });
});

describe("provenance", () => {
  test("every source has an honest label for the What Arty knows screen", () => {
    const memory = new HouseholdMemory();
    const told = memory.remember(birthdayDraft(), NOW).fact;
    assert.equal(provenanceLabel(told), "You told Arty");

    const fromEmail = memory.remember(
      {
        subject: "the boiler",
        kind: "service",
        predicate: "service due",
        value: "3 March",
        source: "email",
        sourceReference: "gmail:abc",
        confidence: "high",
      } as FactDraft,
      NOW,
    ).fact;
    assert.equal(provenanceLabel(fromEmail), "From connected email");
    assert.equal(fromEmail.sourceReference, "gmail:abc");
  });

  test("reconcile is a pure function and can be reasoned about on its own", () => {
    const memory = new HouseholdMemory();
    const existing = memory.remember(birthdayDraft(), NOW).fact;
    const decision = reconcile(existing, birthdayDraft({ value: "1 May", source: "inference", confidence: "low" }));
    assert.equal(decision.action, "conflict");
  });
});
