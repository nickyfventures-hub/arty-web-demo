"use client";

/**
 * Otter — the mascot. Playful, quick, sharp-eyed, and quietly on top of
 * things. Sleek forms, no cartoon fur, the same warm materials as everyone.
 *
 * The species hands the brand a gift: otters hold pebbles. This one holds
 * the Arty "A" mark in its paws — the maker's mark carried, not worn.
 *
 * Same behavioural DNA as every family: the small round ears rise with
 * earLift, thinking is the head tilt, confirming is the thick tail's wag,
 * and the pebble lifts slightly when Arty is pleased.
 */

import { motion, useReducedMotion } from "framer-motion";
import type { Posture } from "@/lib/character";
import { ArtyBadge, ArtyEyes, MATERIAL, SPRING } from "./shared";

const COAT = "#8B6748";
const COAT_DEEP = "#6F5138";
const BELLY = "#E8D3B8";

export default function Otter({
  posture,
  blinking,
  accent,
}: {
  posture: Posture;
  blinking: boolean;
  accent: string;
}) {
  const reduceMotion = useReducedMotion();
  const eyeScale = blinking ? 0.08 : posture.eyeOpen;
  const earLift = posture.earLift;
  const pebbleLift = posture.tailWag > 0.5 || posture.browLift > 0.3 ? -4 : 0;

  return (
    <>
      {/* The thick tail, behind everything — the confirming wag */}
      <motion.path
        d="M124 192 C152 190 172 176 176 154 C158 150 138 160 126 176 Z"
        fill={COAT_DEEP}
        style={{ transformOrigin: "126px 188px" }}
        animate={
          reduceMotion || posture.tailWag < 0.02
            ? { rotate: 0 }
            : { rotate: [12 * posture.tailWag, -12 * posture.tailWag, 12 * posture.tailWag] }
        }
        transition={
          reduceMotion || posture.tailWag < 0.02
            ? SPRING
            : { duration: 0.6 - 0.28 * posture.tailWag, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* Body: sleek teardrop, pale belly, accent scarf */}
      <motion.g animate={{ y: -posture.lean * 3 }} transition={SPRING}>
        <path
          d="M62 200 C56 166 66 138 84 130 C94 125 106 125 116 130 C134 138 144 166 138 200 Z"
          fill={COAT}
        />
        <path
          d="M74 200 C70 172 78 148 92 142 C98 139 102 139 108 142 C122 148 130 172 126 200 Z"
          fill={BELLY}
        />
        {/* A slim scarf in the household accent */}
        <path d="M78 138 Q100 148 122 138 L120 148 Q100 157 80 148 Z" fill={accent} />

        {/* Paws holding the mark, which lifts a little when pleased */}
        <motion.g animate={{ y: pebbleLift }} transition={SPRING}>
          <ArtyBadge x={100} y={166} scale={1.1} />
          <ellipse cx="88" cy="172" rx="7" ry="5.4" fill={COAT} />
          <ellipse cx="112" cy="172" rx="7" ry="5.4" fill={COAT} />
        </motion.g>
      </motion.g>

      {/* Head group */}
      <motion.g
        style={{ transformOrigin: "100px 116px" }}
        animate={{
          rotate: reduceMotion
            ? posture.headTilt
            : [posture.headTilt - posture.sway, posture.headTilt + posture.sway],
          y: -posture.lean * 4,
        }}
        transition={
          posture.sway > 0 && !reduceMotion
            ? { rotate: { duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }, y: SPRING }
            : SPRING
        }
      >
        {/* Small round ears, high on the head, rising with attention */}
        {[[-1, 66], [1, 134]].map(([direction, cx]) => (
          <motion.g
            key={cx}
            style={{ transformOrigin: `${cx}px 46px` }}
            animate={{ y: -earLift * 5, rotate: Number(direction) * earLift * 8 }}
            transition={{ type: "spring", stiffness: 340, damping: 20 }}
          >
            <circle cx={cx} cy="42" r="11" fill={COAT_DEEP} />
            <circle cx={cx} cy="43" r="5.5" fill={COAT} />
          </motion.g>
        ))}

        {/* Head: broad, sleek, wider than tall */}
        <path
          d="M100 26 C136 26 158 50 158 78 C158 108 132 126 100 126 C68 126 42 108 42 78 C42 50 64 26 100 26 Z"
          fill={COAT}
        />
        {/* Pale muzzle */}
        <ellipse cx="100" cy="98" rx="32" ry="21" fill={BELLY} />
        {/* Nose */}
        <ellipse cx="100" cy="88" rx="9" ry="6.4" fill={MATERIAL.soft} />

        {/* Whiskers — the otter's signature, quiet lines */}
        {[[-1, 0], [1, 0]].map(([direction]) => (
          <g key={direction} stroke={COAT_DEEP} strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round">
            <line x1={100 + direction * 14} y1="92" x2={100 + direction * 34} y2="88" />
            <line x1={100 + direction * 14} y1="96" x2={100 + direction * 35} y2="96" />
            <line x1={100 + direction * 14} y1="100" x2={100 + direction * 34} y2="104" />
          </g>
        ))}

        {/* Mouth */}
        <motion.path
          fill="none"
          stroke={MATERIAL.soft}
          strokeOpacity="0.55"
          strokeWidth="2.4"
          strokeLinecap="round"
          animate={{ d: `M93 106 Q100 ${109 + posture.mouthOpen * 7} 107 106` }}
          transition={SPRING}
        />

        {/* The same Arty eyes as every family */}
        <ArtyEyes cy={72} spacing={23} scaleY={eyeScale} />

        {/* Brows */}
        {[77, 123].map((cx, index) => (
          <motion.rect
            key={`brow-${cx}`}
            x={cx - 6}
            y="58"
            width="12"
            height="2.6"
            rx="1.3"
            fill={COAT_DEEP}
            style={{ transformOrigin: `${cx}px 59px` }}
            animate={{ rotate: (index === 0 ? -1 : 1) * posture.browLift * -9, y: -posture.browLift * 2.5 }}
            transition={SPRING}
          />
        ))}
      </motion.g>
    </>
  );
}
