import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Arty — Terms",
  description: "Draft terms of use for the Arty prototype.",
};

/**
 * LEGAL REVIEW REQUIRED BEFORE PRODUCTION RELEASE.
 *
 * Draft only. App Store submission requires either Apple's standard EULA or a
 * reviewed custom agreement published at the final Arty domain.
 */
export default function Terms() {
  return (
    <main className="mx-auto max-w-[720px] px-6 py-14 text-ink">
      <Link href="/" className="text-[15px] text-accent">
        ← Back to the Arty demo
      </Link>

      <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[14px] text-amber-900">
        <strong>Draft.</strong> Prototype documentation, not a finished legal document, and not
        reviewed by a lawyer. Apple&apos;s standard EULA applies to App Store subscriptions unless a
        reviewed custom agreement replaces it.
      </div>

      <h1 className="mt-8 text-[34px] font-semibold">Terms of use</h1>
      <p className="mt-2 text-[15px] text-ink-secondary">Last updated: this prototype build.</p>

      <Section title="What Arty is">
        <p>
          Arty is a household assistant that helps a family remember and organise everyday
          information. This build is a prototype provided for testing. It is not a finished product,
          it may change without notice, and it should not be relied on as the only record of
          anything important.
        </p>
      </Section>

      <Section title="Your household">
        <p>
          One person sets up a household and can invite the people they live with. Everyone in a
          household shares the same Arty and can see and change the household&apos;s shared
          information. Child profiles are created and controlled by a parent.
        </p>
      </Section>

      <Section title="Subscription">
        <ul className="list-disc space-y-2 pl-5">
          <li>Arty Household is one subscription that covers everyone in your household.</li>
          <li>
            Subscriptions are purchased through the App Store and are billed to your Apple account.
          </li>
          <li>
            They renew automatically unless cancelled at least 24 hours before the end of the current
            period. Cancel in your Apple account settings.
          </li>
          <li>Prices are shown in the app in your own currency, taken from the App Store.</li>
          <li>Deleting your Arty account does not cancel your Apple subscription.</li>
        </ul>
      </Section>

      <Section title="Reasonable use">
        <p>
          Use Arty for your own household. Do not use it to store information about other people
          without their knowledge, and do not attempt to interfere with the service or with other
          households.
        </p>
      </Section>

      <Section title="Availability and liability">
        <p>
          This prototype is provided as-is, without warranties. Arty may miss something, get
          something wrong, or be unavailable. Keep your own record of anything that genuinely
          matters. To the extent permitted by law, liability is limited to the amount paid for the
          subscription in the previous twelve months.
        </p>
      </Section>

      <Section title="Ending">
        <p>
          You can delete your account at any time from Settings. Deletion removes your household and
          everything Arty has learned.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Support details will be published here before release. Placeholder:
          <span className="font-mono"> support@[arty-domain-to-be-confirmed]</span>
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
