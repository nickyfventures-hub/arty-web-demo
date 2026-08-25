/**
 * emptyHousehold.ts — what a real household starts as.
 *
 * Nothing but its people. No events, no insights, no meals, no memories —
 * the demo fixtures never touch a real session, which is the web mirror of
 * the iOS rule that production never fabricates household data.
 *
 * Deliberately its own module, importing only types: the fixture file loads
 * the demo JSON, and the empty household must not depend on the machinery
 * that exists to fake one.
 */

import type { Member, Snapshot } from "./fixtures";

export function emptySnapshot(ownerName: string, members: Member[] = []): Snapshot {
  const name = ownerName ? `${ownerName}'s household` : "Your household";
  return {
    household: { name, surname: ownerName || "Your", members },
    events: [],
    items: [],
    insights: [],
    meals: [],
    memories: [],
  };
}
