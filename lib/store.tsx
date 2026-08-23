"use client";

/**
 * store.tsx
 *
 * All of the demo's state in one reducer. The web prototype has no backend and
 * no persistence beyond the session: it exists so a parent can be sent a URL
 * and understand the product without anyone explaining it.
 */

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { buildSnapshot, type ListItem, type Snapshot } from "./fixtures";
import type { CharacterState, FollowUp } from "./intent";

export type OnboardingStep =
  | "welcome"
  | "capabilities"
  | "intro"
  | "household"
  | "connect"
  | "magic"
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
  ownerName: string;
  extractedMembers: { id: string; name: string; role: "owner" | "adult" | "child" }[];
  extractedFacts: { name: string; lines: string[] }[];
  /** Where the "who do you live with" conversation has got to. */
  householdStage: HouseholdStage;
  /** True while the summary is open for correction. */
  isEditingHousehold: boolean;
  /** Whether this deployment has a model behind it. */
  aiAvailable: boolean;
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
  | { type: "setExtraction"; members: State["extractedMembers"]; facts: State["extractedFacts"] }
  | { type: "goBack" }
  | { type: "setHouseholdStage"; stage: HouseholdStage }
  | { type: "setEditingHousehold"; editing: boolean }
  | { type: "updateMember"; id: string; name: string; role: "owner" | "adult" | "child" }
  | { type: "removeMember"; id: string }
  | { type: "addMember"; name: string; role: "adult" | "child" }
  | { type: "setAIAvailable"; available: boolean }
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
  "connect",
  "magic",
  "auth",
  "invite",
  "notifications",
];

export function initialState(now = new Date()): State {
  return {
    step: "welcome",
    ownerName: "",
    extractedMembers: [],
    extractedFacts: [],
    householdStage: "who",
    isEditingHousehold: false,
    aiAvailable: false,
    calendarConnected: false,
    emailConnected: false,
    notificationAppetite: "balanced",
    invitedName: null,
    acceptedInsightIds: [],
    tab: "plan",
    segment: "today",
    overlay: "none",
    artyPrefill: "",
    snapshot: buildSnapshot(now),
    transcript: [],
    characterState: "idle",
    micLevel: 0,
    now,
    reminderCount: 0,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "goTo":
      return { ...state, step: action.step, characterState: "idle" };
    case "finishOnboarding":
      return { ...state, step: null, tab: "plan", segment: "today", characterState: "idle" };
    case "restart":
      return initialState(state.now);
    case "setName":
      return { ...state, ownerName: action.name };
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
      return { ...state, overlay: action.overlay, artyPrefill: action.prefill ?? "" };
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

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
