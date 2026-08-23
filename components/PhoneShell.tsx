"use client";

/**
 * PhoneShell.tsx
 *
 * On a desktop the demo sits inside an iPhone. Arty is an iPhone product, and
 * a parent looking at this on a laptop should be judging it as one rather than
 * as a website that happens to be narrow.
 *
 * On a phone the frame disappears entirely and the app fills the viewport,
 * safe areas included, because there the device is the frame.
 */

import { BatteryFull, Signal, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export default function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-[#E7E1D8] sm:items-center sm:py-10">
      {/* The device. Everything sm: only — on a real phone there is no frame. */}
      <div
        className="
          relative w-full
          sm:w-[412px] sm:rounded-[58px] sm:bg-gradient-to-b sm:from-[#2A2A2E] sm:to-[#141416]
          sm:p-[13px] sm:shadow-[0_40px_80px_-20px_rgba(28,27,25,0.45),0_0_0_2px_rgba(255,255,255,0.06)_inset]
        "
      >
        <SideButtons />

        {/* The screen */}
        <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-canvas sm:h-[846px] sm:rounded-[46px]">
          <DynamicIsland />
          <StatusBar />

          <div className="relative flex flex-1 flex-col overflow-hidden">{children}</div>

          <HomeIndicator />
        </div>
      </div>
    </div>
  );
}

function DynamicIsland() {
  return (
    <div
      aria-hidden="true"
      className="absolute left-1/2 top-[10px] z-50 hidden h-[31px] w-[112px] -translate-x-1/2 rounded-full bg-black sm:block"
    />
  );
}

/** Only ever shown inside the frame. On a real phone, iOS draws the real one. */
function StatusBar() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    // Rendered on the client only: a server-rendered clock would hydrate wrong.
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="hidden h-[52px] shrink-0 items-end justify-between px-9 pb-1.5 text-ink sm:flex"
    >
      <span className="text-[15px] font-semibold tabular-nums">{time ?? " "}</span>
      <span className="flex items-center gap-1.5">
        <Signal size={15} strokeWidth={2.5} />
        <Wifi size={15} strokeWidth={2.5} />
        <BatteryFull size={19} strokeWidth={2} />
      </span>
    </div>
  );
}

function HomeIndicator() {
  return (
    <div aria-hidden="true" className="hidden h-[24px] shrink-0 items-center justify-center sm:flex">
      <span className="h-[5px] w-[136px] rounded-full bg-ink/30" />
    </div>
  );
}

function SideButtons() {
  return (
    <div aria-hidden="true" className="hidden sm:block">
      {/* Action button and volume, on the left */}
      <span className="absolute -left-[3px] top-[112px] h-[30px] w-[3px] rounded-l bg-[#3A3A3E]" />
      <span className="absolute -left-[3px] top-[168px] h-[56px] w-[3px] rounded-l bg-[#3A3A3E]" />
      <span className="absolute -left-[3px] top-[238px] h-[56px] w-[3px] rounded-l bg-[#3A3A3E]" />
      {/* Side button, on the right */}
      <span className="absolute -right-[3px] top-[196px] h-[86px] w-[3px] rounded-r bg-[#3A3A3E]" />
    </div>
  );
}
