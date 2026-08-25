/**
 * ideas.ts — "find something to do", with or without the model.
 *
 * The trigger detection and the deterministic fallback live here, model-free
 * and testable. When Claude is configured the suggestions come from
 * /api/understand kind:"ideas", grounded in postcode and ages; when it is
 * not, these generic-but-sound family ideas keep the feature from dead-ending.
 * Either way they are suggestions — Arty proposes, never books.
 */

export function isIdeasQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    /find (us |me )?something to do/,
    /something (fun )?to do/,
    /what (should|could|can) we do/,
    /any ideas/,
    /we're bored|were bored|kids are bored/,
    /day out|days out/,
    /(what|anything) .*(this|at the) weekend\??$/,
  ].some((pattern) => pattern.test(lower));
}

export interface Idea {
  title: string;
  why: string;
}

/** Calm, generic, honest — no invented local venues, no prices. */
export function fallbackIdeas(): { intro: string; ideas: Idea[] } {
  return {
    intro: "A few thoughts, nothing booked.",
    ideas: [
      { title: "A local park morning", why: "Cheap, close, and small legs sleep well after it." },
      { title: "Library trip", why: "Warm, free, and the children choose something to bring home." },
      { title: "Bake something together", why: "An afternoon at home that feels like an event." },
    ],
  };
}

export function formatIdeas(result: { intro: string; ideas: Idea[] }): string {
  const lines = result.ideas.map((idea) => `${idea.title} — ${idea.why}`);
  return `${result.intro}\n${lines.join("\n")}`;
}
