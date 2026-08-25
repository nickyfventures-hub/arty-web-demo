"use client";

/**
 * MainApp.tsx
 *
 * Three destinations: Calendar, Arty, Plan. Arty is the middle action and is
 * visually dominant. Shopping and Settings are sheets, not tabs.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ListChecks,
  Mic,
  Plus,
  Send,
  Square,
  UserCircle2,
  X,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArtyCharacter from "@/components/ArtyCharacter";
import { CharacterPicker } from "./CharacterStep";
import MagicShowcase, { DemoDevPanel } from "./MagicShowcase";
import { track } from "@/lib/analytics";
import { canonicaliseUtterance, isAIAvailable } from "@/lib/ai";
import { useSpeak } from "@/lib/voiceOut";
import { clearSession } from "@/lib/session";
import {
  ArtySays,
  EmptyState,
  InlineButton,
  MemberChip,
  PrimaryButton,
  Reveal,
  Row,
  SecondaryButton,
  SectionHeader,
  Waveform,
} from "@/components/ui";
import {
  copy,
  fill,
  formatLongDay,
  formatTime,
  isSameDay,
  memberById,
  startOfDay,
  wholeDaysBetween,
} from "@/lib/fixtures";
import { buildDay, buildWeek, greeting, statusLine, weekInsights } from "@/lib/plan";
import { respond } from "@/lib/intent";
import { useStore } from "@/lib/store";
import { useVoice } from "@/lib/useVoice";

export default function MainApp() {
  const { state, dispatch } = useStore();

  // Which brain is available? Probed once, so the assistant can hand
  // understanding to Claude when a key is configured.
  useEffect(() => {
    let cancelled = false;
    isAIAvailable().then((available) => {
      if (!cancelled) dispatch({ type: "setAIAvailable", available });
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        {state.tab === "plan" ? <PlanScreen /> : <CalendarScreen />}
      </div>

      <Suspense>
        <MagicShowcase />
        <DemoDevPanel />
      </Suspense>

      <BottomNav />

      <AnimatePresence>
        {state.overlay === "arty" && <Sheet full key="arty"><AssistantScreen /></Sheet>}
        {state.overlay === "shopping" && <Sheet key="shopping"><ShoppingSheet /></Sheet>}
        {state.overlay === "settings" && <Sheet key="settings"><SettingsSheet /></Sheet>}
        {state.overlay === "child" && <Sheet full key="child"><ChildModeScreen /></Sheet>}
      </AnimatePresence>
    </div>
  );
}

// MARK: - Bottom navigation

function BottomNav() {
  const { state, dispatch } = useStore();

  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-3">
      <div className="pointer-events-auto flex w-[min(340px,88%)] items-center justify-between rounded-full border border-white/60 bg-white/80 px-4 py-2 shadow-[0_10px_30px_rgba(28,27,25,0.12)] backdrop-blur-xl">
        <TabButton
          label="Calendar"
          icon={<CalendarDays size={19} />}
          active={state.tab === "calendar"}
          onClick={() => dispatch({ type: "setTab", tab: "calendar" })}
        />

        <ArtyNavButton />

        <TabButton
          label="Plan"
          icon={<ListChecks size={19} />}
          active={state.tab === "plan"}
          onClick={() => dispatch({ type: "setTab", tab: "plan" })}
        />
      </div>
    </nav>
  );
}

/**
 * The centre of the product. A tap opens the conversation; press and hold is
 * push-to-talk — Arty starts listening the moment the hold registers, and
 * what you said is sent the moment you let go. The character reacting on the
 * press, before a word is recognised, is the same rule the microphone
 * follows everywhere else.
 */
