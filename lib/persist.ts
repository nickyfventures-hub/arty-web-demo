/**
 * persist.ts — household state that survives a restart.
 *
 * "Tell Arty once" is a promise about time. A fact that disappears when the
 * tab closes is not remembered, it is merely displayed, and no amount of
 * interface makes up the difference.
 *
 * This is LOCAL persistence and nothing more. It survives a reload, a browser
 * restart and an update. It does NOT reach another person's device, and the
 * application must never describe it as though it does — see
 * `PERSISTENCE_SCOPE` below, which exists so that boundary is stated in code
 * rather than remembered by whoever writes the next screen.
 */

import { HouseholdMemory, type Conflict, type Fact } from "./memory.ts";
import type { StoredEvent } from "./sync.ts";
import { emptyLedger, type NotificationLedger } from "./notifications.ts";

/**
 * What this layer honestly provides today. Read it before writing any copy
 * that says "your household".
 */
export const PERSISTENCE_SCOPE = {
  survivesReload: true,
  survivesBrowserRestart: true,
  survivesAppUpdate: true,
  /** No. One device only. Cloud sync does not exist yet. */
  sharedAcrossDevices: false,
  /** No. There is no account on the web prototype. */
  survivesSignOut: false,
} as const;

const KEY = "arty.household.v1";

/** Bump when the stored shape changes, and add a migration below. */
export const SCHEMA_VERSION = 1;

export interface PersistedHousehold {
  version: number;
  householdId: string;
  facts: Fact[];
  conflicts: Conflict[];
  events: StoredEvent[];
  ledger: NotificationLedger;
  savedAt: string;
}

export function emptyHousehold(householdId = "household-local"): PersistedHousehold {
  return {
    version: SCHEMA_VERSION,
    householdId,
    facts: [],
    conflicts: [],
    events: [],
    ledger: emptyLedger(),
    savedAt: new Date(0).toISOString(),
  };
}

// MARK: - Migration
//
// A household's memory must never be wiped by an update. If a stored payload
// cannot be understood, it is kept aside rather than discarded, and the app
// starts empty rather than pretending the facts were never there.

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
  // 0 → 1: the first shape. Earlier builds stored nothing, so there is
  // nothing to carry forward; the entry exists so the mechanism is proven.
  0: (data) => ({ ...data, version: 1, facts: data.facts ?? [], events: data.events ?? [] }),
};

export function migrate(raw: unknown): PersistedHousehold | null {
  if (!raw || typeof raw !== "object") return null;
  let data = raw as Record<string, unknown>;

  let version = typeof data.version === "number" ? data.version : 0;
  // Refuse to guess at a payload from the future: a newer build wrote it, and
  // silently reinterpreting it is how data gets destroyed.
  if (version > SCHEMA_VERSION) return null;

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return null;
    data = step(data);
    version = typeof data.version === "number" ? data.version : version + 1;
  }

  return {
    version: SCHEMA_VERSION,
    householdId: typeof data.householdId === "string" ? data.householdId : "household-local",
    facts: Array.isArray(data.facts) ? (data.facts as Fact[]) : [],
    conflicts: Array.isArray(data.conflicts) ? (data.conflicts as Conflict[]) : [],
    events: Array.isArray(data.events) ? (data.events as StoredEvent[]) : [],
    ledger: isLedger(data.ledger) ? data.ledger : emptyLedger(),
    savedAt: typeof data.savedAt === "string" ? data.savedAt : new Date(0).toISOString(),
  };
}

function isLedger(value: unknown): value is NotificationLedger {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as NotificationLedger).delivered) &&
    Array.isArray((value as NotificationLedger).briefedOn)
  );
}

// MARK: - Storage
//
// Every access is guarded. Private browsing, a full quota and a browser with
// site data disabled all throw rather than return null, and none of them are
// a reason for the app to stop working.

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function load(storage: Storage | null = browserStorage()): PersistedHousehold {
  if (!storage) return emptyHousehold();
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyHousehold();
    const migrated = migrate(JSON.parse(raw));
    if (!migrated) {
      // Unreadable. Keep it rather than delete it: a household's memory is not
      // ours to throw away, and a person may want it recovered.
      try {
        storage.setItem(`${KEY}.unreadable.${Date.now()}`, raw);
      } catch {
        /* quota — nothing more to do */
      }
      return emptyHousehold();
    }
    return migrated;
  } catch {
    return emptyHousehold();
  }
}

/**
 * Writes the whole household in one call.
 *
 * Deliberately not incremental. localStorage has no transactions, so a single
 * whole-document write is the only way to guarantee the stored payload is
 * never half of one state and half of another.
 */
export function save(
  household: PersistedHousehold,
  storage: Storage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ ...household, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function clear(storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

// MARK: - Convenience

export function memoryFrom(household: PersistedHousehold): HouseholdMemory {
  return HouseholdMemory.fromJSON({
    householdId: household.householdId,
    facts: household.facts,
    conflicts: household.conflicts,
  });
}

export function withMemory(
  household: PersistedHousehold,
  memory: HouseholdMemory,
): PersistedHousehold {
  const snapshot = memory.toJSON();
  return { ...household, facts: snapshot.facts, conflicts: snapshot.conflicts };
}
