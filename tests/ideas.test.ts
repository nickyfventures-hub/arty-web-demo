/**
 * "Find something to do" — trigger detection and the model-free fallback.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fallbackIdeas, formatIdeas, isIdeasQuery } from "../lib/ideas.ts";

describe("recognising the ask", () => {
  test("the natural phrasings all trigger", () => {
    for (const phrase of [
      "Find something to do",
      "find us something to do",
      "What should we do this weekend?",
      "what can we do tomorrow",
      "any ideas for Saturday?",
      "the kids are bored",
      "any good days out?",
    ]) {
      assert.equal(isIdeasQuery(phrase), true, phrase);
    }
  });

  test("ordinary commands do not trigger", () => {
    for (const phrase of [
      "Add milk to the shopping",
      "What's happening tomorrow?",
      "Remind me to call Mum",
      "Katie doesn't eat mushrooms",
    ]) {
      assert.equal(isIdeasQuery(phrase), false, phrase);
    }
  });
});

describe("the fallback", () => {
  test("suggests without inventing: no venues, no prices, no exclaiming", () => {
    const result = fallbackIdeas();
    assert.ok(result.ideas.length >= 2);
    const text = formatIdeas(result);
    assert.doesNotMatch(text, /£\d/);
    assert.doesNotMatch(text, /!/);
    // Nothing that sounds like a real bookable venue.
    assert.doesNotMatch(text, /\b(Ltd|tickets|book now)\b/i);
  });
});
