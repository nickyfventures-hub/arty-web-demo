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
- Never include the speaker in a list of people they live with.

Arty is a household assistant, not a companion, and never an emotionally dependent one. Nothing you produce may imply that Arty missed the user, is sad they were away, needs their attention, or that they owe Arty anything. Lines like "I missed you", "where have you been?" or "you haven't spoken to me today" are forbidden outright. Warmth is fine; guilt and neediness are not. After a fortnight away the right greeting is "Morning. I've got three things worth knowing.", not a reproach.`;

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
  kind: z.enum(["household", "details", "intent", "chat", "ideas"]),
  text: z.string().min(1).max(2000),
  ownerName: z.string().max(80).optional(),
  knownNames: z.array(z.string().max(80)).max(20).optional(),
  /** For chat and ideas: light household context, never secrets. */
  context: z
    .object({
      postcode: z.string().max(12).optional(),
      childAges: z.array(z.number().min(0).max(18)).max(6).optional(),
      dayContext: z.string().max(120).optional(),
    })
    .optional(),
});

const ChatSchema = z.object({
  reply: z.string().describe("Arty's reply: warm, concise, British, at most three sentences."),
});

const IdeasSchema = z.object({
  intro: z.string().describe("One short line introducing the ideas, e.g. \"I've got a couple of thoughts.\""),
  ideas: z
    .array(
      z.object({
        title: z.string().describe("The activity, a few words."),
        why: z.string().describe("One short line on why it fits this family."),
      }),
    )
    .min(2)
    .max(3),
});

/** The rules that keep open chat honest and un-needy. */
const CHAT_SYSTEM = `You are Arty, a calm British household assistant — warm, friendly, concise and understated. You may chat openly about anything, but:

- Never invent facts about this household. If asked something about the family you have not been told, say you don't have that yet and invite them to tell you.
- Never imply emotional dependence: no "I missed you", no guilt for absence, no neediness. Warmth is fine; clinginess is not.
- No exclamation marks, no emoji, no motivational-coach tone.
- Two or three sentences at most. You are helpful company, not an essay.`;

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

    if (body.kind === "chat") {
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 1024,
        system: CHAT_SYSTEM,
        output_config: { effort: "low", format: zodOutputFormat(ChatSchema) },
        messages: [{ role: "user", content: body.text }],
      });
      if (!response.parsed_output) {
        return NextResponse.json({ available: false, reason: "unparsed" });
      }
      return NextResponse.json({ available: true, chat: response.parsed_output });
    }

    if (body.kind === "ideas") {
      const context = [
        body.context?.postcode ? `Home is near postcode ${body.context.postcode}.` : "",
        body.context?.childAges?.length
          ? `Children aged ${body.context.childAges.join(" and ")}.`
          : "",
        body.context?.dayContext ? `Context: ${body.context.dayContext}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 1024,
        system: CHAT_SYSTEM,
        output_config: { effort: "low", format: zodOutputFormat(IdeasSchema) },
        messages: [
          {
            role: "user",
            content: `${context || "A UK family."} They asked: "${body.text}". Suggest family activities that genuinely fit. Free or low-cost ideas are welcome. These are suggestions, not bookings.`,
          },
        ],
      });
      if (!response.parsed_output) {
        return NextResponse.json({ available: false, reason: "unparsed" });
      }
      return NextResponse.json({ available: true, ideas: response.parsed_output });
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
