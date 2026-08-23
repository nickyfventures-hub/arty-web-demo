"use client";

/**
 * shared.tsx — the pieces every Arty family is built from.
 *
 * The eyes, the "A" mark, the listening ring and the blink are defined once
 * and imported by all four renderers. That is what makes four different
 * bodies read as one character: the parts that carry identity are literally
 * the same components.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { LISTENING_RING, MATERIAL, SPRING } from "@/lib/character";

// MARK: - The Arty eyes
//
// A tall soft ellipse with a high offset catchlight. Every family with a face
// uses exactly this component; the orb translates the same shape into light.

export function ArtyEyes({
  cy,
  spacing,
  scaleY,
  size = 1,
}: {
  cy: number;
  spacing: number;
  scaleY: number;
  size?: number;
}) {
  return (
    <>
      {[100 - spacing, 100 + spacing].map((cx) => (
        <motion.g
          key={cx}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          animate={{ scaleY }}
          transition={{ duration: 0.09 }}
        >
          <ellipse cx={cx} cy={cy} rx={7.2 * size} ry={8.6 * size} fill={MATERIAL.ink} />
          <circle cx={cx + 2.4 * size} cy={cy - 3.5 * size} r={2 * size} fill="#FFFFFF" fillOpacity="0.85" />
        </motion.g>
      ))}
    </>
  );
}

// MARK: - The Arty mark
//
// A small brass "A" roundel. On the spaniel's waistcoat, the concierge's
// lapel, the visitor's collar, and embedded in the orb. Small on purpose:
// it is a maker's mark, not a logo.

export function ArtyBadge({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <circle r="7" fill={MATERIAL.brass} fillOpacity="0.92" />
      <circle r="7" fill="none" stroke={MATERIAL.charcoalDeep} strokeOpacity="0.25" strokeWidth="0.8" />
      <path
        d="M0 -3.6 L3.1 3.4 L1.4 3.4 L0.8 1.8 L-0.8 1.8 L-1.4 3.4 L-3.1 3.4 Z M0 -1 L-0.4 0.6 L0.4 0.6 Z"
        fill={MATERIAL.paper}
      />
    </g>
  );
}

// MARK: - The listening ring
//
// The brand signature for "the microphone is live". Same geometry, same
// timing, on every family — the point is that a household eventually reads
// this ring without reading any text.

export function ListeningRing({ active, accent }: { active: boolean; accent: string }) {
  const reduceMotion = useReducedMotion();
  if (!active) return null;
  return (
    <motion.circle
      cx="100"
      cy="100"
      r="92"
      fill="none"
      stroke={accent}
      strokeWidth="2.5"
      strokeOpacity={LISTENING_RING.opacity}
      style={{ transformOrigin: "100px 100px" }}
      initial={{ scale: LISTENING_RING.scaleFrom, opacity: 0 }}
      animate={
        reduceMotion
          ? { scale: 1, opacity: LISTENING_RING.opacity }
          : {
              scale: [LISTENING_RING.scaleFrom, LISTENING_RING.scaleTo, LISTENING_RING.scaleFrom],
              opacity: LISTENING_RING.opacity,
            }
      }
      transition={
        reduceMotion ? { duration: 0.2 } : { duration: LISTENING_RING.duration, repeat: Infinity, ease: "easeInOut" }
      }
    />
  );
}

// MARK: - Blinking

export function useBlink(): boolean {
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

  return blinking;
}

// MARK: - Shell
//
// Every family renders inside this: same viewBox, same breathing, same
// accessibility contract, same listening ring. A renderer only supplies the
// body.

export function CharacterShell({
  size,
  className,
  label,
  listening,
  accent,
  children,
}: {
  size: number;
  className?: string;
  label: string;
  listening: boolean;
  accent: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={label}
      animate={reduceMotion ? {} : { scaleY: [0.99, 1.015, 0.99] }}
      transition={reduceMotion ? {} : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "100px 196px", overflow: "visible" }}
    >
      <ListeningRing active={listening} accent={accent} />
      {children}
    </motion.svg>
  );
}

export { MATERIAL, SPRING };
