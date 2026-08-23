/**
 * analytics.ts — provisioned product events, no analytics SDK.
 *
 * The prototype has no third-party analytics on purpose (see the privacy
 * page). This module gives the product a place to EMIT events now, so the
 * questions we want answered — which archetype is most popular, does choosing
 * a character improve onboarding completion — are answerable the day a
 * privacy-respecting pipeline exists, without instrumenting the app then.
 *
 * The rule: properties are enums and stages, never content. No household
 * conversation, no names, no facts. The type below makes that hard to break.
 */

export type AnalyticsEvent =
  | "arty_character_picker_viewed"
  | "arty_character_previewed"
  | "arty_character_selected"
  | "arty_character_changed"
  | "demo_started"
  | "demo_completed"
  | "magic_memory_viewed"
  | "magic_insurance_viewed"
  | "magic_bins_viewed"
  | "magic_car_service_viewed"
  | "magic_inbox_viewed"
  | "magic_relationship_viewed"
  | "magic_weekend_viewed"
  | "magic_moment_interacted"
  | "waitlist_viewed"
  | "waitlist_started"
  | "waitlist_completed";

export interface AnalyticsProperties {
  moment_id?: string;
  action_id?: string;
  /** Which magic moment immediately preceded a waitlist signup. */
  preceding_moment?: string;
  recording?: boolean;
  character_family?: "companion" | "concierge" | "visitor" | "essence";
  accent?: "navy" | "forest" | "terracotta" | "plum" | "sand";
  onboarding_stage?: string;
}

interface Recorded {
  event: AnalyticsEvent;
  properties: AnalyticsProperties;
  at: string;
}

/** In-memory only. Nothing leaves the browser. */
const queue: Recorded[] = [];

export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  queue.push({ event, properties, at: new Date().toISOString() });
  if (process.env.NODE_ENV === "development") {
    // Visible while developing, silent in production builds.
    console.debug(`[analytics] ${event}`, properties);
  }
}

/** For the demo controls and for tests. */
export function recordedEvents(): readonly Recorded[] {
  return queue;
}
