"use client";

/**
 * MagicShowcase — the finished-product demo, played inside the real app.
 *
 * One player renders every magic moment from the data in lib/magic.ts, which
 * is what keeps the guided reel, the individual ad-clip routes and the dev
 * panel identical in behaviour. The complexity stays behind Arty: each moment
 * is the household's chosen character, one small emblem, a few lines, and at
 * most two buttons.
 *
 * Recording mode (?recording=true) locks every timing to the values in
 * TIMING, auto-chooses primary actions, and hides the chrome, so a screen
 * recording is deterministic to the frame.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Car,
  Flower2,
  Gift,
  Inbox,
  Mail,
  Sparkles,
  Sun,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArtyCharacter from "@/components/ArtyCharacter";
import { InlineButton, PrimaryButton, SecondaryButton, Waveform } from "@/components/ui";
import { track } from "@/lib/analytics";
import { copy } from "@/lib/fixtures";
import {
  DEMO_KNOWLEDGE,
  MOMENTS,
  RECORDING_SPEED,
  SEQUENCE,
  TIMING,
  momentById,
  type MagicMoment,
} from "@/lib/magic";
import { useStore } from "@/lib/store";
import { joinWaitlist, submitResearch } from "@/lib/waitlist";

const EMBLEMS: Record<MagicMoment["emblem"], LucideIcon> = {
  gift: Gift,
  envelope: Mail,
  bin: Trash2,
  car: Car,
  inbox: Inbox,
  flower: Flower2,
  sun: Sun,
  sparkle: Sparkles,
};

type Phase =
  | "notice"
  | "spoken"
  | "lines"
  | "evidence"
  | "after"
  | "actions"
  | "sheet"
  | "response"
  | "followup";

type Finale = "montage" | "waitlist" | "thanks" | null;

export default function MagicShowcase() {
  const { state, dispatch } = useStore();
  const params = useSearchParams();
  const reduceMotion = useReducedMotion();

  const recording = params.get("recording") === "true";
  const speed = params.get("fast") === "true" ? 0.55 : recording ? RECORDING_SPEED : 1;

  const request = state.magicRequest;
  const queue = useMemo<string[]>(() => {
    if (!request) return [];
    if (request === "full") return [...SEQUENCE];
    return momentById(request) ? [request] : [];
  }, [request]);
  const guided = request === "full";

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("notice");
  const [lineCount, setLineCount] = useState(0);
  const [spokenWords, setSpokenWords] = useState(0);
  const [finale, setFinale] = useState<Finale>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const moment = finale ? undefined : momentById(queue[index] ?? "");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback(
    (ms: number, run: () => void) => {
      timers.current.push(setTimeout(run, Math.max(120, ms * speed * (reduceMotion ? 0.6 : 1))));
    },
    [speed, reduceMotion],
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const close = useCallback(() => {
    clearTimers();
    dispatch({ type: "endMagic" });
    dispatch({ type: "setCharacter", state: "idle" });
  }, [clearTimers, dispatch]);

  // -- Start / restart whenever a scenario is requested.
  useEffect(() => {
    if (!request) return;
    clearTimers();
    setIndex(0);
    setPhase("notice");
    setLineCount(0);
    setSpokenWords(0);
    setFinale(null);
    setWhyOpen(false);
    track("demo_started", { moment_id: request, recording });
    return clearTimers;
  }, [request, clearTimers, recording]);

  // -- Per-moment analytics + character state.
  useEffect(() => {
    if (!moment) return;
    track(`magic_${moment.id.replace("-", "_")}_viewed` as never, { recording });
    dispatch({ type: "setCharacter", state: moment.artyState });
  }, [moment, dispatch, recording]);

  const advanceMoment = useCallback(() => {
    setWhyOpen(false);
    setLineCount(0);
    setSpokenWords(0);
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setPhase("notice");
      return;
    }
    if (guided) {
      setFinale("montage");
      dispatch({ type: "setCharacter", state: "pleased" });
    } else {
      track("demo_completed", { moment_id: request ?? undefined, recording });
      close();
    }
  }, [index, queue.length, guided, dispatch, close, request, recording]);

  // -- The phase machine. Every passive phase schedules the next one; the
  // action phase waits for a person unless recording mode is choosing.
  useEffect(() => {
    if (!moment) return;

    if (phase === "notice") {
      later(TIMING.noticeMs, () => setPhase(moment.spoken ? "spoken" : "lines"));
      return;
    }

    if (phase === "spoken" && moment.spoken) {
      const words = moment.spoken.split(" ").length;
      if (spokenWords < words) {
        later(TIMING.wordMs, () => setSpokenWords(spokenWords + 1));
      } else {
        dispatch({ type: "setCharacter", state: "thinking" });
        later(700, () => {
          dispatch({ type: "setCharacter", state: "confirming" });
          setPhase("lines");
        });
      }
      return;
    }

    if (phase === "lines") {
      if (lineCount < moment.lines.length) {
        later(lineCount === 0 ? 300 : moment.lineHoldMs ?? TIMING.lineMs, () =>
          setLineCount(lineCount + 1),
        );
      } else {
        later(moment.lineHoldMs ?? TIMING.lineMs, () =>
          setPhase(moment.evidence ? "evidence" : moment.afterEvidence ? "after" : moment.actions ? "actions" : "followup"),
        );
      }
      return;
    }

    if (phase === "evidence") {
      later(TIMING.evidenceMs, () => setPhase(moment.afterEvidence ? "after" : moment.actions ? "actions" : "followup"));
      return;
    }

    if (phase === "after") {
      later(TIMING.evidenceMs, () => setPhase(moment.actions ? "actions" : "followup"));
      return;
    }

    if (phase === "actions" && recording) {
      // Hands-off recordings choose Arty's primary suggestion.
      later(TIMING.actionAutoMs, () => act(moment.actions?.[0]?.id ?? "skip"));
      return;
    }

    if (phase === "sheet" && recording) {
      later(TIMING.sheetMs, () => setPhase("response"));
      return;
    }

    if (phase === "response") {
      dispatch({ type: "setCharacter", state: "confirming" });
      later(TIMING.responseMs, () => setPhase("followup"));
      return;
    }

    if (phase === "followup") {
      // The memory moment proves persistence with a later question.
      if (moment.id === "memory" && lineCount !== -1) {
        later(1200, advanceMoment);
        return;
      }
      later(600, advanceMoment);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, moment, lineCount, spokenWords, recording]);

  const act = useCallback(
    (actionId: string) => {
      if (!moment) return;
      track("magic_moment_interacted", { moment_id: moment.id, action_id: actionId, recording });
      const action = moment.actions?.find((entry) => entry.id === actionId);
      if (action?.kind === "primary" && moment.sheet) {
        setPhase("sheet");
      } else {
        dispatch({ type: "setCharacter", state: "idle" });
        advanceMoment();
      }
    },
    [moment, dispatch, advanceMoment, recording],
  );

  // -- Finale transitions.
  useEffect(() => {
    if (finale === "montage") {
      timers.current.push(
        setTimeout(() => {
          setFinale("waitlist");
          track("waitlist_viewed", { preceding_moment: queue[queue.length - 1], recording });
        }, (reduceMotion ? 4200 : 6200) * speed),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finale]);

  if (!request) return null;

  return (
    <div className="absolute inset-0 z-[5] flex flex-col bg-canvas">
      {/* Realism without deception: a quiet designation, never a banner. */}
      <div className="flex items-center justify-between px-5 pt-3">
        <span className="text-[11px] font-medium text-ink-secondary/70">Demo household</span>
        {!recording && (
          <button
            onClick={close}
            aria-label="Close the demo"
            className="flex h-10 w-10 items-center justify-center text-ink-secondary"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {guided && !recording && !finale && (
        <div className="flex justify-center gap-1.5 pb-1" aria-hidden="true">
          {queue.map((id, position) => (
            <span
              key={id}
              className={`h-[5px] w-[5px] rounded-full transition ${position <= index ? "bg-accent" : "bg-hairline"}`}
            />
          ))}
        </div>
      )}

      {finale === "montage" && <Montage />}
      {finale === "waitlist" && (
        <WaitlistEnding
          precededBy={queue[queue.length - 1] ?? null}
          recording={recording}
          onDone={() => {
            track("demo_completed", { moment_id: "full", recording });
            close();
          }}
        />
      )}

      {moment && !finale && (
        <MomentStage
          key={moment.id}
          moment={moment}
          phase={phase}
          lineCount={lineCount}
          spokenWords={spokenWords}
          characterState={state.characterState}
          whyOpen={whyOpen}
          onWhy={() => setWhyOpen((open) => !open)}
          onAct={act}
          onSheetDone={() => setPhase("response")}
          recording={recording}
        />
      )}
    </div>
  );
}

