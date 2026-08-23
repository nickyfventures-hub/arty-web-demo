/**
 * waitlist.ts — the one real backend call in the demo.
 *
 * Inserts into Supabase with the publishable key. That key can do exactly one
 * thing to these tables — add a row — because the only RLS policy is INSERT
 * and there is no SELECT policy at all, so nothing can be read back.
 *
 * Fails honestly: if the request cannot be made (no configuration, offline,
 * rejected), the caller is told so and tells the person so. Nobody is ever
 * shown "you're on the list" for an email that went nowhere.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export interface WaitlistResult {
  ok: boolean;
  reason?: "not-configured" | "invalid" | "network";
}

async function insert(table: string, row: Record<string, unknown>): Promise<WaitlistResult> {
  if (!URL || !KEY) return { ok: false, reason: "not-configured" };
  try {
    const response = await fetch(`${URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        // No select policy exists, so the insert must not ask for the row back.
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (response.status === 201) return { ok: true };
    return { ok: false, reason: response.status === 400 ? "invalid" : "network" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export function joinWaitlist(email: string, precedingMoment: string | null): Promise<WaitlistResult> {
  return insert("waitlist", { email: email.trim(), preceding_moment: precedingMoment });
}

export function submitResearch(
  email: string,
  answers: { one_thing?: string; adults?: number; children?: number; current_tool?: string },
): Promise<WaitlistResult> {
  return insert("waitlist_research", { email: email.trim(), ...answers });
}
