"use client";

/**
 * Onboarding.tsx
 *
 * The same journey as the native app: meet Arty, see what he actually does,
 * tell him who you live with, connect what already exists, and watch him work
 * something out. Authentication comes last, after the value has been shown.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Check, ChevronLeft, Mail, Mic, Square, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { isAIAvailable } from "@/lib/ai";
import { STEP_ORDER, useStore } from "@/lib/store";
import { useVoice } from "@/lib/useVoice";
import Capabilities from "./CapabilitiesStep";
import CharacterStep from "./CharacterStep";
import MontageStep from "./MontageStep";
import HouseholdConversation from "./HouseholdStep";

export default function Onboarding() {
  const { state, dispatch } = useStore();

  // Ask once whether this deployment has a model behind it, so the badge can
  // be honest about which brain just understood the sentence.
  useEffect(() => {
    let cancelled = false;
    isAIAvailable().then((available) => {
      if (!cancelled) dispatch({ type: "setAIAvailable", available });
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const advance = () => {
    const index = STEP_ORDER.indexOf(state.step ?? "welcome");
    const next = STEP_ORDER[index + 1];
    if (!next) {
      dispatch({ type: "finishOnboarding" });
      return;
    }
    dispatch({ type: "goTo", step: next });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {state.step !== "welcome" && <OnboardingHeader />}

      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.28 }}
          className="flex flex-1 flex-col overflow-hidden"
        >
          {state.step === "welcome" && <Welcome onNext={advance} />}
          {state.step === "capabilities" && <Capabilities onNext={advance} />}
          {state.step === "intro" && <Introduction onNext={advance} />}
          {state.step === "household" && <HouseholdConversation onNext={advance} />}
          {state.step === "connect" && <Connect onNext={advance} />}
          {state.step === "magic" && <MagicMoment onNext={advance} />}
          {state.step === "character" && <CharacterStep onNext={advance} />}
          {state.step === "montage" && <MontageStep onNext={advance} />}
          {state.step === "auth" && <Auth onNext={advance} />}
          {state.step === "invite" && <Invite onNext={advance} />}
          {state.step === "notifications" && <Notifications onNext={advance} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// MARK: - Chrome

/**
 * Back, and a quiet sense of place.
 *
 * Onboarding is a conversation, and a conversation can be rewound. Nothing in
 * it is a commitment until the household is saved.
 */
function OnboardingHeader() {
  const { state, dispatch } = useStore();
  const index = Math.max(STEP_ORDER.indexOf(state.step ?? "welcome"), 1);
  const total = STEP_ORDER.length - 1;

  return (
    <div className="flex items-center gap-3 px-6 pt-2">
      <button
        onClick={() => dispatch({ type: "goBack" })}
        aria-label="Back"
        className="flex h-11 w-11 items-center justify-center text-ink-secondary transition active:scale-95"
      >
        <ChevronLeft size={22} />
      </button>

      <span className="flex flex-1 items-center justify-center gap-1.5" aria-label={`Step ${index} of ${total}`}>
        {Array.from({ length: total }).map((_, position) => (
          <span
            key={position}
            className={`rounded-full transition-all ${
              position + 1 <= index ? "bg-accent" : "bg-hairline"
            } ${position + 1 === index ? "h-[7px] w-[7px]" : "h-[5px] w-[5px]"}`}
          />
        ))}
      </span>

      <span className="h-11 w-11" />
    </div>
  );
}

// MARK: - 1. Meet Arty

function Welcome({ onNext }: { onNext: () => void }) {
  const { state } = useStore();
  return (
    <div className="flex flex-1 flex-col items-center justify-between px-6 pb-7 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <ArtyCharacter state={state.characterState} size={230} />
        <Reveal delay={0.1} className="space-y-3 text-center">
          <h1 className="text-[44px] font-semibold leading-none text-ink">{copy.welcome.headline}</h1>
          <p className="text-[20px] text-ink-secondary">{copy.welcome.subheading}</p>
          <p className="mx-auto max-w-[320px] text-[17px] leading-relaxed text-ink-secondary">
            {copy.welcome.body}
          </p>
        </Reveal>
      </div>
      <Reveal delay={0.2} className="w-full space-y-3">
        <PrimaryButton onClick={onNext}>{copy.welcome.primary}</PrimaryButton>
        <SecondaryButton onClick={onNext}>{copy.welcome.secondary}</SecondaryButton>
      </Reveal>
    </div>
  );
}

// MARK: - 2. Introduction

