"use client";

/**
 * ui.tsx
 *
 * The same small kit as the native app: native-feeling type, generous space,
 * few borders, one accent. If a component can be removed without losing
 * clarity, it is not here.
 */

import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { memberColour } from "@/lib/fixtures";

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`w-full min-h-[52px] rounded-full bg-accent px-5 text-[17px] font-semibold text-white transition active:scale-[0.985] disabled:opacity-35 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`w-full min-h-[48px] rounded-full bg-accent-muted px-5 text-[17px] font-medium text-accent transition active:scale-[0.985] ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function InlineButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`min-h-[44px] rounded-full bg-accent-muted px-3.5 py-2.5 text-[15px] font-semibold text-accent transition active:scale-[0.985] ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** A line spoken by Arty. Large, calm, never in a chat bubble. */
export function ArtySays({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => (
        <p
          key={line}
          className={index === 0 ? "text-[22px] font-medium leading-snug text-ink" : "text-[17px] leading-relaxed text-ink-secondary"}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return <h2 className="text-[15px] font-semibold text-ink-secondary">{children}</h2>;
}

export function EmptyState({
  title,
  message,
  actionTitle,
  onAction,
}: {
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-7 py-9 text-center">
      <p className="text-[17px] font-semibold text-ink">{title}</p>
      <p className="text-[15px] text-ink-secondary">{message}</p>
      {actionTitle && onAction && (
        <InlineButton className="mt-1.5" onClick={onAction}>
          {actionTitle}
        </InlineButton>
      )}
    </div>
  );
}

export function MemberChip({
  name,
  colorToken,
  size = 28,
}: {
  name: string;
  colorToken: string;
  size?: number;
}) {
  const colour = memberColour(colorToken);
  return (
    <span
      aria-label={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        color: colour,
        backgroundColor: `${colour}29`,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** A reveal that matches ArtyMotion.reveal on iOS. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 26 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** A live level meter, driven by the demo's simulated microphone. */
export function Waveform({ level }: { level: number }) {
  const bars = 21;
  const centre = (bars - 1) / 2;
  return (
    <div className="flex h-8 items-center justify-center gap-1" aria-hidden="true">
      {Array.from({ length: bars }).map((_, index) => {
        const distance = Math.abs(index - centre) / centre;
        const falloff = 1 - distance * distance * 0.8;
        return (
          <span
            key={index}
            className="w-[3px] rounded-full bg-accent/85 transition-[height] duration-150"
            style={{ height: 4 + level * 30 * falloff }}
          />
        );
      })}
    </div>
  );
}

export function Row({
  time,
  title,
  details,
  trailing,
  onClick,
  muted,
}: {
  time?: string;
  title: string;
  details?: string[];
  trailing?: ReactNode;
  onClick?: () => void;
  muted?: boolean;
}) {
  const content = (
    <div className="flex w-full items-start gap-4 py-3 text-left">
      {time !== undefined && (
        <span
          className={`w-[54px] shrink-0 pt-0.5 text-[15px] tabular-nums ${muted ? "text-ink-tertiary" : "font-semibold text-ink"}`}
        >
          {time}
        </span>
      )}
      <span className="flex-1">
        <span className={`block text-[17px] ${muted ? "text-ink-secondary" : "font-semibold text-ink"}`}>
          {title}
        </span>
        {details?.map((detail) => (
          <span key={detail} className="mt-1 block text-[15px] text-ink-secondary">
            {detail}
          </span>
        ))}
      </span>
      {trailing}
    </div>
  );

  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} className="w-full">
      {content}
    </button>
  );
}
