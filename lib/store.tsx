"use client";

/**
 * store.tsx
 *
 * All of the demo's state in one reducer. The web prototype has no backend and
 * no persistence beyond the session: it exists so a parent can be sent a URL
 * and understand the product without anyone explaining it.
 */

import { usePathname } from "next/navigation";
import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { buildSnapshot, type ListItem, type Member, type Snapshot } from "./fixtures";
import { emptySnapshot } from "./emptyHousehold";
import { loadSession, saveSession, type SavedHousehold } from "./session";
import {
  defaultArtyProfile,
  type ArtyAccent,
  type ArtyCharacterFamily,
  type HouseholdArtyProfile,
} from "./character";
import type { CharacterState, FollowUp } from "./intent";

export type OnboardingStep =
  | "welcome"
  | "capabilities"
  | "intro"
  | "household"
  | "postcode"
  | "connect"
  | "magic"
  | "character"
  | "montage"
  | "auth"
  | "invite"
  | "notifications";

export type HouseholdStage = "who" | "detail" | "summary";
export type Tab = "plan" | "calendar";
export type Overlay = "none" | "arty" | "shopping" | "settings" | "child";
export type Segment = "today" | "tomorrow" | "week";

export interface Turn {
  id: string;
  speaker: "person" | "arty";
  text: string;
  confirmations: string[];
  followUp?: FollowUp;
}

export interface State {
  /** Null once onboarding is finished. */
  step: OnboardingStep | null;
  /**
   * True when the app was opened at /demo: the household is already there and
   * onboarding never ran. Kept in state so "start over" returns to the demo
   * rather than dropping someone into an empty onboarding they did not ask for.
   */
  isDemo: boolean;
  ownerName: string;
  extractedMembers: { id: string; name: string; role: "owner" | "adult" | "child" }[];
  extractedFacts: { name: string; lines: string[] }[];
  /** Home, as one postcode, told once. Powers local context later. */
  postcode: string;
  /** Where the "who do you live with" conversation has got to. */
  householdStage: HouseholdStage;
  /** True while the summary is open for correction. */
  isEditingHousehold: boolean;
  /** Whether this deployment has a model behind it. */
  aiAvailable: boolean;
  /**
   * A requested magic-demo scenario: a moment id, "full" for the guided reel,
   * or null. Set by the Plan chip, the /demo/[scenario] routes and the dev
   * panel; consumed by MagicShowcase. Demo layer only — never set outside
   * demo sessions.
   */
  magicRequest: string | null;
  /**
   * True while the centre button is held down: push-to-talk. The assistant
   * starts listening the moment this rises and sends what it heard the
   * moment it falls.
   */
  ptt: boolean;
  /**
   * Which Arty this household chose, and its accent. Belongs to the
   * household, never to one adult: one home, one Arty. Changing it changes
   * appearance and nothing else.
   */
  artyProfile: HouseholdArtyProfile;
  calendarConnected: boolean;
  emailConnected: boolean;
  notificationAppetite: string;
  invitedName: string | null;
  acceptedInsightIds: string[];

  tab: Tab;
  segment: Segment;
  overlay: Overlay;
  artyPrefill: string;

  snapshot: Snapshot;
  transcript: Turn[];
  characterState: CharacterState;
  micLevel: number;
  now: Date;
  reminderCount: number;
}