function Introduction({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useStore();
  const [typing, setTyping] = useState(false);
  const [name, setName] = useState("");
  const acknowledged = state.ownerName.length > 0;

  const accept = useCallback(
    (value: string) => {
      const first = value
        .replace(/my name is|it's|i'm|call me/gi, "")
        .trim()
        .split(" ")[0];
      if (!first) return;
      dispatch({ type: "setName", name: first.charAt(0).toUpperCase() + first.slice(1) });
      dispatch({ type: "setCharacter", state: "pleased" });
    },
    [dispatch],
  );

  const speech = useVoice(accept);

  return (
    <div className="flex flex-1 flex-col px-6 pb-7 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <ArtyCharacter state={state.characterState} level={state.micLevel} size={190} />
        <div className="w-full">
          {acknowledged ? (
            <div className="space-y-2">
              <ArtySays lines={[fill(copy.introduction.acknowledgement, { name: state.ownerName })]} />
              {/* Arty may have misheard. Correcting a name should never mean
                  starting the conversation again. */}
              <InlineButton
                onClick={() => {
                  setName(state.ownerName);
                  setTyping(true);
                  dispatch({ type: "setName", name: "" });
                }}
              >
                Not quite? Change it
              </InlineButton>
            </div>
          ) : (
            <>
              <ArtySays lines={[copy.introduction.greeting, copy.introduction.purpose]} />
              <p className="mt-4 text-[20px] font-medium text-ink">{copy.introduction.askName}</p>
            </>
          )}
        </div>
        {speech.listening && <Waveform level={state.micLevel} />}
        {speech.partial && <p className="text-[18px] text-ink-secondary">{speech.partial}</p>}
        {speech.problem && (
          <p className="text-center text-[13px] text-ink-secondary">{speech.problem}</p>
        )}
      </div>

      <div className="space-y-3">
        {acknowledged ? (
          <PrimaryButton onClick={onNext}>Carry on</PrimaryButton>
        ) : typing ? (
          <>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && accept(name)}
              placeholder={copy.introduction.namePlaceholder}
              aria-label={copy.introduction.namePlaceholder}
              className="w-full rounded-full bg-muted px-5 py-3.5 text-[17px] outline-none"
            />
            <PrimaryButton disabled={name.trim().length === 0} onClick={() => accept(name)}>
              That&apos;s me
            </PrimaryButton>
          </>
        ) : (
          <>
            <PrimaryButton
              onClick={() => (speech.listening ? speech.stop() : speech.start("Nicky"))}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {speech.listening ? <Square size={17} /> : <Mic size={17} />}
                {speech.listening ? "Done" : copy.introduction.voiceAction}
              </span>
            </PrimaryButton>
            <SecondaryButton onClick={() => setTyping(true)}>
              {copy.introduction.typeAction}
            </SecondaryButton>
          </>
        )}
      </div>
    </div>
  );
}

// MARK: - 3. Who do you live with?

// MARK: - 4. Connect your life

function Connect({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useStore();
  const [inviteNote, setInviteNote] = useState(false);

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pb-7 pt-6">
      <div className="no-scrollbar flex-1 space-y-7 overflow-y-auto">
        <div className="flex justify-center">
          <ArtyCharacter state={state.characterState} size={120} />
        </div>

        <Reveal className="space-y-2">
          <ArtySays lines={[copy.connect.lead]} />
          <p className="text-[17px] text-ink-secondary">{copy.connect.support}</p>
        </Reveal>

        {!state.isDemo && (
          <Reveal delay={0.06} className="rounded-2xl bg-muted p-4">
            <p className="text-[14px] leading-relaxed text-ink-secondary">
              Calendar and email connections arrive with the iPhone app, where
              they are real. Nothing is simulated for your own household — what
              you see from here on is only what you tell Arty.
            </p>
          </Reveal>
        )}

        {state.isDemo && (
        <>
        <ConnectSection
          icon={<Calendar size={18} />}
          title={copy.connect.calendarTitle}
          body={copy.connect.calendarBody}
          action={copy.connect.calendarAction}
          connected={state.calendarConnected}
          connectedLabel={copy.connect.calendarConnected}
          onConnect={() => dispatch({ type: "connectCalendar" })}
          note={
            state.calendarConnected
              ? "In the iPhone app this is a real calendar connection."
              : undefined
          }
          delay={0.06}
        />

        <ConnectSection
          icon={<Mail size={18} />}
          title={copy.connect.emailTitle}
          body={copy.connect.emailBody}
          action={copy.connect.emailAction}
          connected={state.emailConnected}
          connectedLabel={copy.connect.emailDemoConnected}
          onConnect={() => dispatch({ type: "connectEmail" })}
          note={state.emailConnected ? copy.connect.emailHonesty : undefined}
          delay={0.12}
        />
        </>
        )}

        <Reveal delay={0.18} className="space-y-2.5">
          <h3 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
            <Users size={18} /> {copy.connect.familyTitle}
          </h3>
          <p className="text-[15px] text-ink-secondary">{copy.connect.familyBody}</p>
          <p className="text-[15px] text-ink-secondary">{copy.connect.familySupport}</p>
          <SecondaryButton onClick={() => setInviteNote(true)}>{copy.connect.familyAction}</SecondaryButton>
          {inviteNote && (
            <p className="text-[13px] text-ink-secondary">
              I&apos;ll help you do that in a moment, once you&apos;ve seen what I&apos;ve found.
            </p>
          )}
        </Reveal>
      </div>

      <div className="pt-4">
        <PrimaryButton onClick={onNext}>{copy.connect.continue}</PrimaryButton>
      </div>
    </div>
  );
}