function ArtyNavButton() {
  const { state, dispatch } = useStore();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const HOLD_MS = 350;

  const release = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (held.current) {
      held.current = false;
      dispatch({ type: "setPTT", active: false });
    }
    window.removeEventListener("pointerup", release);
    window.removeEventListener("pointercancel", release);
  }, [dispatch]);

  const press = () => {
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      // Open the conversation already listening. The release, wherever the
      // finger ends up, stops the microphone and sends.
      dispatch({ type: "setOverlay", overlay: "arty" });
      dispatch({ type: "setPTT", active: true });
    }, HOLD_MS);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
  };

  useEffect(() => () => release(), [release]);

  return (
    <button
      onPointerDown={press}
      onClick={() => {
        // A hold already opened the conversation; don't reopen on the
        // trailing click.
        if (!held.current) dispatch({ type: "setOverlay", overlay: "arty" });
      }}
      onContextMenu={(event) => event.preventDefault()}
      aria-label="Arty. Tap to ask, or hold to talk."
      className="-mt-4 flex h-[66px] w-[66px] touch-none select-none items-center justify-center rounded-full bg-accent shadow-[0_8px_20px_rgba(31,111,107,0.32)] transition active:scale-95"
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
    >
      <ArtyCharacter state={state.characterState} size={58} />
    </button>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[48px] w-[92px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-accent" : "text-ink-secondary"}`}
    >
      {icon}
      {label}
    </button>
  );
}

// MARK: - Sheets

