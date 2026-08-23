"use client";

/**
 * ArtyCharacter.tsx
 *
 * The web mirror of the native placeholder character: a stylised spaniel
 * household butler, drawn with SVG and animated with CSS transforms.
 *
 * It runs the same state machine as ArtyState.swift, so the two prototypes
 * behave identically even though they are drawn by different renderers.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { CharacterState } from "@/lib/intent";

interface Posture {
  headTilt: number;
  earLift: number;
  tailWag: number;
  lean: number;
  eyeOpen: number;
  browLift: number;
  mouthOpen: number;
  sway: number;
}

const POSTURES: Record<CharacterState, Posture> = {
  idle: { headTilt: 0, earLift: 0, tailWag: 0.12, lean: 0, eyeOpen: 1, browLift: 0, mouthOpen: 0, sway: 0 },
  listening: { headTilt: 6, earLift: 0.85, tailWag: 0.25, lean: 0.7, eyeOpen: 1.05, browLift: 0.3, mouthOpen: 0, sway: 0 },
  thinking: { headTilt: 11, earLift: 0.15, tailWag: 0.05, lean: 0.15, eyeOpen: 0.8, browLift: -0.15, mouthOpen: 0, sway: 3 },
  speaking: { headTilt: 2, earLift: 0.4, tailWag: 0.35, lean: 0.35, eyeOpen: 1, browLift: 0.1, mouthOpen: 0.55, sway: 0 },
  confirming: { headTilt: -3, earLift: 0.55, tailWag: 0.75, lean: 0.25, eyeOpen: 0.95, browLift: 0.25, mouthOpen: 0, sway: 0 },
  alert: { headTilt: 0, earLift: 1, tailWag: 0, lean: 0.5, eyeOpen: 1.1, browLift: -0.4, mouthOpen: 0, sway: 0 },
  pleased: { headTilt: -6, earLift: 0.6, tailWag: 1, lean: 0.2, eyeOpen: 0.7, browLift: 0.4, mouthOpen: 0.25, sway: 0 },
};

const DESCRIPTIONS: Record<CharacterState, string> = {
  idle: "Arty is waiting",
  listening: "Arty is listening",
  thinking: "Arty is thinking",
  speaking: "Arty is answering",
  confirming: "Arty has understood",
  alert: "Arty has something to flag",
  pleased: "Arty is pleased",
};

interface Props {
  state?: CharacterState;
  /** 0 to 1. Drives the small listening movements, exactly as on iOS. */
  level?: number;
  size?: number;
  className?: string;
}

