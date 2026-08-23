/**
 * memory.ts — the canonical household fact store.
 *
 * This is the thing that makes "Tell Arty once" mean anything. Before it, a
 * household memory was `{ text, category }` — free prose with no subject, no
 * recurrence and no provenance, which cannot answer "when is Mum's birthday?"
 * and cannot be corrected without creating a second, contradictory memory.
 *
 * Three rules hold this together.
 *
 * ONE FACT PER SUBJECT AND PREDICATE. "Mum" + "birthday" is a slot, not a log.
 * Telling Arty again updates the slot. This is what stops the store filling
 * with contradictions, and it is why corrections work without a form.
 *
 * EVERY FACT CARRIES WHERE IT CAME FROM. A date from a renewal email and a
 * date the user said out loud are not equally authoritative, and Arty has to
 * be able to say which is which — both to resolve conflicts and to answer
 * "how do you know that?".
 *
 * NOTHING IS INVENTED. A fact enters this store because somebody said it or a
 * connected source produced it. A language model may decide what a sentence
 * MEANT; it never decides what is true. Absence is answerable: `recall`
 * returning null is how Arty says "I don't have that yet" rather than guessing.
 */

import type { Recurrence } from "./temporal.ts";
import { describeRecurrence, nextOccurrence } from "./temporal.ts";

// MARK: - Shape

export type FactSource =
  /** Somebody in the household said so. The highest authority there is. */
  | "user"
  /** A connected account or document: a renewal notice, a policy PDF. */
  | "document"
  /** Read from a connected calendar. */
  | "calendar"
  /** Derived from an email's contents. */
  | "email"
  /** Arty worked it out. Always the weakest claim. */
  | "inference";

/**
 * Who wins when two sources disagree. Straight from the product requirement:
 * direct user correction, then authoritative document, then confirmed
 * extraction, then inference.
 */
export const SOURCE_PRECEDENCE: Record<FactSource, number> = {
  user: 4,
  document: 3,
  email: 2,
  calendar: 2,
  inference: 1,
};

export type Confidence = "confirmed" | "high" | "medium" | "low";
export type ConfirmationState = "confirmed" | "unconfirmed" | "disputed";

/** Child mode is enforced on the data, not by hiding the screen. */
export type Visibility = "household" | "adults_only";

export type FactKind =
  | "person"
  | "relationship"
  | "birthday"
  | "anniversary"
  | "preference"
  | "routine"
  | "importantDate"
  | "recurringEvent"
  | "service"
  | "renewal"
  | "document"
  | "vehicle"
  | "pet"
  | "school"
  | "activity"
  | "shoppingPreference"
  | "mealPreference"
  | "contact"
  | "fact";

/** Kinds a child account must never see. Mirrors the RLS policy in Postgres. */
const ADULTS_ONLY_KINDS = new Set<FactKind>([
  "renewal",
  "service",
  "document",
]);

export interface Fact {
  id: string;
  householdId: string;
  /** Who or what it is about. "Mum", "Sunny", "household", "the car". */
  subject: string;
  /** Normalised subject, used for matching. Never shown. */
  subjectKey: string;
  kind: FactKind;
  /** What is being asserted. "birthday", "dislikes", "renews", "attends". */
  predicate: string;
  /** The assertion, in words, always human-readable. */
  value: string;
  /** Present when the fact recurs. THE thing that makes a birthday annual. */
  recurrence?: Recurrence;

  source: FactSource;
  /** Enough to explain provenance: a message id, a calendar event id. */
  sourceReference?: string;
  confidence: Confidence;
  confirmationState: ConfirmationState;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  lastVerifiedAt?: string;
  validFrom?: string;
  validUntil?: string;

  visibility: Visibility;
  /** Soft delete, so a future sync can propagate the removal to other devices. */
  deletedAt?: string;
  /** What this fact replaced, kept so a correction can be explained or undone. */
  supersededValue?: string;
}

export type FactDraft = Omit<
  Fact,
  | "id"
  | "subjectKey"
  | "createdAt"
  | "updatedAt"
  | "confirmationState"
  | "visibility"
  | "householdId"
  | "createdBy"