function Sheet({ children, full }: { children: React.ReactNode; full?: boolean }) {
  const { dispatch } = useStore();
  return (
    <motion.div
      initial={{ y: full ? "100%" : "40%", opacity: full ? 1 : 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: full ? "100%" : "40%", opacity: full ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden bg-canvas ${full ? "top-0" : "top-[18%] rounded-t-3xl shadow-[0_-8px_40px_rgba(28,27,25,0.18)]"}`}
    >
      <div className="flex justify-end p-3">
        <button
          onClick={() => dispatch({ type: "setOverlay", overlay: "none" })}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center text-ink-secondary"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </motion.div>
  );
}

// MARK: - Plan

function PlanScreen() {
  const { state, dispatch } = useStore();
  const offset = state.segment === "tomorrow" ? 1 : 0;
  const day = useMemo(
    () => buildDay(state.snapshot, offset, state.now),
    [state.snapshot, offset, state.now],
  );
  const week = useMemo(() => buildWeek(state.snapshot, state.now), [state.snapshot, state.now]);

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-6 pb-32 pt-6">
      <Reveal className="flex items-start gap-3.5">
        <ArtyCharacter state={state.characterState} size={62} />
        <div className="flex-1 pt-2.5">
          <h1 className="text-[22px] font-semibold text-ink">
            {greeting(state.ownerName || "there", state.now)}
          </h1>
          <p className="text-[15px] text-ink-secondary">{statusLine(day)}</p>
          {/* Nobody should be able to mistake the Faircloughs for their own
              family, or a simulated calendar for a connected one. */}
          {state.isDemo && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-accent-muted px-2.5 py-1 text-[12px] font-medium text-accent">
                Demo household
              </span>
              <button
                onClick={() => dispatch({ type: "startMagic", scenario: "full" })}
                className="inline-flex min-h-[28px] items-center rounded-full border border-accent/40 px-2.5 text-[12px] font-medium text-accent transition active:scale-95"
              >
                See what Arty&rsquo;s been doing
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => dispatch({ type: "setOverlay", overlay: "settings" })}
          aria-label="Household and settings"
          className="mt-2 flex h-11 w-11 items-center justify-center text-ink-secondary"
        >
          <UserCircle2 size={24} />
        </button>
      </Reveal>

      <Reveal delay={0.05} className="mt-6">
        <div className="flex rounded-xl bg-muted p-1">
          {(["today", "tomorrow", "week"] as const).map((segment, index) => (
            <button
              key={segment}
              onClick={() => dispatch({ type: "setSegment", segment })}
              aria-pressed={state.segment === segment}
              className={`min-h-[44px] flex-1 rounded-lg text-[14px] font-medium transition ${state.segment === segment ? "bg-white text-ink shadow-sm" : "text-ink-secondary"}`}
            >
              {copy.plan.segments[index]}
            </button>
          ))}
        </div>
      </Reveal>

      <div className="mt-6">
        {state.segment === "week" ? (
          <WeekList rows={week} />
        ) : (
          <>
            <p className="mb-3 text-[17px] font-semibold text-ink-secondary">{day.headline}</p>
            {day.items.length === 0 ? (
              <EmptyState title={copy.empty.todayTitle} message="Nothing booked." />
            ) : (
              day.items.map((item, index) => (
                <Reveal key={item.id} delay={Math.min(index * 0.045, 0.5)}>
                  <Row
                    time={item.style === "insight" ? "" : item.time}
                    title={item.title}
                    details={item.details}
                    muted={item.style === "anchor" || item.style === "insight"}
                    trailing={
                      item.memberId ? (
                        <MemberChipFor id={item.memberId} />
                      ) : undefined
                    }
                  />
                  {item.action && (
                    <div className="pb-3 pl-[70px]">
                      <InlineButton
                        onClick={() => {
                          if (item.action?.kind === "addIngredients") {
                            const meal = state.snapshot.meals.find((entry) =>
                              isSameDay(entry.date, day.date),
                            );
                            dispatch({ type: "addItems", items: meal?.missingIngredients ?? [] });
                            dispatch({ type: "setOverlay", overlay: "shopping" });
                          } else {
                            dispatch({
                              type: "setOverlay",
                              overlay: "arty",
                              prefill: "Find something for us to do this afternoon",
                            });
                          }
                        }}
                      >
                        {item.action.title}
                      </InlineButton>
                    </div>
                  )}
                </Reveal>
              ))
            )}
          </>
        )}
      </div>

      {state.segment !== "week" && day.watchlist.length > 0 && (
        <div className="mt-8">
          <SectionHeader>{copy.plan.watchingTitle}</SectionHeader>
          <div className="mt-2 divide-y divide-hairline">
            {day.watchlist.map((entry) => (
              <button
                key={entry.id}
                onClick={() =>
                  entry.id === "shopping"
                    ? dispatch({ type: "setOverlay", overlay: "shopping" })
                    : dispatch({ type: "setTab", tab: "calendar" })
                }
                className="flex min-h-[44px] w-full items-center gap-3 text-left"
              >
                <span className="flex-1 text-[15px] text-ink">{entry.title}</span>
                <span className="text-[15px] tabular-nums text-ink-secondary">{entry.detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberChipFor({ id }: { id: string }) {
  const { state } = useStore();
  const member = memberById(state.snapshot, id);
  if (!member) return null;
  return <MemberChip name={member.name} colorToken={member.colorToken} size={26} />;
}

function WeekList({ rows }: { rows: ReturnType<typeof buildWeek> }) {
  const { state, dispatch } = useStore();
  const insights = weekInsights(rows);

  return (
    <div>
      <div className="divide-y divide-hairline">
        {rows.map((row, index) => (
          <Reveal key={row.weekday} delay={Math.min(index * 0.04, 0.3)}>
            <div className="flex items-start gap-4 py-3">
              <span className="w-[86px] shrink-0 text-[15px] font-medium text-ink">{row.weekday}</span>
              <span className="flex-1">
                {row.parts.length === 0 ? (
                  <span className="text-[15px] text-ink-secondary">{copy.plan.free}</span>
                ) : (
                  <span className="text-[15px] text-ink-secondary">{row.parts.join(" · ")}</span>
                )}
                {row.notes.map((note) => (
                  <span key={note} className="mt-0.5 block text-[13px] text-attention">
                    {note}
                  </span>
                ))}
              </span>
            </div>
          </Reveal>
        ))}
      </div>

      {insights.length > 0 && (
        <div className="mt-6 space-y-2.5">
          {insights.map((insight) => (
            <p key={insight} className="text-[15px] text-ink-secondary">
              {insight}
            </p>
          ))}
          <InlineButton
            onClick={() =>
              dispatch({
                type: "setOverlay",
                overlay: "arty",
                prefill: "Find something for us to do at the weekend",
              })
            }
          >
            Plan something
          </InlineButton>
        </div>
      )}
    </div>
  );
}

// MARK: - Calendar

function CalendarScreen() {
  const { state, dispatch } = useStore();
  const [filter, setFilter] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const from = startOfDay(state.now).getTime();
    const filtered = state.snapshot.events
      .filter((event) => event.start.getTime() >= from)
      .filter((event) => filter === null || event.memberId === filter)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const buckets = new Map<number, typeof filtered>();
    for (const event of filtered) {
      const key = startOfDay(event.start).getTime();
      buckets.set(key, [...(buckets.get(key) ?? []), event]);
    }
    return [...buckets.entries()].sort(([a], [b]) => a - b);
  }, [state.snapshot.events, state.now, filter]);

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-6 pb-32 pt-6">
      <h1 className="text-[34px] font-semibold text-ink">{copy.calendar.title}</h1>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip label={copy.calendar.allFilter} active={filter === null} onClick={() => setFilter(null)} />
        {state.snapshot.household.members.map((member) => (
          <FilterChip
            key={member.id}
            label={member.name}
            active={filter === member.id}
            onClick={() => setFilter(member.id)}
          />
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {grouped.length === 0 ? (
          <EmptyState
            title={copy.calendar.emptyTitle}
            message={copy.calendar.emptyBody}
            actionTitle="Tell Arty"
            onAction={() => dispatch({ type: "setOverlay", overlay: "arty" })}
          />
        ) : (
          grouped.map(([key, events]) => {
            const date = new Date(key);
            const days = wholeDaysBetween(state.now, date);
            const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : formatLongDay(date);
            return (
              <div key={key}>
                <p className="mb-1 text-[15px] font-semibold text-ink-secondary">{label}</p>
                {events.map((event) => (
                  <Row
                    key={event.id}
                    time={event.allDay ? "All day" : formatTime(event.start)}
                    title={event.title}
                    details={[
                      ...(event.leaveAt ? [`Leave ${formatTime(event.leaveAt)}`] : []),
                      ...event.bring,
                      ...(!event.leaveAt && event.bring.length === 0 && event.location
                        ? [event.location]
                        : []),
                    ]}
                    trailing={event.memberId ? <MemberChipFor id={event.memberId} /> : undefined}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[44px] shrink-0 rounded-full px-4 text-[15px] transition ${active ? "bg-accent font-semibold text-white" : "bg-muted text-ink"}`}
    >
      {label}
    </button>
  );
}

// MARK: - Arty

function AssistantScreen() {
  const { state, dispatch } = useStore();
  const [input, setInput] = useState(state.artyPrefill);
  const [followUp, setFollowUp] = useState<ReturnType<typeof respond>["followUp"]>(undefined);
  const voice = useSpeak();
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [state.transcript.length, followUp]);

  const submit = useCallback(
    (text: string, resolving?: { followUpId: string; optionId: string }) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      dispatch({
        type: "addTurn",
        turn: { id: `p-${Date.now()}`, speaker: "person", text: trimmed, confirmations: [] },
      });
      dispatch({ type: "setCharacter", state: "thinking" });
      setInput("");
      setFollowUp(undefined);

      const timer = setTimeout(async () => {
        // When the brain is configured, let Claude decide what was MEANT;
        // the deterministic engine still owns what happens next, so effects
        // and permissions stay on one code path whichever brain answered.
        let understood = trimmed;
        if (state.aiAvailable && !resolving) {
          const canonical = await canonicaliseUtterance(trimmed).catch(() => null);
          if (canonical) understood = canonical;
        }
        const reply = respond(understood, state.snapshot, { now: state.now, resolving });

        for (const effect of reply.effects) {
          if (effect.kind === "addItems" && effect.items) {
            dispatch({ type: "addItems", items: effect.items });
          }
          if (effect.kind === "createReminder") {
            dispatch({ type: "addReminder" });
          }
        }

        dispatch({
          type: "addTurn",
          turn: {
            id: `a-${Date.now()}`,
            speaker: "arty",
            text: reply.message,
            confirmations: reply.confirmations,
            followUp: reply.followUp,
          },
        });
        dispatch({ type: "setCharacter", state: reply.characterState });
        setFollowUp(reply.followUp);
        void voice.speak(reply.message);

        timers.current.push(
          setTimeout(() => dispatch({ type: "setCharacter", state: "idle" }), 2400),
        );
      }, 620);
      timers.current.push(timer);
    },
    [dispatch, state.now, state.snapshot, state.aiAvailable, voice],
  );

  // A real microphone where the browser allows one, and the scripted example
  // behind it where it does not. Either way the ears move on the tap.
  const speech = useVoice(submit);

  // Push-to-talk from the centre button. The flag rising starts the ears;
  // the flag falling stops them, and stopping is what sends what was heard.
  const pttStarted = useRef(false);
  useEffect(() => {
    if (state.ptt && !speech.listening && !pttStarted.current) {
      pttStarted.current = true;
      speech.start("Add milk, nappies and dishwasher tablets");
    }
    if (!state.ptt && pttStarted.current) {
      pttStarted.current = false;
      if (speech.listening) speech.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ptt, speech.listening]);

  const listen = () => {
    if (speech.listening) {
      speech.stop();
      dispatch({ type: "setCharacter", state: "idle" });
      return;
    }
    speech.start("Add milk, nappies and dishwasher tablets");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scroller} className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-6">
        <div className="flex flex-col items-center gap-4">
          <ArtyCharacter state={state.characterState} level={state.micLevel} size={165} />
          {speech.listening ? (
            <>
              <Waveform level={state.micLevel} />
              <p className="text-[13px] font-medium text-accent">{copy.assistant.listening}</p>
            </>
          ) : state.transcript.length === 0 ? (
            <p className="text-[22px] font-medium text-ink">{copy.assistant.prompt}</p>
          ) : null}
          {speech.partial && (
            <p className="text-center text-[18px] text-ink-secondary">{speech.partial}</p>
          )}
          {speech.problem && (
            <p className="text-center text-[13px] text-ink-secondary">{speech.problem}</p>
          )}
        </div>

        {state.transcript.length === 0 ? (
          <div className="space-y-2">
            {copy.assistant.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => submit(suggestion)}
                className="flex w-full items-center justify-between rounded-2xl bg-muted px-4 py-3.5 text-left text-[15px] text-ink"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {state.transcript.slice(-6).map((turn) => (
              <div key={turn.id} className="space-y-2">
                <p
                  className={
                    turn.speaker === "arty"
                      ? "text-[20px] font-medium text-ink"
                      : "text-right text-[17px] text-ink-secondary"
                  }
                >
                  {turn.text}
                </p>
                {turn.confirmations.map((item, index) => (
                  <motion.p
                    key={item}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.12 }}
                    className="flex items-center gap-2 text-[17px] text-ink"
                  >
                    {item}
                    <Check size={15} className="text-accent" />
                  </motion.p>
                ))}
              </div>
            ))}
          </div>
        )}

        {followUp && (
          <div className="space-y-2.5 pb-4">
            <p className="text-[17px] text-ink-secondary">{followUp.prompt}</p>
            {followUp.options.map((option) => (
              <SecondaryButton
                key={option.id}
                onClick={() =>
                  submit(option.title, { followUpId: followUp.id, optionId: option.id })
                }
              >
                {option.title}
              </SecondaryButton>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-6 py-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit(input)}
          placeholder={copy.assistant.typePlaceholder}
          aria-label="Type a message to Arty"
          className="flex-1 rounded-full bg-muted px-4 py-3 text-[17px] outline-none"
        />
        <button
          onClick={() => (input.trim() ? submit(input) : listen())}
          aria-label={input.trim() ? "Send" : speech.listening ? "Stop listening" : "Talk to Arty"}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-white"
        >
          {input.trim() ? <Send size={19} /> : speech.listening ? <Square size={19} /> : <Mic size={19} />}
        </button>
      </div>
    </div>
  );
}

// MARK: - Shopping

function ShoppingSheet() {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState("");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <h2 className="px-6 pb-3 text-[17px] font-semibold text-ink">{copy.shopping.title}</h2>

      <div className="no-scrollbar flex-1 overflow-y-auto px-6">
        {state.snapshot.items.length === 0 ? (
          <EmptyState title={copy.shopping.emptyTitle} message={copy.shopping.emptyBody} />
        ) : (
          <ul className="divide-y divide-hairline">
            {state.snapshot.items.map((item) => {
              const addedBy = memberById(state.snapshot, item.addedByMemberId);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => dispatch({ type: "toggleItem", id: item.id })}
                    aria-pressed={item.checked}
                    className="flex min-h-[48px] w-full items-center gap-3.5 py-1 text-left"
                  >
                    <span
                      className={`flex h-[21px] w-[21px] items-center justify-center rounded-full border ${item.checked ? "border-accent bg-accent" : "border-ink-tertiary"}`}
                    >
                      {item.checked && <Check size={13} className="text-white" />}
                    </span>
                    <span className="flex-1">
                      <span
                        className={`block text-[17px] ${item.checked ? "text-ink-secondary line-through" : "text-ink"}`}
                      >
                        {item.text}
                      </span>
                      {addedBy?.role === "child" && (
                        <span className="text-[13px] text-ink-secondary">
                          {fill(copy.shopping.addedBy, { name: addedBy.name })}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3 px-6 py-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !draft.trim()) return;
            dispatch({ type: "addItems", items: [draft.trim()] });
            setDraft("");
          }}
          placeholder={copy.shopping.addPlaceholder}
          aria-label={copy.shopping.addPlaceholder}
          className="flex-1 rounded-full bg-muted px-4 py-3 text-[17px] outline-none"
        />
        <button
          disabled={!draft.trim()}
          onClick={() => {
            dispatch({ type: "addItems", items: [draft.trim()] });
            setDraft("");
          }}
          aria-label="Add item"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

// MARK: - Settings

function SettingsSheet() {
  const { state, dispatch } = useStore();
  const [page, setPage] = useState<"root" | "household" | "subscription" | "delete" | "briefing" | "arty">("root");

  if (page !== "root") {
    return (
      <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-8">
        <button
          onClick={() => setPage("root")}
          className="mb-4 flex min-h-[44px] items-center gap-1 text-[17px] text-accent"
        >
          <ChevronLeft size={18} /> Settings
        </button>
        {page === "household" && <HouseholdPage />}
        {page === "arty" && <YourArtyPage />}
        {page === "subscription" && <SubscriptionPage />}
        {page === "delete" && <DeletePage />}
        {page === "briefing" && <BriefingPage />}
      </div>
    );
  }

  return (
    <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-8">
      <h2 className="pb-4 text-[17px] font-semibold text-ink">Settings</h2>
      <SettingsGroup>
        <SettingsRow label="Household" onClick={() => setPage("household")} />
        <SettingsRow
          label={copy.character.settingsTitle}
          value={copy.character.options.find((option) => option.id === state.artyProfile.family)?.label}
          onClick={() => setPage("arty")}
        />
        <SettingsRow
          label="Child mode"
          onClick={() => dispatch({ type: "setOverlay", overlay: "child" })}
        />
      </SettingsGroup>

      <SettingsGroup title="Connected services">
        <SettingsRow label="Calendar" value={state.calendarConnected ? "Connected" : "Not connected"} />
        <SettingsRow label="Email" value={state.emailConnected ? "Demo connection" : "Not connected"} />
      </SettingsGroup>

      <SettingsGroup title="Notifications">
        <SettingsRow label="Preview a briefing" onClick={() => setPage("briefing")} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label="Subscription" onClick={() => setPage("subscription")} value="Not subscribed" />
      </SettingsGroup>

      <SettingsGroup title="Privacy">
        <a
          href="/privacy"
          className="flex min-h-[48px] items-center justify-between text-[17px] text-ink"
        >
          Privacy Policy
        </a>
        <a href="/terms" className="flex min-h-[48px] items-center justify-between text-[17px] text-ink">
          Terms of Use
        </a>
      </SettingsGroup>

      <SettingsGroup>
        <button
          onClick={() => setPage("delete")}
          className="flex min-h-[48px] w-full items-center text-left text-[17px] text-red-600"
        >
          {copy.settings.deleteAccount}
        </button>
        <button
          onClick={() => {
            clearSession();
            dispatch({ type: "restart" });
          }}
          className="flex min-h-[48px] w-full items-center text-left text-[17px] text-ink"
        >
          {state.isDemo ? "Start the demo again" : "Start again from scratch"}
        </button>
      </SettingsGroup>

      <p className="pt-6 text-[13px] text-ink-secondary">
        This is a UI prototype. Nothing here is stored or sent anywhere, and no real account exists.
      </p>
    </div>
  );
}

/**
 * Your Arty — see the household's character, change it from the same curated
 * picker onboarding used. Changing Arty changes appearance and nothing else:
 * the reducer's setArtyProfile touches no other state, so memory, reminders,
 * lists and subscription are untouchable from here by construction.
 */
function YourArtyPage() {
  const { state, dispatch } = useStore();
  const [picking, setPicking] = useState(false);
  const current = copy.character.options.find((option) => option.id === state.artyProfile.family);

  if (picking) {
    return (
      <div className="-mx-6 flex h-full flex-col">
        <CharacterPicker
          stage="settings"
          onChosen={(family, accent) => {
            dispatch({ type: "setArtyProfile", family, accent });
            track("arty_character_changed", { character_family: family, accent, onboarding_stage: "settings" });
            setPicking(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-[22px] font-semibold text-ink">{copy.character.settingsTitle}</h3>
      <div className="flex flex-col items-center gap-3">
        <ArtyCharacter state="idle" size={170} />
        <p className="text-[17px] font-semibold text-ink">{current?.label}</p>
        <p className="max-w-[280px] text-center text-[15px] text-ink-secondary">{current?.subtext}</p>
      </div>
      <SecondaryButton onClick={() => setPicking(true)}>{copy.character.settingsChange}</SecondaryButton>
      <p className="text-center text-[13px] text-ink-secondary">{copy.character.settingsNote}</p>
    </div>
  );
}

function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      {title && <SectionHeader>{title}</SectionHeader>}
      <div className="mt-1 divide-y divide-hairline">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  const content = (
    <span className="flex min-h-[48px] w-full items-center justify-between text-[17px] text-ink">
      {label}
      {value && <span className="text-[15px] text-ink-secondary">{value}</span>}
    </span>
  );
  return onClick ? (
    <button onClick={onClick} className="w-full text-left">
      {content}
    </button>
  ) : (
    content
  );
}

function HouseholdPage() {
  const { state } = useStore();
  return (
    <div className="space-y-6">
      <h3 className="text-[20px] font-semibold text-ink">
        {fill(copy.settings.householdTitle, { surname: state.snapshot.household.surname })}
      </h3>
      <div className="divide-y divide-hairline">
        {state.snapshot.household.members.map((member) => (
          <div key={member.id} className="flex min-h-[52px] items-center gap-3.5">
            <MemberChip name={member.name} colorToken={member.colorToken} size={38} />
            <span className="flex-1">
              <span className="block text-[17px] font-medium text-ink">{member.name}</span>
              <span className="block text-[13px] text-ink-secondary">
                {member.role === "owner" ? "Owner" : member.role === "adult" ? "Adult" : "Child"}
                {member.descriptor ? ` · ${member.descriptor}` : ""}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div>
        <SectionHeader>{copy.settings.knowsTitle}</SectionHeader>
        <div className="mt-1 divide-y divide-hairline">
          <SettingsRow label="Calendar" value={state.calendarConnected ? "Connected" : "Not connected"} />
          <SettingsRow label="Email" value={state.emailConnected ? "Demo connection" : "Not connected"} />
          <SettingsRow label="Household preferences" value="Learning" />
          <SettingsRow label="Shopping" value={`${state.snapshot.items.length} items`} />
          <SettingsRow
            label="Important dates"
            value={`${state.snapshot.events.filter((event) => event.kind === "birthday" || event.kind === "renewal").length + state.reminderCount} remembered`}
          />
        </div>
      </div>
    </div>
  );
}

function SubscriptionPage() {
  const [selected, setSelected] = useState("annual");
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-[30px] font-semibold text-ink">{copy.subscription.title}</h3>
        <p className="text-[20px] text-ink-secondary">{copy.subscription.subtitle}</p>
      </div>

      <div className="space-y-2.5">
        {[
          { id: "monthly", label: copy.subscription.monthly, price: "£6.99", period: "per month", note: null },
          { id: "annual", label: copy.subscription.annual, price: "£59.99", period: "per year", note: "Saves 28%" },
        ].map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelected(plan.id)}
            aria-pressed={selected === plan.id}
            className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition ${selected === plan.id ? "border-accent bg-accent-muted/40" : "border-transparent bg-muted"}`}
          >
            <span className="flex-1">
              <span className="block text-[17px] font-semibold text-ink">{plan.label}</span>
              <span className="block text-[15px] text-ink-secondary">
                {plan.price} {plan.period}
              </span>
            </span>
            {plan.note && (
              <span className="rounded-full bg-accent-muted px-2.5 py-1 text-[12px] font-semibold text-accent">
                {plan.note}
              </span>
            )}
          </button>
        ))}
      </div>

      <PrimaryButton disabled>Subscribe</PrimaryButton>
      <p className="text-[13px] text-ink-secondary">
        Purchasing happens on the iPhone through the App Store. On iOS the prices come from StoreKit
        rather than from this page.
      </p>

      <div>
        <SectionHeader>What&apos;s included</SectionHeader>
        <ul className="mt-2 space-y-2">
          {copy.subscription.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-[15px] text-ink">
              <Check size={15} className="mt-1 text-accent" /> {benefit}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <InlineButton disabled>{copy.subscription.restore}</InlineButton>
        <p className="text-[13px] text-ink-secondary">{copy.subscription.renewalNote}</p>
      </div>
    </div>
  );
}

function DeletePage() {
  const { dispatch } = useStore();
  const [confirmation, setConfirmation] = useState("");
  const canDelete = confirmation.trim().toUpperCase() === "DELETE";

  return (
    <div className="space-y-5">
      <h3 className="text-[20px] font-semibold text-ink">{copy.settings.deleteTitle}</h3>
      <p className="text-[15px] text-ink-secondary">{copy.settings.deleteExplain}</p>

      <div>
        <SectionHeader>What goes</SectionHeader>
        <ul className="mt-2 space-y-1.5 text-[15px] text-ink">
          <li>· Your household and everyone in it</li>
          <li>· Everything Arty has learned about your routines</li>
          <li>· Reminders, lists and important dates</li>
          <li>· Your sign in on this device</li>
        </ul>
      </div>

      <p className="text-[13px] text-ink-secondary">{copy.settings.deleteSubscriptionNote}</p>

      <input
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        placeholder={copy.settings.deleteTypeToConfirm}
        aria-label={copy.settings.deleteTypeToConfirm}
        className="w-full rounded-full bg-muted px-4 py-3 text-[17px] outline-none"
      />
      <button
        disabled={!canDelete}
        onClick={() => {
          clearSession();
          dispatch({ type: "restart" });
        }}
        className="min-h-[52px] w-full rounded-full bg-red-600 text-[17px] font-semibold text-white disabled:opacity-35"
      >
        {copy.settings.deleteConfirm}
      </button>
    </div>
  );
}

function BriefingPage() {
  const { state } = useStore();
  const day = buildDay(state.snapshot, 0, state.now);
  const commitments = day.items.filter((item) => item.style === "event");
  const body =
    commitments.length === 0
      ? "Morning. Nothing needs you today."
      : `Morning. ${commitments.length} ${commitments.length === 1 ? "thing" : "things"} today: ${commitments
          .map((item) => `${item.title.toLowerCase()} at ${item.time}`)
          .join(", ")}. Nothing else needs you.`;

  return (
    <div className="space-y-5">
      <h3 className="text-[20px] font-semibold text-ink">Briefing preview</h3>
      <div className="flex items-start gap-3 rounded-2xl bg-muted p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">🐾</span>
        <span>
          <span className="block text-[13px] font-semibold text-ink">Arty</span>
          <span className="block text-[13px] text-ink">{body}</span>
        </span>
      </div>
      <p className="text-[13px] text-ink-secondary">
        On the iPhone this arrives as a real notification at 7:30 and opens Plan → Today.
      </p>
    </div>
  );
}

// MARK: - Child mode

function ChildModeScreen() {
  const { state, dispatch } = useStore();
  const [answer, setAnswer] = useState<string | null>(null);
  const day = useMemo(
    () => buildDay(state.snapshot, 0, state.now, "child"),
    [state.snapshot, state.now],
  );

  const ask = (question: string) => {
    const reply = respond(question, state.snapshot, { now: state.now, role: "child" });
    setAnswer(reply.message);
    dispatch({ type: "setCharacter", state: reply.characterState });
  };

  return (
    <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-6 pb-8">
      <p className="text-[17px] font-semibold text-ink-secondary">{copy.childMode.title}</p>

      <div className="flex justify-center">
        <ArtyCharacter state={state.characterState} size={140} />
      </div>

      {answer ? (
        <ArtySays lines={[answer]} />
      ) : (
        <p className="text-center text-[22px] font-medium text-ink">{copy.childMode.greeting}</p>
      )}

      {day.items.filter((item) => item.style === "event" || item.style === "meal").length > 0 && (
        <div>
          <SectionHeader>Today</SectionHeader>
          <div className="mt-1">
            {day.items
              .filter((item) => item.style === "event" || item.style === "meal")
              .map((item) => (
                <Row key={item.id} time={item.time} title={item.title} details={item.details.slice(0, 1)} />
              ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {copy.childMode.suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => ask(suggestion)}
            className="w-full rounded-2xl bg-muted px-4 py-3.5 text-left text-[15px] text-ink"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <p className="text-[13px] text-ink-secondary">
        Child mode hides email, money, private notes and every setting. Arty answers questions about
        the day and can add to the shopping list.
      </p>
    </div>
  );
}
