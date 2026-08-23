"use client";

import PhoneShell from "@/components/PhoneShell";
import Onboarding from "@/components/screens/Onboarding";
import MainApp from "@/components/screens/MainApp";
import { useStore } from "@/lib/store";

export default function Home() {
  const { state } = useStore();

  return (
    <PhoneShell>
      {state.step === null ? <MainApp /> : <Onboarding />}
    </PhoneShell>
  );
}