export type Action =
  | { type: "goTo"; step: OnboardingStep }
  | { type: "finishOnboarding" }
  | { type: "restart" }
  | { type: "setName"; name: string }
  | { type: "setPostcode"; postcode: string }
  | { type: "setExtraction"; members: State["extractedMembers"]; facts: State["extractedFacts"] }
  | { type: "goBack" }
  | { type: "setHouseholdStage"; stage: HouseholdStage }
  | { type: "setEditingHousehold"; editing: boolean }
  | { type: "updateMember"; id: string; name: string; role: "owner" | "adult" | "child" }
  | { type: "removeMember"; id: string }
  | { type: "addMember"; name: string; role: "adult" | "child" }
  | { type: "setAIAvailable"; available: boolean }
  | { type: "setArtyProfile"; family: ArtyCharacterFamily; accent: ArtyAccent }
  | { type: "startMagic"; scenario: string }
  | { type: "setPTT"; active: boolean }
  | { type: "hydrate"; saved: SavedHousehold }
  | { type: "endMagic" }
  | { type: "connectCalendar" }
  | { type: "connectEmail" }
  | { type: "setAppetite"; id: string }
  | { type: "acceptInsight"; id: string }
  | { type: "invite"; name: string }
  | { type: "setTab"; tab: Tab }
  | { type: "setSegment"; segment: Segment }
  | { type: "setOverlay"; overlay: Overlay; prefill?: string }
  | { type: "addTurn"; turn: Turn }
  | { type: "clearTranscript" }
  | { type: "setCharacter"; state: CharacterState }
  | { type: "setMicLevel"; level: number }
  | { type: "addItems"; items: string[]; by?: string }
  | { type: "toggleItem"; id: string }
  | { type: "removeItem"; id: string }
  | { type: "addReminder" };

/** The order steps appear in. Shared by the reducer and the flow component. */
export const STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "capabilities",
  "intro",
  "household",
  "postcode",
  "connect",
  "magic",
  "character",
  "montage",
  "auth",
  "invite",
  "notifications",
];

export function initialState(now = new Date()): State {
  return {
    step: "welcome",
    isDemo: false,
    ownerName: "",
    postcode: "",
    extractedMembers: [],
    extractedFacts: [],
    householdStage: "who",
    isEditingHousehold: false,
    aiAvailable: false,
    magicRequest: null,
    ptt: false,
    artyProfile: defaultArtyProfile(now),
    calendarConnected: false,
    emailConnected: false,
    notificationAppetite: "balanced",
    invitedName: null,
    acceptedInsightIds: [],
    tab: "plan",
    segment: "today",
    overlay: "none",
    artyPrefill: "",
    // A real session starts with nothing but what this household says.
    // Fixture data exists only behind demoState below.
    snapshot: emptySnapshot(""),
    transcript: [],
    characterState: "idle",
    micLevel: 0,
    now,
    reminderCount: 0,
  };
}

/**
 * The app as it looks once a family has already told Arty about themselves.
 *
 * Onboarding is the right first experience for somebody deciding whether they
 * want this. It is the wrong one for somebody being shown it: three minutes of
 * typing before the product appears. /demo starts where a household would be
 * after a fortnight — the people, the week, the shopping list, and the things
 * Arty has noticed.
 *
 * The household is the same fixture data the native app uses, materialised
 * against the clock, so the birthday is always coming up and swimming is
 * always this Saturday. Nothing here is anybody's real information.
 */
