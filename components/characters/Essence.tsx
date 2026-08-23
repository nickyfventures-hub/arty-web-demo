"use client";

/**
 * Essence — a minimal warm orb, for households that do not want a face.
 * Premium, calm, modern. A warm physical object with personality carried
 * entirely by motion — not a Siri clone, no neon, no rainbow gradients.
 *
 * The same posture numbers, translated into light and shape:
 *   listening   contracts slightly and gains a listening halo (earLift)
 *   thinking    slow internal rotation (sway)
 *   confirming  one satisfying pulse of the core (tailWag)
 *   alert       a clear but restrained brightening (eyeOpen)
 *   speaking    the core breathes with the words (mouthOpen)
 *
 * The Arty eyes exist here too, as two soft vertical lights in the core —
 * same shape, expressed as luminance rather than ink.
 */

import { motion, useReducedMotion } from "framer-motion";
import type { Posture } from "@/lib/character";
import { ArtyBadge, MATERIAL } from "./shared";

export default function Essence({
  posture,
  blinking,
  accent,
}: {
  posture: Posture;
  blinking: boolean;
  accent: string;
}) {
  const reduceMotion = useReducedMotion();

  // The orb contracts towards attention instead of leaning.
  const scale = 1 - posture.lean * 0.06;
  // Alert brightens; thinking dims slightly. Same eyeOpen number as a face.
  const coreOpacity = 0.55 + (posture.eyeOpen - 1) * 0.5 + posture.browLift * 0.1;
  const wag = posture.tailWag;

  return (
    <>
      {/* The halo: the orb's ears. Rises with the same earLift. */}
      <motion.circle
        cx="100"
        cy="100"
        r="74"
        fill="none"
        stroke={accent}
        strokeWidth="1.6"
        strokeOpacity={0.15 + posture.earLift * 0.35}
        style={{ transformOrigin: "100px 100px" }}
        animate={{ scale: 1 + posture.earLift * 0.06 }}
        transition={{ type: "spring", stiffness: 340, damping: 20 }}
      />

      {/* The body: warm ceramic, not glass, not neon */}
      <motion.g
        style={{ transformOrigin: "100px 100px" }}
        animate={{
          scale,
          rotate: reduceMotion || posture.sway === 0 ? 0 : [0, 360],
        }}
        transition={{
          scale: { type: "spring", stiffness: 260, damping: 22 },
          rotate:
            posture.sway > 0 && !reduceMotion
              ? { duration: 14, repeat: Infinity, ease: "linear" }
              : { duration: 0.4 },
        }}
      >
        <circle cx="100" cy="100" r="62" fill={MATERIAL.warmLight} />
        <circle cx="100" cy="100" r="62" fill="none" stroke={MATERIAL.warmShade} strokeOpacity="0.55" strokeWidth="1.4" />
        {/* A quiet meridian, so rotation while thinking is visible */}
        <ellipse cx="100" cy="100" rx="26" ry="62" fill="none" stroke={MATERIAL.warmShade} strokeOpacity="0.28" strokeWidth="1.2" />

        {/* The core: the accent, breathing */}
        <motion.circle
          cx="100"
          cy="100"
          r="26"
          fill={accent}
          animate={{
            opacity: Math.max(0.3, Math.min(1, coreOpacity + posture.mouthOpen * 0.25)),
            scale:
              wag > 0.5 && !reduceMotion
                ? [1, 1.14, 1]
                : posture.mouthOpen > 0 && !reduceMotion
                  ? [1, 1 + posture.mouthOpen * 0.08, 1]
                  : 1,
          }}
          transition={
            wag > 0.5
              ? { scale: { duration: 0.5 }, opacity: { duration: 0.3 } }
              : posture.mouthOpen > 0
                ? { scale: { duration: 0.8, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 } }
                : { duration: 0.3 }
          }
          style={{ transformOrigin: "100px 100px" }}
        />

        {/* The Arty eyes, as light. They blink like everyone else's. */}
        <motion.g
          style={{ transformOrigin: "100px 100px" }}
          animate={{ scaleY: blinking ? 0.1 : Math.min(posture.eyeOpen, 1.1) }}
          transition={{ duration: 0.09 }}
        >
          <ellipse cx="91" cy="99" rx="3.4" ry="7.4" fill={MATERIAL.paper} fillOpacity="0.95" />
          <ellipse cx="109" cy="99" rx="3.4" ry="7.4" fill={MATERIAL.paper} fillOpacity="0.95" />
        </motion.g>

        {/* The maker's mark, embedded in the surface */}
        <ArtyBadge x={100} y={146} scale={0.8} />
      </motion.g>
    </>
  );
}
