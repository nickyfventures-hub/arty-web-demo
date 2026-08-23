"use client";

/**
 * Concierge — a highly stylised human-like assistant. Calm, composed,
 * understated, capable. Deliberately far from photorealism: simple shapes,
 * the same warm materials, and the same Arty eyes as every other family.
 *
 * Listening: leans slightly closer, expression focuses. Thinking: a small
 * thoughtful head movement. Confirming: a subtle nod. Alert: a more attentive
 * stance — never alarm.
 */

import { motion, useReducedMotion } from "framer-motion";
import type { Posture } from "@/lib/character";
import { ArtyBadge, ArtyEyes, MATERIAL, SPRING } from "./shared";

const SKIN = "#E8C9A8";
const HAIR = "#4A3A30";

export default function Concierge({
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
  // The concierge has no ears to raise; attention is carried by posture.
  // A confirming state reads as a small nod, driven by the same numbers.
  const nod = posture.tailWag > 0.5 ? 3 : 0;

  return (
    <>
      {/* Shoulders and tailored jacket */}
      <motion.g animate={{ y: -posture.lean * 3.5 }} transition={SPRING}>
        <path
          d="M52 200 C50 168 62 146 84 140 C94 136 106 136 116 140 C138 146 150 168 148 200 Z"
          fill={MATERIAL.charcoal}
        />
        {/* Collar and shirt */}
        <path d="M100 172 L86 142 Q100 134 114 142 Z" fill={MATERIAL.paper} />
        {/* A quiet accent: the tie */}
        <path d="M100 146 L95 154 L100 178 L105 154 Z" fill={accent} />
        {/* Lapels */}
        <path d="M86 142 L74 168 L92 158 Z" fill={MATERIAL.charcoalDeep} />
        <path d="M114 142 L126 168 L108 158 Z" fill={MATERIAL.charcoalDeep} />
        <ArtyBadge x={126} y={158} scale={0.9} />
      </motion.g>

      {/* Head */}
      <motion.g
        style={{ transformOrigin: "100px 120px" }}
        animate={{
          rotate: reduceMotion
            ? posture.headTilt * 0.7
            : [posture.headTilt * 0.7 - posture.sway, posture.headTilt * 0.7 + posture.sway],
          y: -posture.lean * 5 + nod,
        }}
        transition={
          posture.sway > 0 && !reduceMotion
            ? { rotate: { duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }, y: SPRING }
            : SPRING
        }
      >
        {/* Neck */}
        <rect x="92" y="118" width="16" height="18" rx="6" fill={SKIN} />
        {/* Face */}
        <path
          d="M100 28 C128 28 148 50 148 78 C148 108 128 128 100 128 C72 128 52 108 52 78 C52 50 72 28 100 28 Z"
          fill={SKIN}
        />
        {/* Hair: one calm sweep, no styling options */}
        <path
          d="M100 24 C130 24 150 46 149 72 C144 60 136 54 126 52 C118 40 108 36 100 36 C92 36 82 40 74 52 C64 54 56 60 51 72 C50 46 70 24 100 24 Z"
          fill={HAIR}
        />
        {/* Ears */}
        <ellipse cx="53" cy="80" rx="5" ry="8" fill={SKIN} />
        <ellipse cx="147" cy="80" rx="5" ry="8" fill={SKIN} />

        {/* Nose and mouth */}
        <path d="M97 84 Q100 90 103 84" fill="none" stroke={MATERIAL.soft} strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
        <motion.path
          fill="none"
          stroke={MATERIAL.soft}
          strokeOpacity="0.55"
          strokeWidth="2.4"
          strokeLinecap="round"
          animate={{ d: `M92 102 Q100 ${104 + posture.mouthOpen * 7} 108 102` }}
          transition={SPRING}
        />

        <ArtyEyes cy={72} spacing={20} scaleY={eyeScale} size={0.9} />

        {/* Brows */}
        {[80, 120].map((cx, index) => (
          <motion.rect
            key={`brow-${cx}`}
            x={cx - 7}
            y="58"
            width="14"
            height="2.8"
            rx="1.4"
            fill={HAIR}
            style={{ transformOrigin: `${cx}px 59px` }}
            animate={{ rotate: (index === 0 ? -1 : 1) * posture.browLift * -8, y: -posture.browLift * 2.5 }}
            transition={SPRING}
          />
        ))}
      </motion.g>
    </>
  );
}