export function demoState(now = new Date()): State {
  const base = { ...initialState(now), snapshot: buildSnapshot(now) };
  const { members } = base.snapshot.household;
  const owner = members.find((member) => member.role === "owner");

  return {
    ...base,
    step: null,
    isDemo: true,
    ownerName: owner?.name ?? "Nicky",
    postcode: "WA7 4XX",
    extractedMembers: members.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
    })),
    // What Arty would have understood from the onboarding conversation.
    extractedFacts: members
      .filter((member) => member.descriptor)
      .map((member) => ({ name: member.name, lines: [member.descriptor] })),
    // Both connections made. The calendar is simulated on the web and the app
    // says so wherever it matters; email is labelled a demo connection.
    calendarConnected: true,
    emailConnected: true,
    // Deliberately NOT pre-accepted. The watch list is one of the best things
    // in the product, and it is only interesting if it is still actionable.
    acceptedInsightIds: [],
    tab: "plan",
    segment: "today",
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "goTo":
      return { ...state, step: action.step, characterState: "idle" };
    case "finishOnboarding": {
      if (state.isDemo) {
        return { ...state, step: null, tab: "plan", segment: "today", characterState: "idle" };
      }
      // The real household: the people from onboarding, and nothing else.
      const colours = ["artyTeal", "artyPlum", "artyAmber", "artySage"];
      const members: Member[] = state.extractedMembers.map((member, index) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        descriptor:
          state.extractedFacts.find((fact) => fact.name === member.name)?.lines[0] ??
          (member.role === "child" ? "Child" : "Adult"),
        colorToken: colours[index % colours.length],
      }));
      return {
        ...state,
        step: null,
        tab: "plan",
        segment: "today",
        characterState: "idle",
        snapshot: { ...emptySnapshot(state.ownerName, members), items: state.snapshot.items },
      };
    }
    case "restart":
      return state.isDemo ? demoState(state.now) : initialState(state.now);
    case "setName":
      return { ...state, ownerName: action.name };
    case "setPostcode":
      return { ...state, postcode: action.postcode.trim().toUpperCase() };
    case "setExtraction":
      return { ...state, extractedMembers: action.members, extractedFacts: action.facts };

    case "goBack": {
      // Inside the household conversation, rewind the sub-stages first.
      if (state.step === "household") {
        if (state.householdStage === "summary") {
          return { ...state, householdStage: "detail", isEditingHousehold: false, characterState: "idle" };
        }
        if (state.householdStage === "detail") {
          return { ...state, householdStage: "who", characterState: "idle" };
        }
      }
      const index = STEP_ORDER.indexOf(state.step ?? "welcome");
      const previous = STEP_ORDER[index - 1];
      if (!previous) return state;
      return {
        ...state,
        step: previous,
        characterState: "idle",
        // Coming back into the conversation lands where it was left.
        householdStage:
          previous === "household" && state.extractedMembers.length > 0
            ? state.extractedFacts.length > 0
              ? "summary"
              : "detail"
            : state.householdStage,
      };
    }

    case "setHouseholdStage":
      return { ...state, householdStage: action.stage };

    case "setEditingHousehold":
      return { ...state, isEditingHousehold: action.editing };

    case "updateMember": {
      const previous = state.extractedMembers.find((member) => member.id === action.id);
      return {
        ...state,
        ownerName:
          previous?.role === "owner" ? action.name : state.ownerName,
        extractedMembers: state.extractedMembers.map((member) =>
          member.id === action.id ? { ...member, name: action.name, role: action.role } : member,
        ),
        // The summary is keyed by name, so a spelling fix has to follow through.
        extractedFacts: state.extractedFacts.map((fact) =>
          previous && fact.name === previous.name ? { ...fact, name: action.name } : fact,
        ),
      };
    }

    case "removeMember": {
      const removed = state.extractedMembers.find((member) => member.id === action.id);
      return {
        ...state,
        extractedMembers: state.extractedMembers.filter((member) => member.id !== action.id),
        extractedFacts: state.extractedFacts.filter((fact) => fact.name !== removed?.name),
      };
    }

    case "addMember":
      return {
        ...state,
        extractedMembers: [
          ...state.extractedMembers,
          { id: `${action.name.toLowerCase()}-${state.extractedMembers.length}`, name: action.name, role: action.role },
        ],
      };

    case "setAIAvailable":
      return { ...state, aiAvailable: action.available };
    case "startMagic":
      return { ...state, magicRequest: action.scenario, tab: "plan", overlay: "none" };
    case "setPTT":
      return { ...state, ptt: action.active };
    case "hydrate": {
      const saved = action.saved;
      return {
        ...state,
        step: null,
        ownerName: saved.ownerName,
        postcode: saved.postcode ?? "",
        extractedMembers: saved.members.map(({ id, name, role }) => ({ id, name, role })),
        extractedFacts: saved.facts,
        artyProfile: saved.artyProfile,
        notificationAppetite: saved.notificationAppetite,
        reminderCount: saved.reminderCount,
        snapshot: {
          ...emptySnapshot(saved.ownerName, saved.members),
          items: saved.items,
          memories: saved.memories,
        },
      };
    }
    case "endMagic":
      return { ...state, magicRequest: null, characterState: "idle" };
    case "setArtyProfile":
      // Appearance only. Household memory, reminders, lists and everything
      // else in this state are deliberately untouched: Arty's appearance
      // changes, Arty's knowledge does not.
      return {
        ...state,
        artyProfile: {
          ...state.artyProfile,
          family: action.family,
          accent: action.accent,
          updatedAt: state.now.toISOString(),
        },
      };
    case "connectCalendar":
      return { ...state, calendarConnected: true };
    case "connectEmail":
      return { ...state, emailConnected: true };
    case "setAppetite":
      return { ...state, notificationAppetite: action.id };
    case "acceptInsight":
      return state.acceptedInsightIds.includes(action.id)
        ? state
        : { ...state, acceptedInsightIds: [...state.acceptedInsightIds, action.id] };
    case "invite":
      return { ...state, invitedName: action.name };
    case "setTab":
      return { ...state, tab: action.tab, overlay: "none" };
    case "setSegment":
      return { ...state, segment: action.segment };
    case "setOverlay":
      return {
        ...state,
        overlay: action.overlay,
        artyPrefill: action.prefill ?? "",
        // A conversation is a session: opening Arty starts a fresh
        // transcript. What earlier conversations DID — items added,
        // reminders set — persists; only the chat display resets.
        transcript: action.overlay === "arty" ? [] : state.transcript,
      };
    case "addTurn":
      return { ...state, transcript: [...state.transcript, action.turn] };
    case "clearTranscript":
      return { ...state, transcript: [] };
    case "setCharacter":
      return { ...state, characterState: action.state };
    case "setMicLevel":
      return { ...state, micLevel: action.level };
    case "addItems": {
      const additions: ListItem[] = action.items.map((text, index) => ({
        id: `item-${Date.now()}-${index}`,
        text,
        checked: false,
        addedByMemberId: action.by,
      }));
      return {
        ...state,
        snapshot: { ...state.snapshot, items: [...state.snapshot.items, ...additions] },
      };
    }
    case "toggleItem":
      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          items: state.snapshot.items.map((item) =>
            item.id === action.id ? { ...item, checked: !item.checked } : item,
          ),
        },
      };
    case "removeItem":
      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          items: state.snapshot.items.filter((item) => item.id !== action.id),
        },
      };
    case "addReminder":
      return { ...state, reminderCount: state.reminderCount + 1 };
    default:
      return state;
  }
}

