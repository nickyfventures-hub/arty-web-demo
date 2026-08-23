# Arty web demo

A UI prototype of Arty that you can send to a parent as a URL.

**This is not the product.** The product is a native iOS app, kept in a private
repository. This exists for one reason: so families can be shown the journey
and asked what they think, before TestFlight and signing are set up.

> **If you are reading this in `nickyfventures-hub/arty-web-demo`, this is a
> mirror.** It is published from the `web-demo/` directory of the private Arty
> repository with `git subtree push`, so that Railway can build it without
> being given access to the iOS source. Do not commit here — changes belong
> upstream, or the next publish will overwrite them.

---

## Run it

```bash
cd web-demo
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build
npm start
```

No API keys, no environment variables, no backend. That is what makes it safe to
hand to somebody.

### Optional: AI-powered onboarding

Set an Anthropic API key and the onboarding is understood by Claude instead of
by the built-in rules:

```bash
cp .env.example .env.local
# then set ANTHROPIC_API_KEY
npm run dev
```

- The key stays **server side**, in `/api/understand`. It never reaches the browser.
- With no key the route returns `{ available: false }` and the client falls back
  to `lib/intent.ts` silently. Nothing breaks, which is why the demo is still
  deployable with no configuration at all.
- When the model is in use, the household summary shows a small
  "Understood by AI" marker, so a tester always knows which brain answered.
- The sentence is used to produce the result and then discarded. It is not
  stored, and errors log their type rather than their content.

On iOS this works differently and better: iOS 26 runs Apple's **on-device**
model, so the sentence never leaves the phone. See
`docs/ARCHITECTURE.md` → "Understanding: which brain Arty is using".

---

## Deploy to Vercel

### From the dashboard

1. Push the repository to GitHub.
2. **Vercel → Add New → Project**, import the repository.
4. Set **Root Directory** to `web-demo`. This matters: the repository root is the
   iOS app.
5. Framework preset: Next.js. Build command and output directory are detected.
6. No environment variables are needed.
7. Deploy.

### From the CLI

```bash
npm i -g vercel
cd web-demo
vercel            # first deploy, follow the prompts
vercel --prod     # production
```

Send the resulting URL to a parent and watch what they do with it. They should
understand the product without you explaining it. If they do not, that is the
finding.

---

## Two ways in

| Route | What it is | When to send it |
| --- | --- | --- |
| `/` | The whole journey from the cover | Somebody deciding whether they want this |
| `/demo` | Arty with a household already in it | Somebody being shown it, who has thirty seconds |

`/demo` starts where a family would be after a fortnight: the people, the week,
the shopping list, and the things Arty has noticed. Onboarding is the right
first experience for a parent and the wrong one for a demo — three minutes of
typing before the product appears.

It is the ordinary app, not a separate build. There are no demo-only screens
and no second code path, so what gets shown is genuinely what gets built. The
Plan screen carries a "Demo household · not real data" marker so nobody can
mistake the Faircloughs for their own family.

---

## What it covers

The whole journey, in order:

1. Welcome — meet Arty
2. What I do — the five things Arty takes off your hands
3. What should I call you?
4. Who do you live with? — Arty extracts the people from a sentence
5. Anything else that's useful? — Arty extracts ages, nursery days, work patterns
6. Here's what I've got — the structured summary, with every name editable
7. Connect your life — calendar, email, family
8. The magic moment — four steps, then what Arty found
9. Save your household
10. Invite family
11. How much should I bother you?
12. Plan → Today
13. Plan → Tomorrow
14. Plan → This week
15. Calendar, filtered by person
16. Arty — talking and typing
17. Shopping
18. Settings, household, subscription, delete account
19. Child mode preview

Every step after the cover has a **back button** and a progress indicator, and
the household summary can be corrected: tap Edit, then tap anyone to fix a
spelling, change whether they are an adult or a child, remove them, or add
somebody Arty missed.

Plus `/privacy` and `/terms`, both clearly marked as drafts.

