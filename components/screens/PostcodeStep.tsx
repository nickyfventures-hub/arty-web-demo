"use client";

/**
 * PostcodeStep — "Where's home?"
 *
 * One input, told once, kept as household context. This is the seed for
 * everything local — bin days, weather, travel, local plans — and the rule
 * is the same as every other fact: Arty never asks for it again.
 */

import { useState } from "react";
import ArtyCharacter from "@/components/ArtyCharacter";
import { ArtySays, PrimaryButton, Reveal, SecondaryButton } from "@/components/ui";
import { track } from "@/lib/analytics";
import { copy } from "@/lib/fixtures";
import { useStore } from "@/lib/store";

export default function PostcodeStep({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useStore();
  const [value, setValue] = useState(state.postcode);
  const [noted, setNoted] = useState(false);

  const accept = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    dispatch({ type: "setPostcode", postcode: trimmed });
    dispatch({ type: "setCharacter", state: "pleased" });
    track("onboarding_postcode_completed", {});
    setNoted(true);
  };

  return (
    <div className="flex flex-1 flex-col px-6 pb-7 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <ArtyCharacter state={state.characterState} size={170} />
        <div className="w-full space-y-2">
          <ArtySays lines={[copy.postcode.lead]} />
          <p className="text-[15px] leading-relaxed text-ink-secondary">{copy.postcode.support}</p>
        </div>
        {noted && (
          <p className="w-full text-[15px] font-medium text-leaf-deep">{copy.postcode.noted}</p>
        )}
      </div>

      <div className="space-y-3">
        {noted ? (
          <PrimaryButton onClick={onNext}>Carry on</PrimaryButton>
        ) : (
          <>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === "Enter" && accept()}
              placeholder={copy.postcode.placeholder}
              aria-label={copy.postcode.placeholder}
              autoCapitalize="characters"
              className="w-full rounded-full bg-muted px-5 py-3.5 text-center text-[17px] tracking-wide outline-none"
            />
            <PrimaryButton disabled={value.trim().length < 3} onClick={accept}>
              {copy.postcode.action}
            </PrimaryButton>
            <SecondaryButton onClick={onNext}>{copy.postcode.skip}</SecondaryButton>
          </>
        )}
      </div>
    </div>
  );
}
