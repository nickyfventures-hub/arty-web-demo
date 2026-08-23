"use client";

/**
 * MemberEditor.tsx
 *
 * Correcting somebody Arty heard.
 *
 * Arty may have spelled a child's name wrong. That is a small thing that does a
 * lot of damage: a family will not trust an assistant with their week if it
 * cannot get their daughter's name right. So it is fixable in one tap, here in
 * onboarding and again later in settings.
 *
 * Mirrors MemberEditorSheet in the native app.
 */

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useState } from "react";
import { PrimaryButton } from "@/components/ui";

export type Role = "owner" | "adult" | "child";

export function MemberEditor({
  member,
  canDelete,
  title = "Edit person",
  onSave,
  onDelete,
  onClose,
}: {
  member: { id: string; name: string; role: Role };
  canDelete: boolean;
  title?: string;
  onSave: (name: string, role: Role) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<Role>(member.role);
  const isOwner = member.role === "owner";
  const trimmed = name.trim();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-end bg-ink/25 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="w-full rounded-t-3xl bg-canvas p-6 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[20px] font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center text-ink-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <label className="block text-[13px] font-medium text-ink-secondary" htmlFor="member-name">
          What should Arty call them?
        </label>
        <input
          id="member-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && trimmed) onSave(trimmed, role);
          }}
          className="mt-1.5 w-full rounded-full bg-muted px-5 py-3.5 text-[17px] outline-none"
        />
        <p className="mt-1.5 text-[13px] text-ink-secondary">
          Spelling matters here. Arty uses this name in reminders and briefings.
        </p>

        {!isOwner && (
          <div className="mt-5">
            <span className="block text-[13px] font-medium text-ink-secondary">They are</span>
            <div className="mt-1.5 flex rounded-xl bg-muted p-1">
              {(["adult", "child"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setRole(option)}
                  aria-pressed={role === option}
                  className={`min-h-[44px] flex-1 rounded-lg text-[15px] font-medium transition ${
                    role === option ? "bg-white text-ink shadow-sm" : "text-ink-secondary"
                  }`}
                >
                  {option === "adult" ? "An adult" : "A child"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[13px] text-ink-secondary">
              Children get a simplified Arty that a parent controls. They never get their own account.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-2.5">
          <PrimaryButton disabled={!trimmed} onClick={() => onSave(trimmed, role)}>
            Save
          </PrimaryButton>
          {canDelete && !isOwner && (
            <button
              onClick={onDelete}
              className="min-h-[48px] w-full rounded-full text-[17px] font-medium text-red-600"
            >
              Remove {member.name}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
