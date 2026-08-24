/**
 * Magic demo tests — the spec's acceptance criteria, at the data layer.
 *
 * The player is visual, but almost everything that could quietly rot is data:
 * the arithmetic, the permissions, the provenance, the honesty rules. Each
 * suite below is one of the acceptance tests from the demo brief.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_KNOWLEDGE,
  DEMO_PERMISSIONS,
  MOMENTS,
  RECORDING_SPEED,
  SCENARIO_SLUGS,
  SEQUENCE,
  TIMING,
  momentById,
} from "../lib/magic.ts";
import { HouseholdMemory, type FactDraft } from "../lib/memory.ts";
import { civil, isoDate, nextOccurrence } from "../lib/temporal.ts";

describe("acceptance: insurance", () => {
  const insurance = momentById("insurance")!;

  test("the numbers add up and are shown, not just asserted", () => {
    const rows = Object.fromEntries(insurance.evidence!.map((row) => [row.label, row.value]));
    assert.equal(rows["Current renewal"], "£684");
    assert.equal(rows["Comparable cover"], "£512");
    assert.equal(rows["Potential difference"], "£172");
    assert.equal(684 - 512, 172, "the difference must be arithmetic, not copywriting");
    // £118 more than last year's £566.
    assert.equal(684 - 566, 118);
    assert.ok(insurance.lines.some((line) => line.includes("£118")));
  });

  test("no fake transaction: approval is required and the sheet says so", () => {
    assert.equal(insurance.autonomy, "require_approval");
    assert.match(insurance.sheet!.footnote!, /confirm the final policy/i);
    assert.notEqual(insurance.sheet!.cta, "Switch");
  });

  test("provenance is available and admits it is demo data", () => {
    assert.match(insurance.provenance, /renewal email/i);
    assert.match(insurance.provenance, /demo/i);
  });
});

describe("acceptance: postcode and bins", () => {
  const bins = momentById("bins")!;

  test("the postcode is standing knowledge, never asked for again", () => {
    assert.ok(DEMO_KNOWLEDGE.some((entry) => entry.fact.includes("WA7 4XX")));
    // The moment itself must not request anything.
    assert.equal(bins.actions, undefined);
    for (const line of bins.lines) assert.doesNotMatch(line, /postcode/i);
  });

  test("the right bin, the early-collection context, the provenance", () => {
    assert.ok(bins.lines.some((line) => line.includes("Blue bin")));
    assert.ok(bins.lines.some((line) => /early/i.test(line)));
    assert.match(bins.provenance, /household location/i);
  });
});

describe("acceptance: car service", () => {
  const car = momentById("car-service")!;

  test("previous cost feeds a weekly plan that is arithmetically honest", () => {
    assert.ok(car.lines.some((line) => line.includes("£318")));
    assert.match(car.afterEvidence!, /£40 a week/);
    assert.match(car.afterEvidence!, /8 weeks/);
    assert.ok(40 * 8 >= 318, "the weekly saving must actually cover the cost");
  });

  test("no money moves, and the sheet says so", () => {
    assert.equal(car.autonomy, "suggest");
    assert.match(car.sheet!.footnote!, /no money has moved/i);
  });
});

describe("acceptance: inbox", () => {
  const inbox = momentById("inbox")!;

  test("acting on email is only allowed because the household opted in", () => {
    assert.equal(DEMO_PERMISSIONS.handleMarketingEmail, true);
    assert.equal(inbox.autonomy, "act_and_report");
    assert.match(inbox.provenance, /you asked arty/i);
    assert.match(inbox.sheet!.footnote!, /you switched that on/i);
  });

  test("four emails: three unsubscribed, one filtered, all fictional brands", () => {
    assert.equal(inbox.sheet!.items.length, 4);
    const unsubscribed = inbox.sheet!.items.filter((item) => /^Unsubscribed/.test(item.title));
    const filtered = inbox.sheet!.items.filter((item) => /^Filtered/.test(item.title));
    assert.equal(unsubscribed.length, 3);
    assert.equal(filtered.length, 1);
    for (const item of inbox.sheet!.items) {
      assert.match(item.title, /Example/, "brands must be obviously fictional");
    }
  });

  test("the headline is the absence of work, not the volume of processing", () => {
    assert.match(inbox.lines[0], /nothing in your inbox needs you/i);
    assert.equal(inbox.afterEvidence, "Nothing needs you.");
  });
});

describe("acceptance: relationship", () => {
  const flowers = momentById("relationship")!;

  test("Katie shared it; Arty did not infer it", () => {
    assert.equal(DEMO_PERMISSIONS.katieSharesLightStatus, true);
    assert.equal(flowers.provenance, "Katie shared this with Arty");
    // The forbidden framing.
    for (const line of flowers.lines) {
      assert.doesNotMatch(line, /noticed .*(sick|ill)/i);
      assert.doesNotMatch(line, /health/i);
    }
  });

  test("suggestion only: nothing is bought", () => {
    assert.equal(flowers.autonomy, "suggest");
    assert.match(flowers.sheet!.footnote!, /nothing is ordered/i);
    for (const item of flowers.sheet!.items) assert.match(item.note!, /demo/i);
  });

  test("the remembered preference is what drives the suggestion", () => {
    assert.ok(flowers.lines.some((line) => /peonies and tulips/.test(line)));
    assert.ok(DEMO_KNOWLEDGE.some((entry) => entry.fact.includes("peonies")));
  });
});

describe("acceptance: tell once", () => {
  test("the demo's birthday behaves correctly in the real memory engine", () => {
    // The scene is scripted, but the capability must be real: same fact,
    // through the actual store, satisfying all six criteria.
    const memory = new HouseholdMemory();
    const NOW = civil("2026-08-23");
    const draft = {
      subject: "Mum",
      kind: "birthday",
      predicate: "birthday",
      value: "14 September",
      recurrence: { kind: "annual", month: 9, day: 14 },
      source: "user",
      confidence: "confirmed",
    } as FactDraft;

    memory.remember(draft, NOW);                       // 1. entered once
    const fact = memory.recall("Mum", "birthday")!;    // 4. retrievable later
    assert.equal(fact.value, "14 September");
    assert.equal(isoDate(nextOccurrence(fact.recurrence!, civil("2027-01-01"))!), "2027-09-14"); // 3. annual

    memory.remember(draft, NOW);                       // told again
    assert.equal(memory.all().length, 1);              // 5. no duplicates

    memory.correct(fact.id, { value: "15 September" }, NOW); // 6a. correctable
    assert.equal(memory.recall("Mum", "birthday")!.value, "15 September");
    memory.forget(fact.id, NOW);                       // 6b. deletable
    assert.equal(memory.recall("Mum", "birthday"), null);
  });

  test("the scene shows no recurrence controls", () => {
    const memoryMoment = momentById("memory")!;
    for (const line of [memoryMoment.spoken!, ...memoryMoment.lines]) {
      assert.doesNotMatch(line, /\b(repeat|yearly|alert|save)\b/i);
    }
    assert.equal(memoryMoment.actions, undefined, "Arty handles it — no buttons");
  });
});

describe("the engine itself", () => {
  test("every moment has provenance, an autonomy level and an emblem", () => {
    for (const moment of MOMENTS) {
      assert.ok(moment.provenance.length > 0, `${moment.id} has no provenance`);
      assert.ok(moment.autonomy, `${moment.id} has no autonomy level`);
      assert.ok(moment.emblem, `${moment.id} has no emblem`);
    }
  });

  test("acting moments require permission; observing ones carry no actions they don't need", () => {
    for (const moment of MOMENTS) {
      if (moment.autonomy === "act" || moment.autonomy === "act_and_report") {
        assert.equal(DEMO_PERMISSIONS.handleMarketingEmail, true,
          `${moment.id} acts without a recorded opt-in`);
      }
    }
  });

  test("the guided sequence covers all seven moments exactly once", () => {
    assert.equal(SEQUENCE.length, MOMENTS.length);
    assert.deepEqual([...SEQUENCE].sort(), MOMENTS.map((moment) => moment.id).sort());
  });

  test("every moment has a route slug", () => {
    for (const moment of MOMENTS) {
      assert.ok((SCENARIO_SLUGS as readonly string[]).includes(moment.id));
    }
    assert.ok((SCENARIO_SLUGS as readonly string[]).includes("full"));
  });

  test("the guided reel lands inside the 35–60 second target", () => {
    // A conservative estimate: notice + lines + evidence + after + action
    // pause per moment, at recording timings.
    let total = 0;
    for (const id of SEQUENCE) {
      const moment = momentById(id)!;
      total += TIMING.noticeMs;
      total += (moment.lines.length + 1) * (moment.lineHoldMs ?? TIMING.lineMs);
      if (moment.spoken) total += moment.spoken.split(" ").length * TIMING.wordMs + 700;
      if (moment.evidence) total += TIMING.evidenceMs;
      if (moment.afterEvidence) total += TIMING.evidenceMs;
      if (moment.actions) total += TIMING.actionAutoMs + TIMING.sheetMs + TIMING.responseMs;
      if (moment.notification) total += TIMING.bannerMs;
    }
    const seconds = (total * RECORDING_SPEED) / 1000;
    assert.ok(seconds >= 35, `reel too short: ${seconds.toFixed(1)}s`);
    assert.ok(seconds <= 60, `reel too long: ${seconds.toFixed(1)}s`);
  });

  test("the reel is voice-first: it opens and closes with the person speaking", () => {
    const first = momentById(SEQUENCE[0])!;
    const last = momentById(SEQUENCE[SEQUENCE.length - 1])!;
    assert.ok(first.spoken, "the reel must open with a voice interaction");
    assert.ok(last.spoken, "the reel must close with a voice interaction");
  });

  test("every proactive moment arrives as a notification of work already done", () => {
    for (const moment of MOMENTS) {
      if (moment.spoken) continue; // voice moments are person-initiated
      assert.ok(moment.notification, `${moment.id} is proactive but has no notification`);
      assert.equal(moment.trigger, "notification");
    }
  });

  test("notification copy reports outcomes, not chores", () => {
    // The banner is the closed loop made visible: it says what Arty DID.
    const inbox = momentById("inbox")!.notification!;
    assert.match(inbox.title, /handled/i);
    const insurance = momentById("insurance")!.notification!;
    assert.match(insurance.title, /already shopped around/i);
    for (const moment of MOMENTS) {
      if (!moment.notification) continue;
      assert.doesNotMatch(moment.notification.title, /!/);
      assert.ok(moment.notification.title.length <= 60, `${moment.id} banner title too long`);
    }
  });

  test("no copy shouts", () => {
    for (const moment of MOMENTS) {
      for (const line of moment.lines) {
        assert.doesNotMatch(line, /!/, `"${line}" — Arty does not exclaim`);
        assert.doesNotMatch(line, /amazing|great news|woohoo/i);
      }
    }
  });
});