function ConnectSection({
  icon,
  title,
  body,
  action,
  connected,
  connectedLabel,
  onConnect,
  note,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: string;
  connected: boolean;
  connectedLabel: string;
  onConnect: () => void;
  note?: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
        {icon} {title}
      </h3>
      <p className="text-[15px] text-ink-secondary">{body}</p>
      {connected ? (
        <p className="flex min-h-[44px] items-center gap-2 text-[15px] font-medium text-accent">
          <Check size={18} /> {connectedLabel}
        </p>
      ) : (
        <SecondaryButton onClick={onConnect}>{action}</SecondaryButton>
      )}
      {note && <p className="text-[13px] text-ink-secondary">{note}</p>}
    </Reveal>
  );
}

// MARK: - 5. The magic moment

function MagicMoment({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useStore();
  const [completed, setCompleted] = useState(0);
  const [turned, setTurned] = useState(false);
  const [revealed, setRevealed] = useState(0);

  const insights = state.snapshot.insights;

  useEffect(() => {
    dispatch({ type: "setCharacter", state: "thinking" });
    const timers: ReturnType<typeof setTimeout>[] = [];

    copy.magic.steps.forEach((_, index) => {
      timers.push(setTimeout(() => setCompleted(index + 1), (index + 1) * 620));
    });

    const turn = setTimeout(
      () => {
        setTurned(true);
        dispatch({ type: "setCharacter", state: "pleased" });
      },
      copy.magic.steps.length * 620 + 520,
    );
    timers.push(turn);

    insights.forEach((_, index) => {
      timers.push(
        setTimeout(
          () => setRevealed(index + 1),
          copy.magic.steps.length * 620 + 900 + index * 520,
        ),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [dispatch, insights]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pb-7 pt-6">
      <div className="no-scrollbar flex-1 space-y-7 overflow-y-auto">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {!turned && <FloatingObjects active={completed} />}
            <ArtyCharacter state={state.characterState} size={165} />
          </div>
          <p className="text-center text-[20px] font-medium text-ink">
            {turned
              ? insights.length > 0
                ? copy.magic.turn
                : copy.magic.emptyProduction
              : copy.magic.waiting}
          </p>
        </div>

        {turned ? (
          <div className="space-y-6">
            {insights.slice(0, revealed).map((insight) => {
              const accepted = state.acceptedInsightIds.includes(insight.id);
              return (
                <Reveal key={insight.id} className="space-y-2">
                  <p className="text-[17px] font-semibold text-ink">{insight.title}</p>
                  <p className="text-[20px] font-medium tabular-nums text-accent">{insight.detail}</p>
                  <p className="text-[15px] text-ink-secondary">{insight.body}</p>
                  {accepted ? (
                    <p className="flex min-h-[44px] items-center gap-2 text-[15px] text-ink-secondary">
                      <Check size={18} className="text-accent" />
                      {insight.acceptedResponse}
                    </p>
                  ) : (
                    <InlineButton onClick={() => dispatch({ type: "acceptInsight", id: insight.id })}>
                      {insight.action}
                    </InlineButton>
                  )}
                </Reveal>
              );
            })}
          </div>
        ) : (
          <ol className="space-y-4">
            {copy.magic.steps.map((step, index) => (
              <li
                key={step}
                className={`flex items-center gap-3 text-[17px] transition-opacity ${index <= completed ? "opacity-100" : "opacity-35"}`}
              >
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-hairline">
                  {index < completed && <Check size={13} className="text-accent" />}
                </span>
                <span className={index < completed ? "text-ink" : "text-ink-secondary"}>{step}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {turned && (
        <div className="pt-4">
          <PrimaryButton onClick={onNext}>{copy.magic.continue}</PrimaryButton>
        </div>
      )}
    </div>
  );
}

function FloatingObjects({ active }: { active: number }) {
  const symbols = ["📅", "✉️", "🎁", "🛒", "⏰"];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {symbols.map((symbol, index) => {
        const angle = (index / symbols.length) * Math.PI * 2;
        return (
          <motion.span
            key={symbol}
            className="absolute left-1/2 top-1/2 text-[15px]"
            style={{ opacity: index < Math.max(active, 1) ? 0.65 : 0.2 }}
            animate={{
              x: [Math.cos(angle) * 96, Math.cos(angle) * 110, Math.cos(angle) * 96],
              y: [Math.sin(angle) * 74, Math.sin(angle) * 64, Math.sin(angle) * 74],
            }}
            transition={{ duration: 2.4 + index * 0.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {symbol}
          </motion.span>
        );
      })}
    </div>
  );
}

// MARK: - 6. Save your household

function Auth({ onNext }: { onNext: () => void }) {
  const { state } = useStore();
  return (
    <div className="flex flex-1 flex-col justify-between px-6 pb-7 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <ArtyCharacter state={state.characterState} size={175} />
        <div className="w-full space-y-3">
          <ArtySays lines={[copy.auth.question]} />
          <p className="text-[17px] text-ink-secondary">{copy.auth.body}</p>
        </div>
      </div>
      <div className="space-y-3">
        <button
          onClick={onNext}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-black text-[17px] font-medium text-white"
        >
           {copy.auth.action}
        </button>
        <SecondaryButton onClick={onNext}>{copy.auth.skip}</SecondaryButton>
        <p className="text-center text-[13px] text-ink-secondary">
          On the iPhone this is the real Sign in with Apple sheet. In this web prototype it is a
          demonstration only, and nothing is sent anywhere.
        </p>
      </div>
    </div>
  );
}

// MARK: - 7. Invite family

function Invite({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useStore();
  const members =
    state.extractedMembers.length > 0
      ? state.extractedMembers
      : state.snapshot.household.members.map((member) => ({
          id: member.id,
          name: member.name,
          role: member.role,
        }));
  const invitee = members.find((member) => member.role === "adult");

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pb-7 pt-6">
      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto">
        <div className="flex justify-center">
          <ArtyCharacter state={state.characterState} size={125} />
        </div>
        <Reveal className="space-y-2.5">
          <ArtySays lines={[copy.invite.lead]} />
          <p className="text-[17px] text-ink-secondary">{copy.invite.body}</p>
        </Reveal>

        <div className="divide-y divide-hairline">
          {members.map((member, index) => (
            <div key={member.id} className="flex min-h-[52px] items-center gap-3.5">
              <MemberChip
                name={member.name}
                colorToken={["artyTeal", "artyPlum", "artyAmber", "artySage"][index % 4]}
                size={36}
              />
              <span className="flex-1 text-[17px] font-medium text-ink">{member.name}</span>
              <span
                className={`text-[15px] ${member.role === "adult" ? "text-accent" : "text-ink-secondary"}`}
              >
                {member.role === "owner"
                  ? copy.invite.you
                  : member.role === "child"
                    ? copy.invite.childLabel
                    : copy.invite.inviteAction}
              </span>
            </div>
          ))}
        </div>

        {state.invitedName && (
          <Reveal className="space-y-1">
            <p className="text-[15px] font-medium text-accent">
              {fill(copy.invite.sent, { name: state.invitedName })}
            </p>
            <p className="text-[13px] text-ink-secondary">{copy.invite.linkNote}</p>
          </Reveal>
        )}
      </div>

      <div className="space-y-3 pt-4">
        {invitee && (
          <PrimaryButton
            onClick={() => {
              dispatch({ type: "invite", name: invitee.name });
              window.setTimeout(onNext, 1400);
            }}
          >
            {fill(copy.invite.primary, { name: invitee.name })}
          </PrimaryButton>
        )}
        <SecondaryButton onClick={onNext}>{copy.invite.secondary}</SecondaryButton>
        <p className="text-center text-[13px] text-ink-secondary">{copy.invite.supporting}</p>
      </div>
    </div>
  );
}

// MARK: - 8. How much should I bother you?

function Notifications({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useStore();

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pb-7 pt-6">
      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto">
        <div className="flex justify-center">
          <ArtyCharacter state={state.characterState} size={115} />
        </div>
        <ArtySays lines={[copy.notifications.title]} />

        <div className="space-y-2.5">
          {copy.notifications.options.map((option, index) => {
            const selected = state.notificationAppetite === option.id;
            return (
              <Reveal key={option.id} delay={index * 0.06}>
                <button
                  onClick={() => dispatch({ type: "setAppetite", id: option.id })}
                  aria-pressed={selected}
                  className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-accent bg-accent-muted/40" : "border-transparent bg-muted"}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[17px] font-semibold text-ink">{option.title}</span>
                    {option.recommended && (
                      <span className="rounded-full bg-accent-muted px-2 py-0.5 text-[11px] font-semibold text-accent">
                        Recommended
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[15px] text-ink-secondary">{option.body}</span>
                </button>
              </Reveal>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 pt-4">
        <PrimaryButton onClick={onNext}>{copy.notifications.continue}</PrimaryButton>
        <p className="text-center text-[13px] text-ink-secondary">
          Arty sends the morning briefing at 7:30. You can change this any time.
        </p>
      </div>
    </div>
  );
}

