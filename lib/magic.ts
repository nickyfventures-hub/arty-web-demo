/**
 * magic.ts — the demo scenario engine.
 *
 * ══════════════════════ DEMO DATA — NEVER PRODUCTION ══════════════════════
 * Everything in this file is fictional and deterministic: the household, the
 * prices, the quotes, the emails, the shops. It exists so the demo at /demo
 * can show what a household that has used Arty for months would experience.
 * Nothing here may be imported by production code paths, and no production
 * integration may quietly return these fixtures. The insurance quote is not a
 * quote; the flowers are not for sale. See docs/MARKETING_CLAIMS.md.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The moments are data, not components: one player (MagicShowcase) renders
 * them all, which is what keeps the guided reel, the individual ad-clip
 * routes and the dev panel identical in behaviour.
 *
 * Every moment answers one question: what did Arty save this household from
 * having to think about? The mantra that shaped them:
 *
 *   Don't give me information if you can give me an answer.
 *   Don't give me an answer if you can safely do the job.
 *   Don't interrupt me if nothing needs me.
 */

import type { CharacterState } from "./intent";

// MARK: - Autonomy
//
// The permission model the real product will need, established now even
// though every capability behind it is simulated. An action's level is why
// the inbox moment may say "I handled them" (the household opted in) while
// the insurance moment must stop at "I just need your call".

export type AutonomyLevel =
  | "observe"
  | "suggest"
  | "prepare"
  | "act"
  | "act_and_report"
  | "require_approval";

// MARK: - Shape

export interface Evidence {
  label: string;
  value: string;
  emphasis?: "up" | "down" | "accent";
}

export interface MomentAction {
  id: string;
  label: string;
  /** Primary actions open the moment's sheet; secondary ones move on. */
  kind: "primary" | "secondary";
}

export interface SheetItem {
  title: string;
  detail?: string;
  note?: string;
}

export interface MomentSheet {
  title: string;
  lead?: string;
  items: SheetItem[];
  footnote?: string;
  cta?: string;
  /** What Arty says once the sheet's CTA is pressed. */
  ctaResponse?: string;
}

export interface MagicMoment {
  id: string;
  category:
    | "memory"
    | "proactive"
    | "email"
    | "money"
    | "household"
    | "relationship"
    | "planning"
    | "action";
  trigger: "automatic" | "voice" | "tap" | "notification";
  autonomy: AutonomyLevel;
  /** The state Arty enters when the moment begins — before any text. */
  artyState: CharacterState;
  /** Small object that appears beside Arty while the moment plays. */
  emblem: "gift" | "envelope" | "bin" | "car" | "inbox" | "flower" | "sun" | "sparkle";
  /** A scripted voice line the "user" says first, for voice-triggered moments. */
  spoken?: string;
  /** Lines Arty says, revealed one after another. */
  lines: string[];
  evidence?: Evidence[];
  /** A line said after the evidence lands. */
  afterEvidence?: string;
  actions?: MomentAction[];
  sheet?: MomentSheet;
  /** The subtle trust line behind "Why?". */
  provenance: string;
  /** Milliseconds each line holds in recording mode. */
  lineHoldMs?: number;
}

// MARK: - The demo household's standing knowledge
//
// What months of "tell Arty once" would have accumulated. The compounding
// montage renders exactly this list, so the flywheel on screen is the data
// the moments actually used.

export const DEMO_KNOWLEDGE = [
  { subject: "Mum", fact: "Birthday · 14 September", from: "You told Arty" },
  { subject: "Sunny", fact: "Swimming · Saturdays 10:00", from: "You told Arty" },
  { subject: "Katie", fact: "Likes peonies and tulips", from: "You told Arty" },
  { subject: "Home", fact: "Blue bin cycle · WA7 4XX", from: "Household location" },
  { subject: "The car", fact: "Volvo XC60 · serviced yearly", from: "Service records" },
] as const;

/** The demo household opted in, which is the only reason the inbox moment is
 *  allowed to act rather than suggest. Checked by the player and by tests. */
