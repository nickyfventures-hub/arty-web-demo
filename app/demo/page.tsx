"use client";

/**
 * /demo — Arty with a household already in it.
 *
 * The link you send when somebody has thirty seconds. `/` is the full journey
 * from the cover, which is the right first experience for a parent deciding
 * whether they want this, and the wrong one for anybody being shown it.
 *
 * The store notices the route and starts from `demoState()`. Everything below
 * is the ordinary app: no demo-only screens, no separate code path, so what
 * gets shown here is genuinely what gets built.
 */

import PhoneShell from "@/components/PhoneShell";
import MainApp from "@/components/screens/MainApp";
import Onboarding from "@/components/screens/Onboarding";
import { useStore } from "@/lib/store";

export default function Demo() {
  const { state } = useStore();

  return (
    <PhoneShell>
      {state.step === null ? <MainApp /> : <Onboarding />}
    </PhoneShell>
  );
}
