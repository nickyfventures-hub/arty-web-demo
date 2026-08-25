"use client";

/**
 * HouseholdStep.tsx
 *
 * "Who do you live with?" — the first time Arty demonstrably turns a sentence
 * into structure, and the moment the product either lands or it doesn't.
 *
 * Two things matter here beyond the extraction itself:
 *
 *  - **It is understood by a model where one is available.** `lib/ai.ts` calls
 *    the server route; if there is no key, no network, or the answer comes back
 *    unusable, the rule-based extractors at the bottom of this file take over.
 *    Onboarding must never dead-end because a model was unavailable.
 *
 *  - **Whatever Arty heard can be corrected.** He may have spelled a child's
 *    name wrong, and a misspelled child's name is exactly the kind of small
 *    wrongness that stops a family trusting him with anything larger.
 */

import { AnimatePresence } from "framer-motion";
import { Mic, Pencil, Plus, Sparkles, Square } from "lucide-react";
import { useCallback, useState } from "react";
import ArtyCharacter from "@/components/ArtyCharacter";
import {
  ArtySays,
  InlineButton,
  MemberChip,
  PrimaryButton,
  Reveal,
  SecondaryButton,
  Waveform,
} from "@/components/ui";
import { copy, fill } from "@/lib/fixtures";
import { extractDetails, extractMembers } from "@/lib/ai";
import { useStore, type HouseholdStage } from "@/lib/store";
import { useVoice } from "@/lib/useVoice";
import { MemberEditor } from "./MemberEditor";

const TINTS = ["artyTeal", "artyPlum", "artyAmber", "artySage"];