export const DEMO_PERMISSIONS = {
  handleMarketingEmail: true,
  katieSharesLightStatus: true,
} as const;

// MARK: - The moments

export const MOMENTS: MagicMoment[] = [
  {
    id: "memory",
    category: "memory",
    trigger: "voice",
    autonomy: "observe",
    artyState: "listening",
    emblem: "gift",
    spoken: "Mum's birthday is 14 September.",
    lines: ["Got it. 14 September.", "I'll remember that every year."],
    provenance: "You told Arty",
    lineHoldMs: 1200,
  },
  {
    id: "insurance",
    category: "money",
    trigger: "notification",
    autonomy: "require_approval",
    artyState: "alert",
    emblem: "envelope",
    lines: [
      "Your car insurance renewal arrived.",
      "That's £118 more than last year.",
      "I had a look around.",
    ],
    evidence: [
      { label: "Current renewal", value: "£684", emphasis: "up" },
      { label: "Comparable cover", value: "£512", emphasis: "accent" },
      { label: "Potential difference", value: "£172", emphasis: "down" },
    ],
    afterEvidence:
      "I checked the main cover differences and didn't find anything obvious that explains the extra £172.",
    actions: [
      { id: "show", label: "Show me", kind: "primary" },
      { id: "later", label: "Leave it for now", kind: "secondary" },
    ],
    sheet: {
      title: "Arty's pick",
      lead: "£512 a year",
      items: [
        { title: "Similar excess", detail: "£250 compulsory, matching your current policy" },
        { title: "Equivalent core cover", detail: "Comprehensive, courtesy car included" },
        { title: "Protected no-claims", detail: "Included, as now" },
      ],
      footnote: "Before switching, I'd still have you confirm the final policy details.",
      cta: "Keep this for me",
      ctaResponse: "Saved. I'll bring it back before the 14th.",
    },
    provenance: "From your renewal email + comparison · demo data",
  },
  {
    id: "bins",
    category: "household",
    trigger: "automatic",
    autonomy: "observe",
    artyState: "speaking",
    emblem: "bin",
    lines: [
      "Weekend's coming up.",
      "Blue bin tonight.",
      "Collection is usually early, so I'd put it out this evening.",
    ],
    provenance: "Using your household location",
  },
  {
    id: "car-service",
    category: "money",
    trigger: "automatic",
    autonomy: "suggest",
    artyState: "thinking",
    emblem: "car",
    lines: ["Your car service is about two months away.", "Last year's cost was £318."],
    afterEvidence:
      "Putting aside about £40 a week for the next 8 weeks would cover roughly the same amount.",
    actions: [
      { id: "plan", label: "Add to Plan", kind: "primary" },
      { id: "skip", label: "Not needed", kind: "secondary" },
    ],
    sheet: {
      title: "Added to Plan",
      items: [{ title: "Car service fund", detail: "£40 a week · 8 weeks · from this week" }],
      footnote: "A note in your Plan, not a transfer — no money has moved.",
      cta: "Done",
      ctaResponse: "Done. I'll keep it in mind when we're looking ahead.",
    },
    provenance: "From service reminder + previous service record",
  },
  {
    id: "inbox",
    category: "email",
    trigger: "automatic",
    autonomy: "act_and_report",
    artyState: "pleased",
    emblem: "inbox",
    lines: [
      "Nothing in your inbox needs you today.",
      "You had 4 emails. They were all marketing.",
      "I handled them using your email preferences.",
    ],
    evidence: [
      { label: "Unsubscribed", value: "3" },
      { label: "Filtered", value: "1" },
    ],
    afterEvidence: "Nothing needs you.",
    actions: [
      { id: "audit", label: "See what I did", kind: "primary" },
      { id: "ok", label: "Good", kind: "secondary" },
    ],
    sheet: {
      title: "What Arty did",
      lead: "Today",
      items: [
        { title: "Unsubscribed from Example Retail", note: "11:42" },
        { title: "Unsubscribed from Example Deals", note: "11:42" },
        { title: "Unsubscribed from Example Newsletter", note: "11:41" },
        { title: "Filtered Example Promotion", note: "08:05" },
      ],
      footnote:
        "Arty only handles marketing email because you switched that on. You can turn it off any time.",
      cta: "Close",
    },
    provenance: "You asked Arty to handle obvious marketing email",
  },
  {
    id: "relationship",
    category: "relationship",
    trigger: "automatic",
    autonomy: "suggest",
    artyState: "speaking",
    emblem: "flower",
    lines: [
      "Katie's having a bit of a rough day.",
      "You told me she likes peonies and tulips.",
      "I found a couple of options that can be delivered today.",
    ],
    actions: [
      { id: "show", label: "Show me", kind: "primary" },
      { id: "later", label: "Remind me later", kind: "secondary" },
    ],
    sheet: {
      title: "Two that fit",
      items: [
        { title: "Peony and tulip bunch", detail: "£24 · delivery by 5pm", note: "Bloomfield Stems · demo" },
        { title: "Simple pink tulips", detail: "£16 · delivery by 6pm", note: "The Sunday Florist · demo" },
      ],
      footnote: "Nothing is ordered until you say so.",
      cta: "Keep the first one handy",
      ctaResponse: "Saved. It's there when you want it.",
    },
    provenance: "Katie shared this with Arty",
  },
  {
    id: "weekend",
    category: "planning",
    trigger: "automatic",
    autonomy: "suggest",
    artyState: "pleased",
    emblem: "sun",
    lines: ["Saturday's looking good."],
    evidence: [
      { label: "10:00", value: "Sunny's swimming" },
      { label: "Leave", value: "around 9:25" },
      { label: "Afternoon", value: "free", emphasis: "accent" },
    ],
    afterEvidence:
      "You've got a free afternoon after swimming. Want me to find something everyone might enjoy?",
    actions: [
      { id: "find", label: "Find something", kind: "primary" },
      { id: "leave", label: "Leave it free", kind: "secondary" },
    ],
    sheet: {
      title: "I've got an idea",
      lead: "Brookside Farm Park · demo",
      items: [
        { title: "Fits between swimming and dinner", detail: "25 minutes away, open until 5" },
        { title: "Good for both kids", detail: "Toddler barn and pram-friendly paths" },
        { title: "Within your usual budget", detail: "About £22 for the four of you" },
      ],
      cta: "Pencil it in",
      ctaResponse: "Pencilled in. I'll check the weather nearer the time.",
    },
    provenance: "Calendar + household location + what you've told Arty",
  },
];