export const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // /demo opens the populated fixture household; / opens the real journey
  // from the cover. Read once, when the reducer initialises.
  const pathname = usePathname();
  const isDemoRoute = pathname?.startsWith("/demo") ?? false;
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    isDemoRoute ? demoState() : initialState(),
  );

  // A real household comes back. Runs after mount (localStorage is
  // client-only and the server-rendered tree must match), never on /demo.
  useEffect(() => {
    if (isDemoRoute) return;
    const saved = loadSession();
    if (saved) dispatch({ type: "hydrate", saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoRoute]);

  // And is kept. Whole document per save; only once onboarding is complete,
  // and never for the demo, whose fixtures must never reach storage.
  useEffect(() => {
    if (isDemoRoute || state.isDemo || state.step !== null) return;
    saveSession({
      ownerName: state.ownerName,
      postcode: state.postcode,
      members: state.snapshot.household.members.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        descriptor: member.descriptor,
        colorToken: member.colorToken,
      })),
      facts: state.extractedFacts,
      items: state.snapshot.items,
      memories: state.snapshot.memories,
      reminderCount: state.reminderCount,
      artyProfile: state.artyProfile,
      notificationAppetite: state.notificationAppetite,
    });
  }, [
    isDemoRoute,
    state.isDemo,
    state.step,
    state.ownerName,
    state.postcode,
    state.snapshot.household.members,
    state.extractedFacts,
    state.snapshot.items,
    state.snapshot.memories,
    state.reminderCount,
    state.artyProfile,
    state.notificationAppetite,
  ]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