export default function ArtyCharacter({ state = "idle", level = 0, size = 180, className }: Props) {
  const reduceMotion = useReducedMotion();
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timeout = setTimeout(() => {
        if (cancelled) return;
        setBlinking(true);
        setTimeout(() => {
          if (!cancelled) setBlinking(false);
        }, 95);
        schedule();
      }, 2600 + Math.random() * 3600);
    };
    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [reduceMotion]);

  const base = POSTURES[state];
  const posture: Posture = {
    ...base,
    earLift: state === "listening" ? Math.min(base.earLift + level * 0.2, 1.2) : base.earLift,
    headTilt: state === "listening" ? base.headTilt + level * 3 : base.headTilt,
  };

  const earAngle = 10 + posture.earLift * 26;
  const eyeScale = blinking ? 0.08 : posture.eyeOpen;
  const spring = { type: "spring" as const, stiffness: 260, damping: 22 };

  return (
    <motion.svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`Arty. ${DESCRIPTIONS[state]}.`}
      animate={reduceMotion ? {} : { scaleY: [0.99, 1.015, 0.99] }}
      transition={reduceMotion ? {} : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "100px 196px", overflow: "visible" }}
    >
      {/* Tail, behind everything */}
      <motion.path
        d="M84 190 C60 188 40 172 38 152 C56 150 74 162 84 176 Z"
        fill="#A8734A"
        style={{ transformOrigin: "84px 188px" }}
        animate={
          reduceMotion || posture.tailWag < 0.02
            ? { rotate: 0 }
            : { rotate: [-16 * posture.tailWag, 16 * posture.tailWag, -16 * posture.tailWag] }
        }
        transition={
          reduceMotion || posture.tailWag < 0.02
            ? spring
            : { duration: 0.62 - 0.3 * posture.tailWag, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* Body, waistcoat, shirt front and bow tie */}
      <motion.g animate={{ y: -posture.lean * 3 }} transition={spring}>
        <path
          d="M56 200 C46 172 52 140 74 130 C86 124 114 124 126 130 C148 140 154 172 144 200 Z"
          fill="#E7CFB2"
        />
        <path
          d="M58 200 C50 174 56 146 74 136 L100 168 L126 136 C144 146 150 174 142 200 Z"
          fill="#333F4C"
        />
        <path d="M100 176 L84 138 Q100 128 116 138 Z" fill="#FAF7F2" />
        <path
          d="M100 132 L84 124 L84 140 Z M100 132 L116 124 L116 140 Z"
          fill="#7A3B45"
        />
        <rect x="94" y="126" width="12" height="12" rx="3" fill="#7A3B45" />
      </motion.g>

      {/* Head group: ears sit behind the head, everything tilts together */}
      <motion.g
        style={{ transformOrigin: "100px 118px" }}
        animate={{
          rotate: reduceMotion ? posture.headTilt : [posture.headTilt - posture.sway, posture.headTilt + posture.sway],
          y: -posture.lean * 4,
        }}
        transition={
          posture.sway > 0 && !reduceMotion
            ? { rotate: { duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }, y: spring }
            : spring
        }
      >
        {/* Ears */}
        <motion.path
          d="M51 26 C36 34 30 62 34 84 C38 104 48 112 58 108 C68 104 70 84 68 62 C66 42 62 30 51 26 Z"
          fill="#A8734A"
          style={{ transformOrigin: "51px 26px" }}
          animate={{ rotate: -earAngle }}
          transition={{ type: "spring", stiffness: 340, damping: 20 }}
        />
        <motion.path
          d="M149 26 C164 34 170 62 166 84 C162 104 152 112 142 108 C132 104 130 84 132 62 C134 42 138 30 149 26 Z"
          fill="#A8734A"
          style={{ transformOrigin: "149px 26px" }}
          animate={{ rotate: earAngle }}
          transition={{ type: "spring", stiffness: 340, damping: 20 }}
        />

        {/* Head */}
        <path
          d="M100 16 C132 16 160 38 160 70 C160 104 134 126 100 126 C66 126 40 104 40 70 C40 38 68 16 100 16 Z"
          fill="#E7CFB2"
        />
        <ellipse cx="100" cy="98" rx="30" ry="19" fill="#F7ECDD" />
        <ellipse cx="100" cy="86" rx="8.5" ry="6.2" fill="#3A3238" />

        {/* Mouth: one calm line that opens a little when speaking */}
        <motion.path
          fill="none"
          stroke="#3A3238"
          strokeOpacity="0.55"
          strokeWidth="2.4"
          strokeLinecap="round"
          animate={{ d: `M93 104 Q100 ${104 + 3 + posture.mouthOpen * 8} 107 104` }}
          transition={spring}
        />

        {/* Eyes */}
        {[75, 125].map((cx) => (
          <motion.g key={cx} style={{ transformOrigin: `${cx}px 70px` }} animate={{ scaleY: eyeScale }} transition={{ duration: 0.09 }}>
            <ellipse cx={cx} cy="70" rx="7.2" ry="8.6" fill="#2E2A2E" />
            <circle cx={cx + 2.4} cy="66.5" r="2" fill="#FFFFFF" fillOpacity="0.85" />
          </motion.g>
        ))}

        {/* Brows */}
        {[75, 125].map((cx, index) => (
          <motion.rect
            key={`brow-${cx}`}
            x={cx - 6.5}
            y="55"
            width="13"
            height="2.6"
            rx="1.3"
            fill="#CBAA85"
            style={{ transformOrigin: `${cx}px 56px` }}
            animate={{
              rotate: (index === 0 ? -1 : 1) * posture.browLift * -9,
              y: -posture.browLift * 2.5,
            }}
            transition={spring}
          />
        ))}
      </motion.g>
    </motion.svg>
  );
}
