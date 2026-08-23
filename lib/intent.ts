/**
 * intent.ts
 *
 * A trimmed port of DemoIntentEngine from the native app, so the web demo
 * responds to the same sentences with the same words. It exists to make the
 * prototype testable with real families, not to be the production engine.
 */

import {
  Snapshot,
  HouseholdEvent,
  copy,
  formatDayAndMonth,
  formatTime,
  wholeDaysBetween,
  isSameDay,
  addDays,
  startOfDay,
  weekdayOf,
  capitalise,
  lowerFirst,
  memberById,
} from "./fixtures";

export type Role = "owner" | "adult" | "child";

export interface FollowUpOption {
  id: string;
  title: string;
}

export interface FollowUp {
  id: string;
  prompt: string;
  options: FollowUpOption[];
}

export interface ArtyEffect {
  kind: "addItems" | "createReminder" | "none";
  items?: string[];
  reminderTitle?: string;
}

export interface ArtyReply {
  message: string;
  confirmations: string[];
  followUp?: FollowUp;
  effects: ArtyEffect[];
  characterState: CharacterState;
  blocked?: boolean;
}

export type CharacterState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "confirming"
  | "alert"
  | "pleased";

const REMINDER_TRIGGERS = [
  "don't let me forget to ",
  "dont let me forget to ",
  "don't let me forget ",
  "dont let me forget ",
  "remind me to ",
  "remind me about ",
  "remind me ",
  "remember to ",
];

const LOW_STOCK_TRIGGERS = [
  "we're nearly out of ",
  "were nearly out of ",
  "we're out of ",
  "running low on ",
  "we need more ",
];