> & {
  id?: string;
  householdId?: string;
  createdBy?: string;
  confirmationState?: ConfirmationState;
  visibility?: Visibility;
};

// MARK: - Subject matching
//
// "Mum", "mum", "Mum's" and "  Mum " are the same person. Getting this wrong
// is how a store ends up with three birthdays for one parent.

export function subjectKey(subject: string): string {
  return subject
    .trim()
    .toLowerCase()
    .replace(/[''`]s\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

// MARK: - Conflict

export type ReconcileAction = "create" | "replace" | "unchanged" | "ignore" | "conflict";

export interface Reconciliation {
  action: ReconcileAction;
  existing?: Fact;
  /** Set when action is "conflict": the exact question to put to the user. */
  question?: string;
}

/**
 * Decides what happens when something is asserted about a subject and
 * predicate that already has a value.
 *
 * The one rule worth stating out loud: **a confirmed user statement is never
 * silently overwritten by a machine.** An email that disagrees with what a
 * person told Arty produces a question, not a quiet correction. Getting this
 * backwards is how an assistant loses trust in a single incident.
 */
export function reconcile(existing: Fact, incoming: FactDraft): Reconciliation {
  if (existing.value === incoming.value && sameRecurrence(existing, incoming)) {
    return { action: "unchanged", existing };
  }

  // The user is the authority on their own household, always.
  if (incoming.source === "user") return { action: "replace", existing };

  if (existing.source === "user" && existing.confirmationState === "confirmed") {
    return {
      action: "conflict",
      existing,
      question: conflictQuestion(existing, incoming),
    };
  }

  const incomingRank = SOURCE_PRECEDENCE[incoming.source];
  const existingRank = SOURCE_PRECEDENCE[existing.source];

  if (incomingRank > existingRank) return { action: "replace", existing };
  if (incomingRank < existingRank) return { action: "ignore", existing };

  // Equal standing, different answers. Arty does not get to pick.
  return { action: "conflict", existing, question: conflictQuestion(existing, incoming) };
}

function sameRecurrence(a: { recurrence?: Recurrence }, b: { recurrence?: Recurrence }): boolean {
  return JSON.stringify(a.recurrence ?? null) === JSON.stringify(b.recurrence ?? null);
}

function conflictQuestion(existing: Fact, incoming: FactDraft): string {
  const where = sourcePhrase(incoming.source);
  return `I've got ${existing.subject}'s ${existing.predicate} as ${existing.value}, but ${where} says ${incoming.value}. Which should I keep?`;
}

export function sourcePhrase(source: FactSource): string {
  switch (source) {
    case "user":
      return "you told me";
    case "document":
      return "a document";
    case "email":
      return "an email";
    case "calendar":
      return "your calendar";
    case "inference":
      return "something I worked out";
  }
}

/** The short provenance label shown on the What Arty knows screen. */
export function provenanceLabel(fact: Fact): string {
  switch (fact.source) {
    case "user":
      return "You told Arty";
    case "calendar":
      return "From calendar";
    case "email":
      return "From connected email";
    case "document":
      return "From a document";
    case "inference":
      return "Arty worked this out";
  }
}

// MARK: - Store

export interface RememberResult {
  action: ReconcileAction;
  fact: Fact;
  /** Present when the caller must ask before anything changes. */
  question?: string;
  /** The fact the question is about, still unchanged. */
  pending?: FactDraft;
}

export interface Conflict {
  id: string;
  existing: Fact;
  incoming: FactDraft;
  question: string;
  raisedAt: string;
}

let counter = 0;
function nextId(prefix: string, now: Date): string {
  counter += 1;
  return `${prefix}-${now.getTime().toString(36)}-${counter.toString(36)}`;
}

/**
 * An in-memory store with an explicit, serialisable state. Persistence and
 * cloud sync wrap this rather than reimplement it, so the rules above hold
 * wherever the facts happen to live.
 */
export class HouseholdMemory {
  private facts: Fact[];
  private conflicts: Conflict[];
  readonly householdId: string;

  constructor(householdId = "household-local", facts: Fact[] = [], conflicts: Conflict[] = []) {
    this.householdId = householdId;
    this.facts = facts;
    this.conflicts = conflicts;
  }

  // -- Reading

  /** Live facts only. Deleted ones are kept for sync but never returned. */
  all(visibility: Visibility = "adults_only"): Fact[] {
    return this.facts.filter(
      (fact) => !fact.deletedAt && (visibility === "adults_only" || fact.visibility === "household"),
    );
  }

  openConflicts(): Conflict[] {
    return [...this.conflicts];
  }

  /**
   * The single fact for a subject and predicate, or null.
   *
   * Null is a first-class answer. It is how Arty says "I don't have your
   * passport expiry yet" instead of producing a plausible date.
   */
  recall(
    subject: string,
    predicate: string,
    visibility: Visibility = "adults_only",
  ): Fact | null {
    const key = subjectKey(subject);
    return (
      this.all(visibility).find(
        (fact) => fact.subjectKey === key && fact.predicate === predicate,
      ) ?? null
    );
  }

  query(
    filter: { kind?: FactKind; subject?: string; predicate?: string },
    visibility: Visibility = "adults_only",
  ): Fact[] {
    const key = filter.subject ? subjectKey(filter.subject) : undefined;
    return this.all(visibility).filter(
      (fact) =>
        (!filter.kind || fact.kind === filter.kind) &&
        (!key || fact.subjectKey === key) &&
        (!filter.predicate || fact.predicate === filter.predicate),
    );
  }

  // -- Writing

  /**
   * Asserts a fact. Creates, updates, leaves alone, or raises a question —
   * but never leaves two contradictory answers standing.
   */
  remember(draft: FactDraft, now = new Date()): RememberResult {
    const key = subjectKey(draft.subject);
    const existing =
      this.facts.find(
        (fact) => !fact.deletedAt && fact.subjectKey === key && fact.predicate === draft.predicate,
      ) ?? null;

    if (!existing) {
      const fact = this.materialise(draft, now);
      this.facts.push(fact);
      return { action: "create", fact };
    }

    const decision = reconcile(existing, draft);

    if (decision.action === "unchanged") {
      existing.lastVerifiedAt = now.toISOString();
      return { action: "unchanged", fact: existing };
    }

    if (decision.action === "ignore") {
      return { action: "ignore", fact: existing };
    }

    if (decision.action === "conflict") {
      const conflict: Conflict = {
        id: nextId("conflict", now),
        existing,
        incoming: draft,
        question: decision.question ?? conflictQuestion(existing, draft),
        raisedAt: now.toISOString(),
      };
      this.conflicts.push(conflict);
      existing.confirmationState = "disputed";
      return { action: "conflict", fact: existing, question: conflict.question, pending: draft };
    }

    // Replace, in place. The id is stable so anything referencing it survives.
    existing.supersededValue = existing.value;
    existing.value = draft.value;
    existing.recurrence = draft.recurrence;
    existing.kind = draft.kind;
    existing.source = draft.source;
    existing.sourceReference = draft.sourceReference;
    existing.confidence = draft.confidence;
    existing.confirmationState = draft.confirmationState ?? "confirmed";
    existing.updatedAt = now.toISOString();
    existing.updatedBy = draft.createdBy ?? existing.createdBy;
    existing.lastVerifiedAt = now.toISOString();
    existing.subject = draft.subject;
    return { action: "replace", fact: existing };
  }

  /** Answers a raised conflict. `keep` is "existing" or "incoming". */
  resolveConflict(conflictId: string, keep: "existing" | "incoming", now = new Date()): Fact | null {
    const index = this.conflicts.findIndex((conflict) => conflict.id === conflictId);
    if (index === -1) return null;
    const conflict = this.conflicts[index];
    this.conflicts.splice(index, 1);

    const target = this.facts.find((fact) => fact.id === conflict.existing.id);
    if (!target) return null;

    if (keep === "incoming") {
      target.supersededValue = target.value;
      target.value = conflict.incoming.value;
      target.recurrence = conflict.incoming.recurrence;
      target.source = conflict.incoming.source;
      target.sourceReference = conflict.incoming.sourceReference;
      target.updatedAt = now.toISOString();
    }
    // Either way the household has now confirmed it, which raises its standing
    // above any future machine-sourced disagreement.
    target.confirmationState = "confirmed";
    target.confidence = "confirmed";
    target.source = keep === "existing" ? "user" : target.source;
    target.lastVerifiedAt = now.toISOString();
    return target;
  }

  /** Direct correction by a person. Always wins. */
  correct(id: string, patch: Partial<Pick<Fact, "value" | "recurrence" | "subject">>, now = new Date()): Fact | null {
    const fact = this.facts.find((entry) => entry.id === id && !entry.deletedAt);
    if (!fact) return null;
    if (patch.value !== undefined) {
      fact.supersededValue = fact.value;
      fact.value = patch.value;
    }
    if (patch.recurrence !== undefined) fact.recurrence = patch.recurrence;
    if (patch.subject !== undefined) {
      fact.subject = patch.subject;
      fact.subjectKey = subjectKey(patch.subject);
    }
    fact.source = "user";
    fact.confidence = "confirmed";
    fact.confirmationState = "confirmed";
    fact.updatedAt = now.toISOString();
    fact.lastVerifiedAt = now.toISOString();
    this.conflicts = this.conflicts.filter((conflict) => conflict.existing.id !== id);
    return fact;
  }

  /** Soft delete. `all()` stops returning it immediately. */
  forget(id: string, now = new Date()): boolean {
    const fact = this.facts.find((entry) => entry.id === id && !entry.deletedAt);
    if (!fact) return false;
    fact.deletedAt = now.toISOString();
    fact.updatedAt = now.toISOString();
    this.conflicts = this.conflicts.filter((conflict) => conflict.existing.id !== id);
    return true;
  }

  // -- Serialisation

  toJSON(): { householdId: string; facts: Fact[]; conflicts: Conflict[] } {
    return { householdId: this.householdId, facts: this.facts, conflicts: this.conflicts };
  }

  static fromJSON(data: {
    householdId?: string;
    facts?: Fact[];
    conflicts?: Conflict[];
  }): HouseholdMemory {
    return new HouseholdMemory(
      data.householdId ?? "household-local",
      data.facts ?? [],
      data.conflicts ?? [],
    );
  }

  private materialise(draft: FactDraft, now: Date): Fact {
    const stamp = now.toISOString();
    return {
      id: draft.id ?? nextId("fact", now),
      householdId: draft.householdId ?? this.householdId,
      subject: draft.subject,
      subjectKey: subjectKey(draft.subject),
      kind: draft.kind,
      predicate: draft.predicate,
      value: draft.value,
      recurrence: draft.recurrence,
      source: draft.source,
      sourceReference: draft.sourceReference,
      confidence: draft.confidence,
      confirmationState: draft.confirmationState ?? (draft.source === "user" ? "confirmed" : "unconfirmed"),
      createdAt: stamp,
      updatedAt: stamp,
      createdBy: draft.createdBy ?? "owner",
      lastVerifiedAt: stamp,
      validFrom: draft.validFrom,
      validUntil: draft.validUntil,
      visibility: draft.visibility ?? defaultVisibility(draft.kind),
    };
  }
}

export function defaultVisibility(kind: FactKind): Visibility {
  return ADULTS_ONLY_KINDS.has(kind) ? "adults_only" : "household";
}

// MARK: - Answering

/**
 * Turns a stored fact into something Arty can say, including when it is due.
 * Used by both the assistant and the What Arty knows screen so the wording
 * cannot drift between them.
 */
export function describeFact(fact: Fact, now = new Date()): string {
  if (!fact.recurrence) return fact.value;
  const next = nextOccurrence(fact.recurrence, now);
  const shape = describeRecurrence(fact.recurrence);
  if (!next) return `${fact.value} — ${shape}`;
  return `${fact.value} — ${shape}`;
}
