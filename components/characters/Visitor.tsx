"use client";

/**
 * Visitor — a friendly alien-like character. Intelligent, curious, observant,
 * slightly eccentric. Clean forms, nothing threatening, nothing childish.
 *
 * The antennae are its ears: they rise for listening exactly as the spaniel's
 * ears do, driven by the same earLift number. Same eyes, same badge, same
 * charcoal uniform collar.
 */

import { motion, useReducedMotion } from "framer-motion";
import type { Posture } from "@/lib/character";
import { ArtyBadge, ArtyEyes, MATERIAL, SPRING } from "./shared";

const SKIN = "#CBD5C0";
const SKIN_DEEP = "#B3C1A6";

export default function Visitor({
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
  const antennaAngle = 8 + posture.earLift * 24;

  return (
    <>
      {/* Small body in the household uniform */}
      <motion.g animate={{ y: -posture.lean * 3 }} transition={SPRING}>
        <path
          d="M62 200 C58 172 66 150 84 144 C94 140 106 140 116 144 C134 150 142 172 138 200 Z"
          fill={SKIN}
        />
        {/* Uniform collar, the same charcoal as everyone's tailoring */}
        <path
          d="M64 200 C60 176 68 158 84 150 L100 168 L116 150 C132 158 140 176 136 200 Z"
          fill={MATERIAL.charcoal}
        />
        <path d="M100 174 L88 152 Q100 144 112 152 Z" fill={MATERIAL.paper} />
        {/* Accent trim on the collar */}
        <path d="M84 150 L100 168 L116 150" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <ArtyBadge x={122} y={164} scale={0.85} />
      </motion.g>

      {/* Head group */}
      <motion.g
        style={{ transformOrigin: "100px 122px" }}
        animate={{
          rotate: reduceMotion
            ? posture.headTilt
            : [posture.headTilt - posture.sway * 1.2, posture.headTilt + posture.sway * 1.2],
          y: -posture.lean * 4,
        }}
        transition={
          posture.sway > 0 && !reduceMotion
            ? { rotate: { duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }, y: SPRING }
            : SPRING
        }
      >
        {/* Antennae — the visitor's ears, same lift, same spring */}
        {[[-1, 74], [1, 126]].map(([direction, cx]) => (
          <motion.g
            key={cx}
            style={{ transformOrigin: `${cx}px 42px` }}
            animate={{ rotate: direction * -antennaAngle }}
            transition={{ type: "spring", stiffness: 340, damping: 20 }}
          >
            <rect x={Number(cx) - 1.6} y="14" width="3.2" height="30" rx="1.6" fill={SKIN_DEEP} />
            <circle cx={cx} cy="12" r="5" fill={SKIN_DEEP} />
            <circle cx={cx} cy="12" r="2.2" fill={MATERIAL.brass} fillOpacity="0.9" />
          </motion.g>
        ))}

        {/* Head: a broad soft dome, slightly wider than tall */}
        <path
          d="M100 30 C136 30 158 54 158 82 C158 112 132 130 100 130 C68 130 42 112 42 82 C42 54 64 30 100 30 Z"
          fill={SKIN}
        />
        <ellipse cx="100" cy="104" rx="26" ry="14" fill="#DCE4D2" />

        {/* Mouth: small and calm */}
        <motion.path
          fill="none"
          stroke={MATERIAL.soft}
          strokeOpacity="0.5"
          strokeWidth="2.4"
          strokeLinecap="round"
          animate={{ d: `M94 108 Q100 ${110 + posture.mouthOpen * 7} 106 108` }}
          transition={SPRING}
        />

        {/* The same Arty eyes, a little larger — the visitor notices things */}
        <ArtyEyes cy={76} spacing={24} scaleY={eyeScale} size={1.15} />

        {/* Brow dots rather than brows: eccentric, but the same brow physics */}
        {[76, 124].map((cx, index) => (
          <motion.circle
            key={`brow-${cx}`}
            cx={cx}
            cy="58"
            r="2.4"
            fill={SKIN_DEEP}
            animate={{ y: -posture.browLift * 3.5, x: (index === 0 ? -1 : 1) * posture.browLift * 1 }}
            transition={SPRING}
          />
        ))}
      </motion.g>
    </>
  );
}