// MARK: - One moment on stage

function MomentStage({
  moment,
  phase,
  lineCount,
  spokenWords,
  characterState,
  whyOpen,
  onWhy,
  onAct,
  onSheetDone,
  recording,
}: {
  moment: MagicMoment;
  phase: Phase;
  lineCount: number;
  spokenWords: number;
  characterState: Parameters<typeof ArtyCharacter>[0]["state"];
  whyOpen: boolean;
  onWhy: () => void;
  onAct: (id: string) => void;
  onSheetDone: () => void;
  recording: boolean;
}) {
  const Emblem = EMBLEMS[moment.emblem];
  const showEvidence = ["evidence", "after", "actions", "sheet", "response", "followup"].includes(phase);
  const showAfter = ["after", "actions", "sheet", "response", "followup"].includes(phase);
  const speakingLevel = phase === "spoken" ? 0.55 : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 pb-28">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto no-scrollbar">
        {/* Arty, with the moment's object appearing beside him and leaving again */}
        <div className="relative">
          <ArtyCharacter state={characterState} level={speakingLevel} size={150} />
          <AnimatePresence>
            {phase !== "followup" && (
              <motion.span
                initial={{ scale: 0.4, opacity: 0, x: 8 }}
                animate={{ scale: 1, opacity: 1, x: 0 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="absolute -right-4 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted text-accent shadow-sm"
                aria-hidden="true"
              >
                <Emblem size={17} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* The scripted voice line, typed as it is "spoken" */}
        {moment.spoken && phase !== "notice" && (
          <div className="flex min-h-[54px] flex-col items-center gap-2">
            {phase === "spoken" && <Waveform level={0.4 + (spokenWords % 3) * 0.18} />}
            <p className="text-center text-[18px] font-medium text-ink">
              &ldquo;{moment.spoken.split(" ").slice(0, spokenWords || undefined).join(" ")}
              {spokenWords < moment.spoken.split(" ").length ? "…" : ""}&rdquo;
            </p>
          </div>
        )}

        {/* Arty's lines, one at a time */}
        <div className="w-full max-w-[320px] space-y-2 text-center">
          {moment.lines.slice(0, phase === "notice" || phase === "spoken" ? 0 : lineCount).map((line, position) => (
            <motion.p
              key={line}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className={
                position === 0
                  ? "text-[21px] font-semibold leading-snug text-ink"
                  : "text-[16px] leading-relaxed text-ink-secondary"
              }
            >
              {line}
            </motion.p>
          ))}

          {moment.evidence && showEvidence && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mx-auto mt-3 w-full space-y-px overflow-hidden rounded-2xl bg-muted"
            >
              {moment.evidence.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between bg-surface/60 px-4 py-2.5">
                  <span className="text-[13px] text-ink-secondary">{row.label}</span>
                  <span
                    className={`text-[16px] font-semibold tabular-nums ${
                      row.emphasis === "accent" || row.emphasis === "down"
                        ? "text-accent"
                        : row.emphasis === "up"
                          ? "text-attention"
                          : "text-ink"
                    }`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </motion.div>
          )}

          {moment.afterEvidence && showAfter && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-2 text-[15px] leading-relaxed text-ink-secondary"
            >
              {moment.afterEvidence}
            </motion.p>
          )}

          {phase === "response" && moment.sheet?.ctaResponse && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-2 text-[15px] font-medium text-accent"
            >
              {moment.sheet.ctaResponse}
            </motion.p>
          )}

          {/* The memory moment's proof: ask later, get the answer back */}
          {moment.id === "memory" && phase === "followup" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary/60">Later</p>
              <p className="text-[16px] font-medium text-ink">&ldquo;When&rsquo;s Mum&rsquo;s birthday?&rdquo;</p>
              <p className="text-[16px] text-accent">14 September. I&rsquo;ve already got it.</p>
            </motion.div>
          )}

          {/* Provenance, folded away until asked for */}
          {!recording && phase !== "notice" && (
            <div className="pt-2">
              <InlineButton onClick={onWhy}>Why?</InlineButton>
              {whyOpen && (
                <p className="pt-1 text-[12px] text-ink-secondary/80">{moment.provenance}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions: at most two, and only when judgement is genuinely needed */}
      <AnimatePresence>
        {phase === "actions" && moment.actions && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2.5"
          >
            {moment.actions.map((action) =>
              action.kind === "primary" ? (
                <PrimaryButton key={action.id} onClick={() => onAct(action.id)}>
                  {action.label}
                </PrimaryButton>
              ) : (
                <SecondaryButton key={action.id} onClick={() => onAct(action.id)}>
                  {action.label}
                </SecondaryButton>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The moment's sheet */}
      <AnimatePresence>
        {phase === "sheet" && moment.sheet && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-surface p-6 pb-8 shadow-[0_-8px_40px_rgba(28,27,25,0.18)]"
          >
            <h3 className="text-[20px] font-semibold text-ink">{moment.sheet.title}</h3>
            {moment.sheet.lead && (
              <p className="mt-0.5 text-[24px] font-semibold tabular-nums text-accent">{moment.sheet.lead}</p>
            )}
            <div className="mt-4 space-y-3">
              {moment.sheet.items.map((item) => (
                <div key={item.title} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-medium text-ink">{item.title}</p>
                    {item.detail && <p className="text-[13px] text-ink-secondary">{item.detail}</p>}
                  </div>
                  {item.note && <span className="shrink-0 text-[12px] text-ink-secondary/80">{item.note}</span>}
                </div>
              ))}
            </div>
            {moment.sheet.footnote && (
              <p className="mt-4 text-[12px] leading-relaxed text-ink-secondary/80">{moment.sheet.footnote}</p>
            )}
            {moment.sheet.cta && (
              <div className="mt-4">
                <PrimaryButton onClick={onSheetDone}>{moment.sheet.cta}</PrimaryButton>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// MARK: - The compounding montage

function Montage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 pb-24">
      <div className="w-full max-w-[320px] space-y-2.5">
        {DEMO_KNOWLEDGE.map((entry, index) => (
          <motion.div
            key={entry.subject}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.55, duration: 0.3 }}
            className="flex items-baseline justify-between rounded-2xl bg-muted px-4 py-3"
          >
            <span className="text-[15px] font-semibold text-ink">{entry.subject}</span>
            <span className="text-right text-[13px] text-ink-secondary">{entry.fact}</span>
          </motion.div>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 + DEMO_KNOWLEDGE.length * 0.55 }}
        className="text-[24px] font-semibold text-ink"
      >
        You only told Arty once.
      </motion.p>
    </div>
  );
}

// MARK: - The waitlist ending

function WaitlistEnding({
  precededBy,
  recording,
  onDone,
}: {
  precededBy: string | null;
  recording: boolean;
  onDone: () => void;
}) {
  const { state } = useStore();
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"ask" | "sending" | "joined" | "failed">("ask");
  const [oneThing, setOneThing] = useState("");
  const [researchSent, setResearchSent] = useState(false);

  const join = async () => {
    if (!email.includes("@")) return;
    track("waitlist_started", { preceding_moment: precededBy ?? undefined });
    setStage("sending");
    const result = await joinWaitlist(email, precededBy);
    if (result.ok) {
      track("waitlist_completed", { preceding_moment: precededBy ?? undefined });
      setStage("joined");
    } else {
      setStage("failed");
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center px-7 pb-10 pt-2">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <ArtyCharacter state={state.characterState} size={140} />
        <div className="space-y-1">
          <h1 className="text-[30px] font-semibold leading-tight text-ink">
            Your family&rsquo;s personal assistant.
          </h1>
          <p className="text-[30px] font-semibold leading-tight text-ink-secondary">In your pocket.</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-[18px] font-medium text-ink">{copy.brand.promise}</p>
          <p className="max-w-[300px] text-[15px] leading-relaxed text-ink-secondary">
            Arty remembers, plans ahead and takes care of the household admin you&rsquo;d rather not
            think about.
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[17px] font-semibold text-ink">
            £7.99/month <span className="font-normal text-ink-secondary">or</span> £59.99/year
          </p>
          <p className="text-[12px] text-ink-secondary">One household · 2 adults · up to 3 child profiles</p>
        </div>
      </div>

      {!recording && (
        <div className="w-full space-y-2.5">
          {stage === "joined" ? (
            <div className="space-y-3 text-center">
              <p className="text-[17px] font-medium text-accent">You&rsquo;re on the list.</p>
              {!researchSent ? (
                <>
                  <p className="text-[14px] text-ink-secondary">
                    One question, if you have a second: if Arty could take one thing completely off
                    your plate, what would it be?
                  </p>
                  <input
                    value={oneThing}
                    onChange={(event) => setOneThing(event.target.value)}
                    placeholder="Entirely optional"
                    className="w-full rounded-full bg-muted px-5 py-3 text-[15px] outline-none"
                  />
                  <PrimaryButton
                    onClick={async () => {
                      if (oneThing.trim()) await submitResearch(email, { one_thing: oneThing.trim() });
                      setResearchSent(true);
                    }}
                  >
                    {oneThing.trim() ? "Send" : "Skip"}
                  </PrimaryButton>
                </>
              ) : (
                <PrimaryButton onClick={onDone}>Back to Arty</PrimaryButton>
              )}
            </div>
          ) : (
            <>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && join()}
                placeholder="Your email"
                aria-label="Your email"
                className="w-full rounded-full bg-muted px-5 py-3.5 text-[16px] outline-none"
              />
              <PrimaryButton disabled={!email.includes("@") || stage === "sending"} onClick={join}>
                {stage === "sending" ? "Joining…" : "Join the waitlist"}
              </PrimaryButton>
              {stage === "failed" && (
                <p className="text-center text-[13px] text-attention">
                  That didn&rsquo;t save — check the address and try again.
                </p>
              )}
              <p className="text-center text-[12px] text-ink-secondary">Early access coming soon.</p>
              <div className="text-center">
                <InlineButton onClick={onDone}>Back to the demo</InlineButton>
              </div>
            </>
          )}
        </div>
      )}
      {recording && <div className="h-16" />}
    </div>
  );
}

// MARK: - Developer controls
//
// Only reachable with ?dev=true, and never alongside recording mode. This is
// the one deliberately tool-ish surface, so it sits in a drawer styled apart
// from the product.

export function DemoDevPanel() {
  const { state, dispatch } = useStore();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  if (params.get("dev") !== "true" || params.get("recording") === "true") return null;

  const families = ["companion", "concierge", "visitor", "essence"] as const;

  return (
    <div className="absolute bottom-24 left-3 z-40">
      <button
        onClick={() => setOpen((value) => !value)}
        className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg"
      >
        {open ? "Close" : "Scenarios"}
      </button>
      {open && (
        <div className="mt-2 w-[210px] space-y-1 rounded-xl bg-ink p-2 text-[12px] text-white shadow-xl">
          {MOMENTS.map((moment) => (
            <button
              key={moment.id}
              onClick={() => dispatch({ type: "startMagic", scenario: moment.id })}
              className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
            >
              {moment.id}
            </button>
          ))}
          <button
            onClick={() => dispatch({ type: "startMagic", scenario: "full" })}
            className="block w-full rounded-lg px-2 py-1.5 text-left font-semibold hover:bg-white/10"
          >
            Run full demo
          </button>
          <button
            onClick={() => dispatch({ type: "restart" })}
            className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
          >
            Reset demo
          </button>
          <button
            onClick={() => {
              const current = families.indexOf(state.artyProfile.family);
              dispatch({
                type: "setArtyProfile",
                family: families[(current + 1) % families.length],
                accent: state.artyProfile.accent,
              });
            }}
            className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
          >
            Arty: {state.artyProfile.family}
          </button>
        </div>
      )}
    </div>
  );
}