/** The guided reel, in order, ending with the compounding montage. */
export const SEQUENCE = [
  "memory",
  "insurance",
  "bins",
  "car-service",
  "inbox",
  "relationship",
  "weekend",
] as const;

export function momentById(id: string): MagicMoment | undefined {
  return MOMENTS.find((moment) => moment.id === id);
}

/** /demo/insurance etc. Route slugs are the moment ids, plus "full". */
export const SCENARIO_SLUGS = [...SEQUENCE, "full"] as const;

// MARK: - Timing
//
// One place, so recording mode is deterministic to the frame and the dev
// panel's speed control changes everything together.

export const TIMING = {
  /** Pause before Arty starts talking, while the state change lands. */
  noticeMs: 700,
  /** Default hold per line. */
  lineMs: 1100,
  /** Hold on evidence rows. */
  evidenceMs: 1600,
  /** How long recording mode leaves a sheet open before moving on. */
  sheetMs: 2200,
  /** Wait on actions before recording mode auto-chooses the primary. */
  actionAutoMs: 1200,
  /** Hold on a sheet's confirmation line. */
  responseMs: 1500,
  /** The scripted voice line types at this per-word pace. */
  wordMs: 210,
} as const;

/**
 * Recording mode plays every timing at this multiplier, which brings the full
 * guided reel inside the 35–60 second target while keeping the interactive
 * pace comfortable to read. ?fast=true tightens further for short clips.
 */
export const RECORDING_SPEED = 0.78;
