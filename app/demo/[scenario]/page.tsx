"use client";

/**
 * /demo/insurance, /demo/inbox, /demo/weekend … — one magic moment, straight
 * in. These exist so a 6–15 second ad clip or a landing-page section can link
 * to exactly one scene. /demo/full runs the guided reel.
 *
 * Same page, same store, same player as /demo: the route only differs in
 * which scenario it asks for on arrival.
 */

import { useParams } from "next/navigation";
import { useEffect } from "react";
import PhoneShell from "@/components/PhoneShell";
import MainApp from "@/components/screens/MainApp";
import { SCENARIO_SLUGS } from "@/lib/magic";
import { useStore } from "@/lib/store";

export default function DemoScenario() {
  const { state, dispatch } = useStore();
  const params = useParams<{ scenario: string }>();

  useEffect(() => {
    const scenario = params?.scenario;
    if (scenario && (SCENARIO_SLUGS as readonly string[]).includes(scenario)) {
      dispatch({ type: "startMagic", scenario });
    }
  }, [params, dispatch]);

  // /demo/* always starts in the populated household, never onboarding —
  // the store sees the /demo path and begins from demoState.
  void state;
  return (
    <PhoneShell>
      <MainApp />
    </PhoneShell>
  );
}
