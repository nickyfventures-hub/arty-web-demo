"use client";

/**
 * CapabilitiesStep.tsx
 *
 * "What I do", shown immediately after the cover.
 *
 * Arty is a personal assistant, and a personal assistant is judged on what it
 * takes off your hands. Somebody meeting Arty for the first time should know
 * that before they are asked for their name, their household or their
 * calendar — every one of those asks is easier to say yes to once the job is
 * clear.
 *
 * Deliberately one screen, five lines, no illustration per item. An assistant
 * that oversells itself on the second screen is not understated, and
 * understated is the whole voice.
 */

import { CalendarDays, Bookmark, FileText, MessageCircle, Users } from "lucide-react";
import ArtyCharacter from "@/components/ArtyCharacter";
import { ArtySays, PrimaryButton, Reveal } from "@/components/ui";
import { copy } from "@/lib/fixtures";
import { useStore } from "@/lib/store";

/** Keyed by the id in copy.json, so the words and the icons cannot drift apart. */
/** One hue per promise: blue action, violet memory, sun admin, coral family. */
const ICON_HUES: Record<string, string> = {
  plan: "bg-accent-muted text-accent",
  remember: "bg-violet-tint text-violet-deep",
  admin: "bg-sun-tint text-ink",
  ask: "bg-accent-muted text-accent",
  everyone: "bg-coral-tint text-coral-deep",
};

const ICONS: Record<string, React.ReactNode> = {
  plan: <CalendarDays size={19} />,
  remember: <Bookmark size={19} />,
  admin: <FileText size={19} />,
  ask: <MessageCircle size={19} />,
  everyone: <Users size={19} />,
};

export default function Capabilities({ onNext }: { onNext: () => void }) {
  const { state } = useStore();

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pb-7 pt-4">
      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto">
        <div className="flex justify-center">
          <ArtyCharacter state={state.characterState} size={104} />
        </div>

        <Reveal className="space-y-2">
          <ArtySays lines={[copy.capabilities.lead]} />
          <p className="text-[15px] text-ink-secondary">{copy.capabilities.support}</p>
        </Reveal>

        <ul className="space-y-4">
          {copy.capabilities.items.map((item, index) => (
            <Reveal key={item.id} delay={0.06 + index * 0.06}>
              <li className="flex gap-3.5">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ICON_HUES[item.id] ?? "bg-accent-muted text-accent"}`}
                >
                  {ICONS[item.id]}
                </span>
                <span className="flex-1">
                  <span className="block text-[17px] font-semibold text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-[15px] leading-relaxed text-ink-secondary">
                    {item.body}
                  </span>
                </span>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>

      <div className="space-y-2 pt-4">
        <PrimaryButton onClick={onNext}>{copy.capabilities.continue}</PrimaryButton>
        <p className="text-center text-[13px] text-ink-secondary">{copy.capabilities.footnote}</p>
      </div>
    </div>
  );
}
