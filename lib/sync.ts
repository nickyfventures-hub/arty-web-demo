/**
 * sync.ts — importing without duplicating.
 *
 * The commonest complaint about family organisers is that recurring events
 * multiply, vanish or move. All three have the same cause: an import that
 * cannot tell whether it is looking at a new event or one it already has.
 *
 * The fix is a stable identity that survives re-import. Everything Arty stores
 * carries `originId` (who it came from) and `externalId` (what it is called
 * there). Import ten times, get one event.
 */

import type { Recurrence } from "./temporal.ts";

export type EventOrigin = "arty" | "deviceCalendar" | "email";

export interface StoredEvent {
  /** Arty's own id. Stable for the life of the event. */
  id: string;
  householdId: string;
  origin: EventOrigin;
  /** The id the source uses. Together with origin, this is the identity. */
  externalId?: string;
  title: string;
  recurrence: Recurrence;
  location?: string;
  subject?: string;
  updatedAt: string;
  /** Set rather than removed, so a deletion can propagate rather than resurrect. */
  deletedAt?: string;
  createdBy: string;
  updatedBy?: string;
}

export interface IncomingEvent {
  origin: EventOrigin;
  externalId: string;
  title: string;
  recurrence: Recurrence;
  location?: string;
  subject?: string;
  /** The source's own last-modified stamp, when it has one. */
  updatedAt?: string;
}

export interface ImportOutcome {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
}

/** origin + externalId is the identity. Neither alone is enough. */
export function identityOf(event: { origin: EventOrigin; externalId?: string }): string | null {
  return event.externalId ? `${event.origin}:${event.externalId}` : null;
}

/**
 * Folds a batch of source events into what is already stored.
 *
 * Idempotent by construction: running it twice with the same input produces
 * the same store and an outcome of all-unchanged the second time.
 *
 * `completeFor` names the origins this batch fully represents. Anything stored
 * from those origins and absent from the batch has been deleted at the source,
 * and is marked deleted here — which is how an event disappears properly
 * rather than lingering forever.
 */
export function importEvents(
  stored: StoredEvent[],
  incoming: IncomingEvent[],
  options: { now: Date; householdId: string; completeFor?: EventOrigin[]; actor?: string },
): { events: StoredEvent[]; outcome: ImportOutcome } {
  const now = options.now.toISOString();
  const actor = options.actor ?? "calendar";
  const outcome: ImportOutcome = { created: 0, updated: 0, unchanged: 0, deleted: 0 };

  const byIdentity = new Map<string, StoredEvent>();
  for (const event of stored) {
    const identity = identityOf(event);
    if (identity) byIdentity.set(identity, event);
  }

  const events = [...stored];
  const seen = new Set<string>();

  for (const source of incoming) {
    const identity = `${source.origin}:${source.externalId}`;
    seen.add(identity);
    const existing = byIdentity.get(identity);

    if (!existing) {
      events.push({
        // Derived from the identity, so the same source event always yields
        // the same Arty id — even across a reinstall.
        id: `evt-${hash(identity)}`,
        householdId: options.householdId,
        origin: source.origin,
        externalId: source.externalId,
        title: source.title,
        recurrence: source.recurrence,
        location: source.location,
        subject: source.subject,
        updatedAt: source.updatedAt ?? now,
        createdBy: actor,
      });
      outcome.created += 1;
      continue;
    }

    if (existing.deletedAt) {
      // It came back at the source. Undelete rather than create a second one.
      existing.deletedAt = undefined;
      existing.updatedAt = now;
      outcome.updated += 1;
      continue;
    }

    if (isSame(existing, source)) {
      outcome.unchanged += 1;
      continue;
    }

    existing.title = source.title;
    existing.recurrence = source.recurrence;
    existing.location = source.location;
    existing.subject = source.subject;
    existing.updatedAt = source.updatedAt ?? now;
    existing.updatedBy = actor;
    outcome.updated += 1;
  }

  for (const origin of options.completeFor ?? []) {
    for (const event of events) {
      if (event.origin !== origin || event.deletedAt) continue;
      const identity = identityOf(event);
      if (identity && !seen.has(identity)) {
        event.deletedAt = now;
        event.updatedAt = now;
        outcome.deleted += 1;
      }
    }
  }

  return { events, outcome };
}

function isSame(stored: StoredEvent, source: IncomingEvent): boolean {
  return (
    stored.title === source.title &&
    (stored.location ?? "") === (source.location ?? "") &&
    (stored.subject ?? "") === (source.subject ?? "") &&
    JSON.stringify(stored.recurrence) === JSON.stringify(source.recurrence)
  );
}

/** Small, stable, and not a security boundary — only an id. */
function hash(input: string): string {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

/** Live events only. Deleted ones stay for sync but never render. */
export function liveEvents(events: StoredEvent[]): StoredEvent[] {
  return events.filter((event) => !event.deletedAt);
}
