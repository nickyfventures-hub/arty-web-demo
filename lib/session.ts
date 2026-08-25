/**
 * session.ts — a real household, kept.
 *
 * When somebody sets Arty up as themselves (the `/` journey, not /demo),
 * what they tell him has to survive closing the app, or "Arty remembers" is
 * false on its face. This persists exactly what the running UI uses — the
 * people, the facts, the shopping list, the chosen character — to this
 * device's storage, whole-document per write so the stored state is never
 * half of one session and half of another.
 *
 * LOCAL ONLY, and honest about it: one device, no account, no sync. The
 * boundary is the same one lib/persist.ts declares for the fact engine.
 * Nothing here ever contains fixture data — a real session starts empty and
 * only ever holds what this household actually said.
 */

import type { HouseholdArtyProfile } from "./character";
import type { ListItem } from "./fixtures";

const KEY = "arty.household.session.v1";
export const SESSION_VERSION = 1;

export interface SavedMember {
  id: string;
  name: string;
  role: "owner" | "adult" | "child";
  descriptor: string;
  colorToken: string;
}

export interface SavedHousehold {
  version: number;
  ownerName: string;
  members: SavedMember[];
  /** What Arty was told about people, keyed by name — the onboarding facts. */
  facts: { name: string; lines: string[] }[];
  items: ListItem[];
  memories: string[];
  reminderCount: number;
  artyProfile: HouseholdArtyProfile;
  notificationAppetite: string;
  savedAt: string;
}

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): SessionStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSession(storage: SessionStorage | null = browserStorage()): SavedHousehold | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedHousehold;
    // A payload from a newer build is refused rather than reinterpreted —
    // silently guessing at future shapes is how data gets destroyed.
    if (typeof data.version !== "number" || data.version > SESSION_VERSION) return null;
    if (typeof data.ownerName !== "string" || !Array.isArray(data.members)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(
  session: Omit<SavedHousehold, "version" | "savedAt">,
  storage: SessionStorage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      KEY,
      JSON.stringify({ ...session, version: SESSION_VERSION, savedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    return false;
  }
}

/** The whole slate, wiped. Used by Start again and Delete my account. */
export function clearSession(storage: SessionStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