export default function HouseholdConversation({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useStore();
  const stage: HouseholdStage = state.householdStage;
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [usedAI, setUsedAI] = useState(false);

  const setStage = useCallback(
    (next: HouseholdStage) => dispatch({ type: "setHouseholdStage", stage: next }),
    [dispatch],
  );

  const submit = useCallback(
    (text: string) => {
      setDraft("");
      setThinking(true);
      dispatch({ type: "setCharacter", state: "thinking" });

      const run = async () => {
        if (stage === "who") {
          const members = await extractMembers(text, state.ownerName, ruleExtractMembers);
          setUsedAI(state.aiAvailable);
          dispatch({ type: "setExtraction", members, facts: [] });
          dispatch({ type: "setCharacter", state: "confirming" });
          setThinking(false);
          window.setTimeout(() => {
            setStage("detail");
            dispatch({ type: "setCharacter", state: "idle" });
          }, 1400);
          return;
        }

        const facts = await extractDetails(text, state.extractedMembers, ruleExtractFacts);
        setUsedAI(state.aiAvailable);
        dispatch({ type: "setExtraction", members: state.extractedMembers, facts });
        dispatch({ type: "setCharacter", state: "pleased" });
        setThinking(false);
        setStage("summary");
      };

      void run();
    },
    [dispatch, setStage, stage, state.aiAvailable, state.extractedMembers, state.ownerName],
  );

  const speech = useVoice(submit);
  const example = stage === "who" ? copy.household.whoExample : copy.household.detailExample;
  const editingMember = state.extractedMembers.find((member) => member.id === editingId) ?? null;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden px-6 pb-7 pt-2">
      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto">
        <div className="flex justify-center">
          <ArtyCharacter state={state.characterState} level={state.micLevel} size={140} />
        </div>

        {stage === "summary" ? (
          <Summary
            usedAI={usedAI}
            onEdit={(id) => setEditingId(id)}
            onAdd={() => setAdding(true)}
          />
        ) : (
          <Prompt stage={stage} />
        )}

        {speech.listening && <Waveform level={state.micLevel} />}
        {speech.problem && (
          <p className="text-[13px] text-ink-secondary">{speech.problem}</p>
        )}
        {speech.partial && <p className="text-[18px] text-ink-secondary">{speech.partial}</p>}
        {thinking && (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary">
            {state.aiAvailable && <Sparkles size={12} className="text-accent" />}
            {copy.assistant.thinking}
          </p>
        )}
      </div>

      <div className="space-y-3 pt-4">
        {stage === "summary" ? (
          state.isEditingHousehold ? (
            <>
              <PrimaryButton onClick={() => dispatch({ type: "setEditingHousehold", editing: false })}>
                Done
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  dispatch({ type: "setEditingHousehold", editing: false });
                  setStage("detail");
                }}
              >
                Tell Arty again instead
              </SecondaryButton>
            </>
          ) : (
            <>
              <PrimaryButton onClick={onNext}>{copy.household.confirm}</PrimaryButton>
              <SecondaryButton onClick={() => dispatch({ type: "setEditingHousehold", editing: true })}>
                {copy.household.edit}
              </SecondaryButton>
            </>
          )
        ) : typing ? (
          <>
            <textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Tell Arty"
              aria-label="Tell Arty"
              className="w-full resize-none rounded-2xl bg-muted p-4 text-[17px] outline-none"
            />
            <div className="flex items-center justify-between">
              <InlineButton onClick={() => setDraft(example)}>Use the example</InlineButton>
              <InlineButton disabled={draft.trim().length === 0} onClick={() => submit(draft)}>
                Send
              </InlineButton>
            </div>
          </>
        ) : (
          <>
            <PrimaryButton
              disabled={thinking}
              onClick={() => (speech.listening ? speech.stop() : speech.start(example))}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {speech.listening ? <Square size={17} /> : <Mic size={17} />}
                {speech.listening ? "Done" : "Tell Arty"}
              </span>
            </PrimaryButton>
            <SecondaryButton onClick={() => setTyping(true)}>
              {copy.introduction.typeAction}
            </SecondaryButton>
          </>
        )}
      </div>

      <AnimatePresence>
        {editingMember && (
          <MemberEditor
            key="edit"
            member={editingMember}
            canDelete={state.extractedMembers.length > 1}
            onSave={(name, role) => {
              dispatch({ type: "updateMember", id: editingMember.id, name, role });
              setEditingId(null);
            }}
            onDelete={() => {
              dispatch({ type: "removeMember", id: editingMember.id });
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
          />
        )}
        {adding && (
          <MemberEditor
            key="add"
            title="Add someone"
            member={{ id: "new", name: "", role: "adult" }}
            canDelete={false}
            onSave={(name, role) => {
              dispatch({ type: "addMember", name, role: role === "owner" ? "adult" : role });
              setAdding(false);
            }}
            onDelete={() => setAdding(false)}
            onClose={() => setAdding(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// MARK: - Pieces

function Prompt({ stage }: { stage: HouseholdStage }) {
  const { state } = useStore();
  return (
    <div className="space-y-4">
      {stage === "detail" && state.extractedMembers.length > 0 && (
        <p className="text-[20px] font-medium text-accent">
          {fill(copy.household.gotIt, { count: String(state.extractedMembers.length) })}
        </p>
      )}
      <ArtySays lines={[stage === "who" ? copy.household.whoPrompt : copy.household.detailPrompt]} />
      {stage === "who" && <p className="text-[17px] text-ink-secondary">{copy.household.whoSupporting}</p>}
      <div className="space-y-2.5">
        {state.extractedMembers.map((member, index) => (
          <Reveal key={member.id} delay={index * 0.09}>
            <div className="flex items-center gap-3">
              <MemberChip name={member.name} colorToken={TINTS[index % 4]} size={34} />
              <span className="text-[17px] font-medium text-ink">{member.name}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function Summary({
  usedAI,
  onEdit,
  onAdd,
}: {
  usedAI: boolean;
  onEdit: (id: string) => void;
  onAdd: () => void;
}) {
  const { state } = useStore();

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-semibold text-ink">{copy.household.summaryTitle}</h2>
        {usedAI && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-violet-tint px-2 py-0.5 text-[12px] font-medium text-violet-deep">
            <Sparkles size={12} /> Understood by AI
          </span>
        )}
      </div>

      {state.isEditingHousehold && (
        <p className="text-[15px] text-ink-secondary">
          Tap anyone to fix a spelling or change who they are.
        </p>
      )}

      <div className="space-y-1">
        {state.extractedMembers.map((member, index) => {
          const lines = state.extractedFacts.find((fact) => fact.name === member.name)?.lines ?? [];
          return (
            <Reveal key={member.id} delay={index * 0.08}>
              <button
                onClick={() => state.isEditingHousehold && onEdit(member.id)}
                disabled={!state.isEditingHousehold}
                aria-label={state.isEditingHousehold ? `Edit ${member.name}` : member.name}
                className="flex min-h-[48px] w-full items-start gap-3 py-2 text-left"
              >
                <MemberChip name={member.name} colorToken={TINTS[index % 4]} size={34} />
                <span className="flex-1">
                  <span className="block text-[17px] font-semibold text-ink">{member.name}</span>
                  {lines.map((line) => (
                    <span key={line} className="block text-[15px] text-ink-secondary">
                      {line}
                    </span>
                  ))}
                  {lines.length === 0 && member.role === "child" && (
                    <span className="block text-[15px] text-ink-secondary">Child</span>
                  )}
                </span>
                {state.isEditingHousehold && <Pencil size={15} className="mt-1.5 text-accent" />}
              </button>
            </Reveal>
          );
        })}
      </div>

      {state.isEditingHousehold ? (
        <InlineButton onClick={onAdd}>
          <span className="inline-flex items-center gap-1.5">
            <Plus size={15} /> Add someone
          </span>
        </InlineButton>
      ) : (
        state.extractedFacts.length === 0 && (
          <p className="text-[15px] text-ink-secondary">
            Just the {state.extractedMembers.length} of you, then. I&apos;ll learn the rest as we go.
          </p>
        )
      )}
    </div>
  );
}

// MARK: - The fallback

/**
 * The rule-based extractors. These run when no model is available, and they are
 * a deliberate mirror of DemoIntentEngine.swift so both prototypes degrade the
 * same way.
 */
export function ruleExtractMembers(text: string, ownerName: string) {
  const adultWords = ["partner", "wife", "husband", "girlfriend", "boyfriend"];
  const childWords = ["girls", "boys", "kids", "children", "son", "daughter", "baby", "twins"];
  const members: { id: string; name: string; role: "owner" | "adult" | "child" }[] = [];

  if (ownerName) members.push({ id: ownerName.toLowerCase(), name: ownerName, role: "owner" });

  let hint: "adult" | "child" = "adult";
  for (const token of text.split(/[\s,.;:!?]+/).filter(Boolean)) {
    const lowered = token.toLowerCase();
    if (adultWords.includes(lowered)) {
      hint = "adult";
      continue;
    }
    if (childWords.includes(lowered)) {
      hint = "child";
      continue;
    }
    if (!/^[A-Z][a-z]{1,}$/.test(token)) continue;
    if (token.toLowerCase() === ownerName.toLowerCase()) continue;
    if (members.some((member) => member.name.toLowerCase() === lowered)) continue;
    members.push({ id: lowered, name: token, role: hint });
  }
  return members;
}

export function ruleExtractFacts(
  text: string,
  members: { id: string; name: string; role: string }[],
): { name: string; lines: string[] }[] {
  const numbers: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  };
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const facts: { name: string; lines: string[] }[] = [];

  for (const sentence of text.split(/[.!?\n]+/).map((part) => part.trim()).filter(Boolean)) {
    const lowered = sentence.toLowerCase();
    const member = members.find((entry) => lowered.includes(entry.name.toLowerCase()));
    const lines: string[] = [];

    const ageWord = Object.keys(numbers).find((word) => lowered.includes(` is ${word}`));
    const ageDigit = lowered.match(/\bis (\d{1,2})\b/);
    if (ageWord) lines.push(`Age ${numbers[ageWord]}`);
    else if (ageDigit) lines.push(`Age ${ageDigit[1]}`);
    else if (lowered.includes("baby")) lines.push("Baby");

    if (lowered.includes("nursery")) {
      const days = weekdays
        .filter((day) => lowered.includes(day))
        .map((day) => day.charAt(0).toUpperCase() + day.slice(1));
      lines.push(days.length > 0 ? `Nursery ${days.join(" + ")}` : "Nursery");
    }
    if (lowered.includes("work")) {
      const count = Object.keys(numbers).find((word) => lowered.includes(word));
      if (count) lines.push(`Works ${numbers[count]} days`);
    }

    if (member && lines.length > 0) {
      facts.push({ name: member.name, lines });
    } else if (!member && lowered.includes("no pets")) {
      facts.push({ name: "Household", lines: ["No pets"] });
    }
  }
  return facts;
}
