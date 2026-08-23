/**
 * Understanding tests — the product thesis, expressed as assertions.
 *
 * Every case below is something that takes a parent several screens in a
 * traditional family organiser and one sentence in Arty. If these fail, the
 * differentiation is marketing rather than software.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { interpret, answerFromMemory, summarise, parseWhen } from "../lib/understanding.ts";
import { HouseholdMemory, type FactDraft } from "../lib/memory.ts";
import { civil, isoDate, nextOccurrence } from "../lib/temporal.ts";

// A Sunday, matching the demo fixtures' anchor.
const NOW = civil("2026-08-23");
const PEOPLE = ["Sunny", "Posy", "Katie", "Nicky"];

describe("tell Arty once", () => {
  test("'Mum's birthday is 14 September' becomes an annual fact", () => {
    const result = interpret("Mum's birthday is 14 September", NOW, PEOPLE);
    assert.equal(result.facts.length, 1);

    const fact = result.facts[0];
    assert.equal(fact.subject, "Mum");
    assert.equal(fact.predicate, "birthday");
    assert.equal(fact.recurrence?.kind, "annual");
    assert.deepEqual(fact.recurrence, { kind: "annual", month: 9, day: 14, time: undefined });
    assert.equal(fact.source, "user");
    assert.equal(fact.confidence, "confirmed");
  });

  test("and it is still right next year", () => {
    const fact = interpret("Mum's birthday is 14 September", NOW, PEOPLE).facts[0];
    assert.equal(isoDate(nextOccurrence(fact.recurrence!, civil("2027-01-01"))!), "2027-09-14");
  });

  test("'Katie doesn't eat mushrooms' becomes a meal preference", () => {
    const result = interpret("Katie doesn't eat mushrooms", NOW, PEOPLE);
    assert.equal(result.facts.length, 1);
    assert.equal(result.facts[0].subject, "Katie");
    assert.equal(result.facts[0].predicate, "dislikes");
    assert.equal(result.facts[0].value, "mushrooms");
    assert.equal(result.facts[0].kind, "mealPreference");
  });

  test("'Katie hates mushrooms' means the same thing", () => {
    const result = interpret("Katie hates mushrooms", NOW, PEOPLE);
    assert.equal(result.facts[0]?.value, "mushrooms");
  });

  test("'Sunny has swimming every Saturday at 10' is a routine AND appears in the week", () => {
    const result = interpret("Sunny has swimming every Saturday at 10", NOW, PEOPLE);

    assert.equal(result.facts.length, 1);
    assert.equal(result.facts[0].subject, "Sunny");
    assert.equal(result.facts[0].kind, "routine");
    assert.deepEqual(result.facts[0].recurrence, { kind: "weekly", weekdays: [6], time: "10:00" });

    assert.equal(result.events.length, 1, "a routine should also show up in the plan");
    assert.equal(result.events[0].subject, "Sunny");
  });

  test("'Sunny goes to nursery Tuesdays and Thursdays' captures both days", () => {
    const result = interpret("Sunny goes to nursery Tuesdays and Thursdays", NOW, PEOPLE);
    assert.equal(result.facts.length, 1);
    assert.deepEqual(result.facts[0].recurrence, { kind: "weekly", weekdays: [2, 4], time: undefined });
  });

  test("'the bins go out every other Wednesday' is a fortnightly household routine", () => {
    const result = interpret("the bins go out every other Wednesday", NOW, PEOPLE);
    assert.equal(result.facts.length, 1);
    assert.equal(result.facts[0].subject, "household");
    assert.equal(result.facts[0].recurrence?.kind, "fortnightly");
  });

  test("'our car insurance renews in October' is stored as less certain, on purpose", () => {
    const result = interpret("our car insurance renews in October", NOW, PEOPLE);
    assert.equal(result.facts.length, 1);
    assert.equal(result.facts[0].kind, "renewal");
    // A month with no day must not masquerade as a confirmed date, or a
    // renewal email could never improve on it without an argument.
    assert.equal(result.facts[0].confidence, "medium");
  });
});

describe("multi-intent — the differentiator", () => {
  const SENTENCE =
    "Sunny has Ellie's party at Jungle Parc at 2 Saturday, we need to get Ellie a present, and don't let me forget the card";

  test("one sentence produces an event, a shopping item and a reminder", () => {
    const result = interpret(SENTENCE, NOW, PEOPLE);

    assert.equal(result.events.length, 1, "expected a calendar event");
    assert.equal(result.shopping.length, 1, "expected a shopping item");
    assert.equal(result.reminders.length, 1, "expected a reminder");
    assert.equal(result.unhandled, false);
  });

  test("the party lands on the coming Saturday at 2pm, not 2am", () => {
    const result = interpret(SENTENCE, NOW, PEOPLE);
    const when = result.events[0].recurrence;
    assert.equal(when.kind, "once");
    const at = nextOccurrence(when, NOW)!;
    assert.equal(isoDate(at), "2026-08-29");
    assert.equal(at.getHours(), 14);
  });

  test("the present goes on the shopping list and the card becomes a reminder", () => {
    const result = interpret(SENTENCE, NOW, PEOPLE);
    assert.match(result.shopping[0], /present/i);
    assert.match(result.reminders[0].body, /card/i);
  });

  test("Arty confirms all three in one natural line", () => {
    const result = interpret(SENTENCE, NOW, PEOPLE);
    const line = summarise(result, NOW);
    assert.match(line, /present/i);
    assert.match(line, /card/i);
    assert.ok(line.includes(" and "), "the confirmation should read as one sentence");
  });
});

describe("shopping without a form", () => {
  test("'We're nearly out of nappies' adds nappies", () => {
    const result = interpret("We're nearly out of nappies", NOW, PEOPLE);
    assert.deepEqual(result.shopping, ["Nappies"]);
  });

  test("several items in one breath", () => {
    const result = interpret("Add milk, nappies and dishwasher tablets", NOW, PEOPLE);
    assert.deepEqual(result.shopping, ["Milk", "Nappies", "Dishwasher tablets"]);
  });
});

describe("calendar without a form", () => {
  test("'Sunny has Ellie's party at 2 Saturday' creates one event", () => {
    const result = interpret("Sunny has Ellie's party at 2 Saturday", NOW, PEOPLE);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].subject, "Sunny");
    const at = nextOccurrence(result.events[0].recurrence, NOW)!;
    assert.equal(isoDate(at), "2026-08-29");
  });

  test("'tomorrow' resolves against the actual clock", () => {
    const when = parseWhen("dentist tomorrow at 9", NOW)!;
    assert.equal(isoDate(nextOccurrence(when, NOW)!), "2026-08-24");
  });
});

describe("Arty does not invent facts", () => {
  test("an unknown passport expiry is admitted, not guessed", () => {
    const memory = new HouseholdMemory();
    const result = interpret("When does my passport expire?", NOW, PEOPLE);
    assert.ok(result.question, "that should parse as a question");

    const answer = answerFromMemory(result.question!, memory, NOW);
    assert.equal(answer.known, false);
    assert.match(answer.text, /don't have/i);
    // The failure mode being guarded against: a confident, invented date.
    assert.doesNotMatch(answer.text, /\b20\d\d\b/);
  });

  test("a known birthday is answered from memory with its provenance", () => {
    const memory = new HouseholdMemory();
    memory.remember(
      {
        subject: "Mum",
        kind: "birthday",
        predicate: "birthday",
        value: "14 September",
        recurrence: { kind: "annual", month: 9, day: 14 },
        source: "user",
        confidence: "confirmed",
      } as FactDraft,
      NOW,
    );

    const question = interpret("When's Mum's birthday?", NOW, PEOPLE).question!;
    const answer = answerFromMemory(question, memory, NOW);

    assert.equal(answer.known, true);
    assert.match(answer.text, /14 September/);
    assert.match(answer.text, /in 22 days/);
    assert.equal(answer.provenance, "user");
  });

  test("a question never mutates anything", () => {
    const result = interpret("When's Mum's birthday?", NOW, PEOPLE);
    assert.equal(result.facts.length, 0);
    assert.equal(result.events.length, 0);
    assert.equal(result.shopping.length, 0);
    assert.equal(result.reminders.length, 0);
  });

  test("a child asking about the insurance is told nothing, not told a date", () => {
    const memory = new HouseholdMemory();
    memory.remember(
      {
        subject: "car insurance",
        kind: "renewal",
        predicate: "renewal",
        value: "14 October",
        source: "user",
        confidence: "confirmed",
      } as FactDraft,
      NOW,
    );

    const question = { subject: "car insurance", predicate: "renewal", phrasing: "when does the car insurance renew?" };
    const asChild = answerFromMemory(question, memory, NOW, "household");
    assert.equal(asChild.known, false);
    assert.doesNotMatch(asChild.text, /14 October/);

    const asAdult = answerFromMemory(question, memory, NOW, "adults_only");
    assert.equal(asAdult.known, true);
  });
});

describe("failing gracefully", () => {
  test("nonsense is marked unhandled rather than acted on", () => {
    const result = interpret("asdfgh qwerty", NOW, PEOPLE);
    assert.equal(result.unhandled, true);
    assert.equal(result.facts.length, 0);
    assert.equal(result.events.length, 0);
  });

  test("'Swimming Saturday' asks one short question instead of opening a form", () => {
    const result = interpret("Swimming Saturday", NOW, PEOPLE);
    assert.ok(result.clarification, "expected a clarification");
    assert.match(result.clarification!, /Sunny/);
    assert.ok(result.clarification!.length < 40, "a clarification must be one short line");
  });
});
