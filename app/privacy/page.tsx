import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Arty — Privacy",
  description: "Draft privacy notice for the Arty prototype.",
};

/**
 * LEGAL REVIEW REQUIRED BEFORE PRODUCTION RELEASE.
 *
 * This page is a working draft written to describe the prototype's actual
 * behaviour. It has not been reviewed by a lawyer and must not be used as the
 * App Store privacy policy URL until it has been.
 */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-[720px] px-6 py-14 text-ink">
      <Link href="/" className="text-[15px] text-accent">
        ← Back to the Arty demo
      </Link>

      <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[14px] text-amber-900">
        <strong>Draft.</strong> This is prototype documentation, not a finished legal document. It
        has not had legal review. Before Arty is submitted to the App Store this page must be
        reviewed by a qualified adviser and published at the final Arty domain.
      </div>

      <h1 className="mt-8 text-[34px] font-semibold">Privacy</h1>
      <p className="mt-2 text-[15px] text-ink-secondary">Last updated: this prototype build.</p>

      <Section title="The short version">
        <p>
          Arty helps a household remember and organise its own life. There is no advertising, no
          tracking, no analytics SDK, and household information is never sold or shared. On the
          iPhone, everything a family tells Arty stays on their own device. On this web prototype
          two things may leave your browser: what you say to the microphone, and the sentence you
          type during onboarding. Both are explained below, and neither goes to Arty.
        </p>
      </Section>

      <Section title="What this web demo does">
        <p>
          This page is part of a user-interface prototype. It has no account system and no database.
          The household shown in it is fictional demo data shipped with the prototype, and nothing you
          type is stored anywhere or kept after your visit.
        </p>
        <p>
          The one exception: if whoever deployed this demo configured an API key, the sentence you
          type during onboarding is sent to Anthropic&apos;s Claude API to be turned into structured
          data, and then discarded. If no key is configured, nothing you type leaves your browser at
          all. The section below explains this in full.
        </p>
      </Section>

      <Section title="Using the microphone">
        <p>
          If you press the microphone on this web prototype, two separate things happen. Your
          browser measures how loud you are, which is what makes Arty react while you are still
          speaking; that measurement never leaves your device. Separately, your browser turns your
          speech into text.
        </p>
        <p>
          <strong>That transcription is not done by Arty, and in most browsers it is not done on
          your device.</strong> Chrome and Edge send the audio to Google&apos;s speech service.
          Safari uses Apple&apos;s. It is their processing, under their terms, and Arty never
          receives the audio. If your browser cannot transcribe at all, Arty falls back to a
          scripted example and tells you it has done so.
        </p>
        <p>
          This is the clearest example of why the iPhone app is the real product. On iOS, Arty
          prefers on-device speech recognition, and on iOS 26 the sentence is also understood by a
          model running on the phone. Nothing is sent anywhere.
        </p>
        <p>
          Nothing is recorded or stored either way. The microphone runs only while you are holding
          a conversation you started, and typing always works instead.
        </p>
      </Section>

      <Section title="Understanding what you say">
        <p>
          Arty turns a sentence like &quot;I live with my partner Katie and our two girls&quot; into
          people and routines. Where that understanding happens depends on where you are using Arty.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>On the iPhone, iOS 26.</strong> Apple&apos;s on-device model does it. The
            sentence never leaves the phone.
          </li>
          <li>
            <strong>On this web prototype.</strong> If the person who deployed it has configured an
            API key, the sentence is sent to Anthropic&apos;s Claude API to be turned into structured
            data, and is then discarded. It is not stored, and it is not used for training. If no key
            is configured, built-in rules do it and nothing is sent anywhere.
          </li>
          <li>
            <strong>Neither available.</strong> Built-in rules, entirely locally.
          </li>
        </ul>
        <p>
          What Arty <em>discovers</em> — the birthdays and renewals he surfaces — is never produced
          by a model. It is selected from information you have already given him, so he cannot invent
          something that is not there.
        </p>
      </Section>

      <Section title="What the iPhone app does today">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>What you tell Arty.</strong> Household members, routines, reminders, lists and
            things worth remembering are stored on your device.
          </li>
          <li>
            <strong>Your calendar.</strong> If you press Connect calendar, Arty reads your device
            calendar so it can understand your plans. Calendar events are read each time and are not
            copied into Arty&apos;s own storage.
          </li>
          <li>
            <strong>Your voice.</strong> If you press the microphone, audio is used to produce a
            transcript. Arty prefers on-device speech recognition where the device supports it.
            Neither audio nor transcripts are sent to Arty&apos;s servers, because in this build there
            are none.
          </li>
          <li>
            <strong>Your name.</strong> Used to address you. Arty does not require an email address.
          </li>
          <li>
            <strong>Sign in with Apple.</strong> If you sign in, Apple gives Arty a stable identifier
            for your account. It is stored in the device keychain.
          </li>
          <li>
            <strong>Email.</strong> Not connected. The prototype simulates email insights and says so
            wherever it does.
          </li>
        </ul>
      </Section>

      <Section title="What Arty never does">
        <ul className="list-disc space-y-2 pl-5">
          <li>Sell or share household information.</li>
          <li>Use household information for advertising.</li>
          <li>Track you across other apps or websites.</li>
          <li>Collect an advertising identifier.</li>
          <li>Log your calendar titles, email contents, transcripts or household memories.</li>
        </ul>
      </Section>

      <Section title="Children">
        <p>
          Child profiles are created and controlled by a parent. Children do not have their own
          account and Arty never asks a child for an email address. Child mode is restricted at the
          data layer: financial and administrative information, private notes and every setting are
          unavailable to it.
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          Settings → Delete my account removes your household, everything Arty has learned, your
          reminders, lists and connected service settings. In this prototype that deletion is local,
          because there is no server. Before release, deletion will also erase the household from
          Arty&apos;s servers and revoke the Sign in with Apple token. Deleting your Arty account does
          not cancel an Apple subscription; that is managed in your Apple account settings.
        </p>
      </Section>

      <Section title="When Arty gains a backend">
        <p>
          Arty is intended to sync a household across devices, which will require a server. Before
          that ships, this page will be replaced with a policy describing what is stored, where, for
          how long, on what legal basis, and how to exercise your rights. Connecting an email
          provider will require its own explicit consent, minimum scopes and a revocation path.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Support and privacy contact details will be published here before release. Placeholder:
          <span className="font-mono"> privacy@[arty-domain-to-be-confirmed]</span>
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 space-y-3">
      <h2 className="text-[22px] font-semibold">{title}</h2>
      <div className="space-y-3 text-[16px] leading-relaxed text-ink-secondary">{children}</div>
    </section>
  );
}