---

## How it stays honest

The demo mirrors the native app rather than reimplementing it from memory.

| Shared thing | Where |
| --- | --- |
| The demo household, dates, routines, insights | `/shared/demo-fixtures.json` |
| Every line Arty says | `/shared/copy.json` |
| Fixture materialisation | `lib/fixtures.ts`, mirroring `DemoFixtures.swift` |
| Plan construction | `lib/plan.ts`, mirroring `PlanBuilder.swift` |
| Intent understanding | `lib/intent.ts`, mirroring `DemoIntentEngine.swift` |
| The character state machine | `components/ArtyCharacter.tsx`, mirroring `ArtyState.swift` |

After editing anything in `/shared`:

```bash
node scripts/sync-shared.mjs          # from the repository root
node scripts/check-copy-keys.mjs      # proves the two prototypes agree
```

Fixture dates are relative, so the demo never goes stale. Katie's birthday is
always coming up; swimming is always this Saturday.

---

## Where it deliberately differs from iOS

| | iOS | Web |
| --- | --- | --- |
| Calendar | Real EventKit connection | Simulated, and says so |
| Email | Simulated, labelled | Simulated, labelled |
| Microphone | Real capture, real transcription | Scripted. The waveform and partial text are simulated, and typing always works |
| Understanding | On-device model (iOS 26), else Arty's server, else rules | Claude via a server route when a key is set, else rules |
| Sign in with Apple | Apple's real sheet | A demonstration button, labelled as such |
| Purchasing | StoreKit 2, real prices | Display only, disabled, with placeholder prices |
| Notifications | Real local notifications | A preview of what one would look like |
| Persistence | SwiftData | Session memory only. Refreshing starts over |

Anything simulated says so on screen. Nothing here pretends to be connected to a
real account, inbox or calendar.

---

## Design notes

- On a desktop the demo sits inside an **iPhone container** — bezel, Dynamic
  Island, status bar, home indicator and side buttons. Arty is an iPhone
  product, and somebody judging it on a laptop should be judging it as one.
- On a phone the frame disappears entirely and the app fills the viewport,
  safe areas included, because there the device is the frame.
- The character is SVG with transform animations, not 3D. It runs the same seven
  states as the native placeholder.
- `prefers-reduced-motion` is respected: transitions become near-instant, and the
  layout does not change, so state feedback survives.
- The palette, type scale and spacing match the native app's design system.

---

## Structure

```
web-demo/
  app/
    layout.tsx          fonts, metadata, the store provider
    page.tsx            onboarding or the main app
    globals.css         the shell, safe areas, reduced motion
    privacy/page.tsx    draft privacy notice
    terms/page.tsx      draft terms
    api/understand/     the optional Claude route. No key, no problem
  components/
    ArtyCharacter.tsx   the SVG spaniel and its state machine
    PhoneShell.tsx      the iPhone container, desktop only
    ui.tsx              buttons, Arty's voice, rows, waveform
    screens/
      Onboarding.tsx    the flow, the back button, steps 1 to 11
      CapabilitiesStep.tsx  "What I do", shown before anything is asked for
      HouseholdStep.tsx "Who do you live with?", AI-powered and correctable
      MemberEditor.tsx  fixing a name Arty misheard
      MainApp.tsx       Plan, Calendar, Arty, Shopping, Settings, Child mode
  lib/
    ai.ts               calls the route below, falls back to the rules
    fixtures.ts         the shared household, materialised
    plan.ts             the day, the week, the watch list
    intent.ts           understanding what somebody said
    store.tsx           one reducer for the whole demo
    copy.json           synced from /shared
    demo-fixtures.json  synced from /shared
```

---

## Do not

- Do not add a backend to this. The one server route it has, `/api/understand`,
  exists solely to keep an API key out of the browser, and holds no state. Any
  feature that needs real persistence belongs in the iOS app.
- Do not let it drift from `/shared`. Run the sync script.
- Do not make it production-grade. The native app has architectural priority.
