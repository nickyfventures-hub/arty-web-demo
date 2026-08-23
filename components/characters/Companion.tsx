"use client";

/**
 * Companion — the stylised spaniel. Dependable, warm, observant, slightly
 * traditional. This is the original Arty, now one family among four.
 *
 * Listening: ears rise, body leans in. Thinking: head tilt. Confirming: a
 * small tail wag. Alert: ears up, upright.
 */

import { motion, useReducedMotion } from "framer-motion";
import type { Posture } from "@/lib/character";
import { ArtyBadge, ArtyEyes, MATERIAL, SPRING } from "./shared";

const EAR = "#A8734A";

export default function Companion({
  posture,
  blinking,
  accent,
}: {
  posture: Posture;
  blinking: boolean;
  accent: string;
}) {
  const reduceMotion = useReducedMotion();
  const earAngle = 10 + posture.earLift * 26;
  const eyeScale = blinking ? 0.08 : posture.eyeOpen;

  return (
    <>
      {/* Tail, behind everything */}
      <motion.path
        d="M84 190 C60 188 40 172 38 152 C56 150 74 162 84 176 Z"
        fill={EAR}
        style={{ transformOrigin: "84px 188px" }}
        animate={
          reduceMotion || posture.tailWag < 0.02
            ? { rotate: 0 }
            : { rotate: [-16 * posture.tailWag, 16 * posture.tailWag, -16 * posture.tailWag] }
        }
        transition={
          reduceMotion || posture.tailWag < 0.02
            ? SPRING
            : { duration: 0.62 - 0.3 * posture.tailWag, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* Body, waistcoat, shirt front, bow tie in the household accent */}
      <motion.g animate={{ y: -posture.lean * 3 }} transition={SPRING}>
        <path
          d="M56 200 C46 172 52 140 74 130 C86 124 114 124 126 130 C148 140 154 172 144 200 Z"
          fill={MATERIAL.warmMid}
        />
        <path
          d="M58 200 C50 174 56 146 74 136 L100 168 L126 136 C144 146 150 174 142 200 Z"
          fill={MATERIAL.charcoal}
        />
        <path d="M100 176 L84 138 Q100 128 116 138 Z" fill={MATERIAL.paper} />
        <path d="M100 132 L84 124 L84 140 Z M100 132 L116 124 L116 140 Z" fill={accent} />
        <rect x="94" y="126" width="12" height="12" rx="3" fill={accent} />
        <ArtyBadge x={126} y={160} scale={0.9} />
      </motion.g>

      {/* Head group */}
      <motion.g
        style={{ transformOrigin: "100px 118px" }}
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
        <motion.path
          d="M51 26 C36 34 30 62 34 84 C38 104 48 112 58 108 C68 104 70 84 68 62 C66 42 62 30 51 26 Z"
          fill={EAR}
          style={{ transformOrigin: "51px 26px" }}
          animate={{ rotate: -earAngle }}
          transition={{ type: "spring", stiffness: 340, damping: 20 }}
        />
        <motion.path
          d="M149 26 C164 34 170 62 166 84 C162 104 152 112 142 108 C132 104 130 84 132 62 C134 42 138 30 149 26 Z"
          fill={EAR}
          style={{ transformOrigin: "149px 26px" }}
          animate={{ rotate: earAngle }}
          transition={{ type: "spring", stiffness: 340, damping: 20 }}
        />

        <path
          d="M100 16 C132 16 160 38 160 70 C160 104 134 126 100 126 C66 126 40 104 40 70 C40 38 68 16 100 16 Z"
          fill={MATERIAL.warmMid}
        />
        <ellipse cx="100" cy="98" rx="30" ry="19" fill={MATERIAL.warmLight} />
        <ellipse cx="100" cy="86" rx="8.5" ry="6.2" fill={MATERIAL.soft} />

        <motion.path
          fill="none"
          stroke={MATERIAL.soft}
          strokeOpacity="0.55"
          strokeWidth="2.4"
          strokeLinecap="round"
          animate={{ d: `M93 104 Q100 ${107 + posture.mouthOpen * 8} 107 104` }}
          transition={SPRING}
        />

        <ArtyEyes cy={70} spacing={25} scaleY={eyeScale} />

        {[75, 125].map((cx, index) => (
          <motion.rect
            key={`brow-${cx}`}
            x={cx - 6.5}
            y="55"
            width="13"
            height="2.6"
            rx="1.3"
            fill={MATERIAL.warmShade}
            style={{ transformOrigin: `${cx}px 56px` }}
            animate={{ rotate: (index === 0 ? -1 : 1) * posture.browLift * -9, y: -posture.browLift * 2.5 }}
            transition={SPRING}
          />
        ))}
      </motion.g>
    </>
  );
}