function listPhrase(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function addedMessage(items: string[]): string {
  switch (items.length) {
    case 1:
      return `Added ${lowerFirst(items[0])}.`;
    case 2:
      return "Added both.";
    case 3:
      return "Added all three.";
    default:
      return `Added all ${items.length}.`;
  }
}

function shoppingItems(text: string): string[] | null {
  const lowered = text.toLowerCase();
  let segment: string | null = null;

  for (const trigger of LOW_STOCK_TRIGGERS) {
    const index = lowered.indexOf(trigger);
    if (index >= 0) {
      segment = text.slice(index + trigger.length);
      break;
    }
  }
  if (segment === null && lowered.startsWith("add ")) {
    segment = text.slice(4);
  }
  if (segment === null) return null;

  for (const suffix of [
    " to the shopping list",
    " to the shopping",
    " to shopping",
    " to the list",
    " on the list",
  ]) {
    const index = segment.toLowerCase().indexOf(suffix);
    if (index >= 0) segment = segment.slice(0, index);
  }

  const items = segment
    .replace(/ and /g, ",")
    .split(",")
    .map((item) => item.trim().replace(/[.!?]+$/, ""))
    .filter((item) => item.length > 0)
    .map(capitalise);

  return items.length > 0 ? items : null;
}

function reminderSubject(text: string): string | null {
  const lowered = text.toLowerCase();
  for (const trigger of REMINDER_TRIGGERS) {
    const index = lowered.indexOf(trigger);
    if (index >= 0) {
      const tail = text.slice(index + trigger.length).trim().replace(/[.!?]+$/, "");
      return tail.length > 0 ? tail : null;
    }
  }
  if (lowered.startsWith("remind ")) {
    return text.slice(7).trim().replace(/[.!?]+$/, "");
  }
  return null;
}

function matchEvent(term: string, snapshot: Snapshot, now: Date): HouseholdEvent | undefined {
  const words = term
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((word) => word.length > 2);
  if (words.length === 0) return undefined;

  const upcoming = snapshot.events.filter(
    (event) => event.start.getTime() >= startOfDay(now).getTime(),
  );

  if (term.toLowerCase().includes("birthday")) {
    for (const event of upcoming) {
      if (event.kind !== "birthday") continue;
      const member = memberById(snapshot, event.memberId);
      if (member && words.includes(member.name.toLowerCase())) return event;
    }
  }

  let best: { event: HouseholdEvent; score: number } | undefined;
  for (const event of upcoming) {
    const haystack = `${event.title} ${event.notes}`.toLowerCase();
    const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
    if (score > 0 && score > (best?.score ?? 0)) best = { event, score };
  }
  return best?.event;
}

function sentenceTitle(event: HouseholdEvent, snapshot: Snapshot): string {
  const first = event.title.split(" ")[0].toLowerCase();
  const isPerson = snapshot.household.members.some((member) =>
    first.startsWith(member.name.toLowerCase()),
  );
  return isPerson ? event.title : lowerFirst(event.title);
}

export function respond(
  text: string,
  snapshot: Snapshot,
  options: { now?: Date; role?: Role; resolving?: { followUpId: string; optionId: string } } = {},
): ArtyReply {
  const now = options.now ?? new Date();
  const role = options.role ?? "owner";
  const lowered = text.trim().toLowerCase();

  if (options.resolving) {
    return {
      message: "Done. I'll make sure it doesn't sneak up on you.",
      confirmations: [],
      effects: [{ kind: "createReminder", reminderTitle: text }],
      characterState: "pleased",
    };
  }

  if (lowered.length === 0) {
    return { message: copy.assistant.unknown, confirmations: [], effects: [], characterState: "idle" };
  }

  // 1. Something to remember
  const subject = reminderSubject(text);
  if (subject) {
    const related = matchEvent(subject, snapshot, now);
    if (related) {
      const member = memberById(snapshot, related.memberId);
      const opener =
        related.kind === "birthday" && member
          ? `Absolutely. ${member.name}'s birthday is on ${formatDayAndMonth(related.start)}.`
          : `Absolutely. That's on ${formatDayAndMonth(related.start)}.`;
      return {
        message: opener,
        confirmations: [],
        followUp: {
          id: `reminder.lead.${related.id}`,
          prompt: "When should I start pestering you?",
          options: [
            { id: "week", title: "A week before" },
            { id: "twoWeeks", title: "Two weeks before" },
            { id: "pickDate", title: "Choose a date" },
          ],
        },
        effects: [],
        characterState: "confirming",
      };
    }
    return {
      message: `Right. ${capitalise(subject)}.`,
      confirmations: [],
      followUp: {
        id: "reminder.when",
        prompt: "When should I bring it up?",
        options: [
          { id: "tomorrow", title: "Tomorrow morning" },
          { id: "thisWeek", title: "Later this week" },
          { id: "pickDate", title: "Choose a date" },
        ],
      },
      effects: [],
      characterState: "confirming",
    };
  }

  // 2. Shopping
  const items = shoppingItems(text);
  if (items) {
    return {
      message: addedMessage(items),
      confirmations: items,
      effects: [{ kind: "addItems", items }],
      characterState: "confirming",
    };
  }

  // 3. A day
  const asksAboutADay =
    (lowered.includes("what") || lowered.includes("anything") || lowered.includes("are we doing")) &&
    !lowered.includes("when is") &&
    !lowered.includes("when's");

  if (asksAboutADay && (lowered.includes("tomorrow") || lowered.includes("today") || lowered.includes("happening"))) {
    const offset = lowered.includes("tomorrow") ? 1 : 0;
    return dayReply(offset, snapshot, now);
  }

  if (lowered.includes("this week") || lowered.includes("week ahead")) {
    return weekReply(snapshot, now);
  }

  // 4. Facts
  if (lowered.includes("dinner") || lowered.includes("eating")) {
    const meal = snapshot.meals.find((entry) => isSameDay(entry.date, now));
    if (!meal) {
      return {
        message: "Nothing planned yet. Want me to suggest something?",
        confirmations: [],
        effects: [],
        characterState: "thinking",
      };
    }
    return {
      message: `${meal.title}. ${meal.suggestion}`.trim(),
      confirmations: [],
      effects: [],
      characterState: "speaking",
    };
  }

  if (lowered.includes("when is") || lowered.includes("when's") || lowered.includes("due")) {
    const isMoney =
      lowered.includes("insurance") || lowered.includes("renew") || lowered.includes("bill");
    if (isMoney && role === "child") return blocked();

    const term = lowered
      .replace("when is my ", "")
      .replace("when is ", "")
      .replace("when's my ", "")
      .replace("when's ", "")
      .replace("due", "")
      .replace(/[?.!]/g, "")
      .trim();

    const event = matchEvent(term, snapshot, now);
    if (!event) {
      return {
        message: "I don't know about that one yet. Tell me and I'll remember it.",
        confirmations: [],
        effects: [],
        characterState: "thinking",
      };
    }
    const days = wholeDaysBetween(now, event.start);
    if (event.allDay || event.kind === "renewal" || event.kind === "birthday") {
      let message = `${formatDayAndMonth(event.start)}.`;
      message += days === 0 ? " That's today." : ` That's ${days} ${days === 1 ? "day" : "days"} away.`;
      if (event.kind === "renewal") message += " I'm already keeping an eye on it.";
      return { message, confirmations: [], effects: [], characterState: "speaking" };
    }
    let message = `${relativeDayName(event.start, now)} at ${formatTime(event.start)}.`;
    if (event.leaveAt) message += ` You'll want to leave around ${formatTime(event.leaveAt)}.`;
    return { message, confirmations: [], effects: [], characterState: "speaking" };
  }

  return {
    message: copy.assistant.unknown,
    confirmations: [],
    effects: [],
    characterState: "thinking",
  };
}

function blocked(): ArtyReply {
  return {
    message: copy.childMode.blocked,
    confirmations: [],
    effects: [],
    characterState: "confirming",
    blocked: true,
  };
}

function relativeDayName(date: Date, now: Date): string {
  const days = wholeDaysBetween(now, date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return capitalise(weekdayOf(date));
  return formatDayAndMonth(date);
}

function dayReply(offset: number, snapshot: Snapshot, now: Date): ArtyReply {
  const day = addDays(startOfDay(now), offset);
  const events = snapshot.events
    .filter((event) => isSameDay(event.start, day) && !event.allDay)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const dayName = offset === 0 ? "today" : relativeDayName(day, now).toLowerCase();

  if (events.length === 0) {
    return {
      message: `Nothing in the diary for ${dayName}. The day's yours.`,
      confirmations: [],
      effects: [],
      characterState: "speaking",
    };
  }

  const described = events.map(
    (event) => `${sentenceTitle(event, snapshot)} at ${formatTime(event.start)}`,
  );
  const opener = events.length <= 2 ? "Pretty quiet." : "A fair bit on.";
  let message = `${opener} You've got ${listPhrase(described)}.`;
  if (events.length <= 2) message += " The rest of the day is free.";

  const afternoonFree = !events.some((event) => event.start.getHours() >= 13);
  return {
    message,
    confirmations: [],
    followUp: afternoonFree
      ? {
          id: `day.suggest.${offset}`,
          prompt: "Want me to find something for the afternoon?",
          options: [
            { id: "findSomething", title: "Go on then" },
            { id: "no", title: "Not today" },
          ],
        }
      : undefined,
    effects: [],
    characterState: "speaking",
  };
}

function weekReply(snapshot: Snapshot, now: Date): ArtyReply {
  const counts: number[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = addDays(startOfDay(now), offset);
    counts.push(
      snapshot.events.filter((event) => isSameDay(event.start, day) && !event.allDay).length,
    );
  }
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return {
      message: "Nothing much this week. Enjoy it.",
      confirmations: [],
      effects: [],
      characterState: "speaking",
    };
  }
  const busiest = counts.indexOf(Math.max(...counts));
  const busiestDay = capitalise(weekdayOf(addDays(startOfDay(now), busiest)));
  return {
    message: `${total} ${total === 1 ? "thing" : "things"} across the week. ${busiestDay} is the busiest.`,
    confirmations: [],
    effects: [],
    characterState: "speaking",
  };
}
