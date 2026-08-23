/**
 * /api/understand
 *
 * The AI half of the web demo's onboarding.
 *
 * Design constraints, in order of importance:
 *
 *  1. **The key never reaches the browser.** This runs server side. The client
 *     posts a sentence and gets structured data back.
 *  2. **No key, no problem.** If ANTHROPIC_API_KEY is not set the route returns
 *     `{ available: false }` and the client falls back to the rules engine in
 *     lib/intent.ts. That is what keeps the demo deployable to Vercel with no
 *     configuration at all, which is what makes it safe to hand to a parent.
 *  3. **Nothing is stored or logged.** The sentence is used to produce the
 *     result and then discarded. Errors log their type, never their content.
 *
 * The native app does this differently and better: on iOS 26 it runs Apple's
 * on-device model, so a household's sentence never leaves the phone at all.
 * See Arty/Arty/Services/Intelligence/FoundationModelsIntelligenceService.swift.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-5";

const SYSTEM = `You work for Arty, a calm British household assistant.

Your only job is to understand what somebody just said about their home and \
return it as structured data. You are not writing a reply and you are not having \
a conversation.

Rules you must not break:
- Only record what was actually said. Never infer a name, an age, a day or a \
routine that was not stated.
- Names are first names only, spelled exactly as the speaker spelled them.
- If something is ambiguous, leave it out rather than guessing.
- Never include the speaker in a list of people they live with.`;

const HouseholdSchema = z.object({
  people: z.array(
    z.object({
      name: z.string().describe("First name only, spelled exactly as it was said."),
      role: z
        .enum(["adult", "child"])
        .describe(
          "Partners, spouses, flatmates and parents are adults. Sons, daughters, babies, toddlers and anyone described as a kid are children.",
        ),
    }),
  ),
});

const DetailsSchema = z.object({
  people: z.array(
    z.object({
      name: z.string().describe("Must match one of the names already known."),
      lines: z
        .array(z.string())
        .describe(
          "Short factual phrases, title case, such as 'Age 2', 'Baby', 'Nursery Tuesday + Thursday', 'Works 3 days'. Never invent detail that was not said.",
        ),
    }),
  ),
  householdFacts: z
    .array(z.string())
    .describe("Facts about the home rather than one person, such as 'No pets'. Under six words each."),
});

const IntentSchema = z.object({
  kind: z.enum([
    "addToList",
    "createReminder",
    "queryDay",
    "queryWeek",
    "queryFact",
    "queryShopping",
    "rememberPreference",
    "notUnderstood",
  ]),
  items: z.array(z.string()).describe("For addToList: the items, each capitalised. Empty otherwise."),
  subject: z.string().describe("For createReminder or queryFact: what it is about. Empty otherwise."),
  dayOffset: z.number().int().describe("For queryDay: 0 for today, 1 for tomorrow. Otherwise 0."),
});

const BodySchema = z.object({
  kind: z.enum(["household", "details", "intent"]),
  text: z.string().min(1).max(2000),
  ownerName: z.string().max(80).optional(),
  knownNames: z.array(z.string().max(80)).max(20).optional(),
});

/**
 * Whether credentials are resolvable.
 *
 * Checked rather than assumed, because the SDK resolves in this order:
 * ANTHROPIC_API_KEY, then ANTHROPIC_AUTH_TOKEN, then an `ant auth login`
 * profile. Gating on the first alone would wrongly report "no AI" for a
 * developer signed in with the CLI.
 */
function hasConfiguredKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function POST(request: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ available: false, reason: "bad-request" }, { status: 400 });
  }

  let client: Anthropic;
  try {
    // Throws when no credential source resolves at all, which is the normal
    // case for this demo rather than an error worth surfacing.
    client = new Anthropic();
  } catch {
    return NextResponse.json({ available: false, reason: "no-key" });
  }

  try {
    if (body.kind === "household") {
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM,
        // Effort low: this is a short extraction and onboarding has to feel instant.
        output_config: { effort: "low", format: zodOutputFormat(HouseholdSchema) },
        messages: [
          {
            role: "user",
            content: `The speaker is called ${body.ownerName || "unknown"}. They were asked "Who do you live with?" and answered:\n\n"${body.text}"\n\nList the people they live with.`,
          },
        ],
      });
      if (!response.parsed_output) {
        return NextResponse.json({ available: false, reason: "unparsed" });
      }
      return NextResponse.json({ available: true, household: response.parsed_output });
    }

    if (body.kind === "details") {
      const names = (body.knownNames ?? []).join(", ");
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM,
        output_config: { effort: "low", format: zodOutputFormat(DetailsSchema) },
        messages: [
          {
            role: "user",
            content: `The household is: ${names}. Somebody was asked for anything else useful about their home and said:\n\n"${body.text}"\n\nRecord what was said about each person.`,
          },
        ],
      });
      if (!response.parsed_output) {
        return NextResponse.json({ available: false, reason: "unparsed" });
      }
      return NextResponse.json({ available: true, details: response.parsed_output });
    }

    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(IntentSchema) },
      messages: [
        {
          role: "user",
          content: `Somebody in the household said:\n\n"${body.text}"\n\nClassify what they want Arty to do.`,
        },
      ],
    });
    if (!response.parsed_output) {
      return NextResponse.json({ available: false, reason: "unparsed" });
    }
    return NextResponse.json({ available: true, intent: response.parsed_output });
  } catch (error) {
    // The household's sentence is never logged. Only what went wrong.
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("understand: ANTHROPIC_API_KEY rejected");
      return NextResponse.json({ available: false, reason: "auth" });
    }
    if (error instanceof Anthropic.RateLimitError) {
      console.error("understand: rate limited");
      return NextResponse.json({ available: false, reason: "rate-limit" });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`understand: API error ${error.status}`);
      return NextResponse.json({ available: false, reason: "api-error" });
    }
    console.error("understand: unexpected failure");
    return NextResponse.json({ available: false, reason: "unknown" });
  }
}

/** Lets the client show "AI understanding is on" without sending anything. */
export async function GET() {
  return NextResponse.json({ available: hasConfiguredKey(), model: MODEL });
}
