import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { SUPABASE_URL } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Privacy and data',
  description:
    'What BharatBite stores, where it is stored, how long it stays, and how to delete it. Photos stay on your device by default.',
};

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main className="wrap" style={{ paddingTop: 44, paddingBottom: 64, maxWidth: 820 }}>
        <span className="eyebrow">Trust</span>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 42px)', margin: '10px 0 20px' }}>Privacy and data</h1>
        <p className="muted">
          Last updated 25 November 2026. This page describes the behaviour of the software as shipped,
          not a promise added later.
        </p>

        <section style={{ marginTop: 30 }} className="card card-pad">
          <h2 style={{ fontSize: 21, marginBottom: 10 }}>Photos are local by default</h2>
          <p className="small muted">
            Recognition runs on the device with an on-device model. A meal photo is analysed in memory
            and is not uploaded, stored or backed up unless you explicitly attach it to an entry. If you
            do attach it, it is uploaded to private storage that only your account can read, and you can
            delete it at any time.
          </p>
        </section>

        <section style={{ marginTop: 16 }} className="card card-pad">
          <h2 style={{ fontSize: 21, marginBottom: 10 }}>What is stored on the server</h2>
          <ul className="feature-list">
            <li><span className="tick">•</span> Your email address and authentication metadata.</li>
            <li><span className="tick">•</span> Food log entries: dish, preparation, grams, computed nutrients, meal and date.</li>
            <li><span className="tick">•</span> Weight check-ins you enter, and the goals and preferences you set.</li>
            <li><span className="tick">•</span> Payment references from the payment provider (order id, payment id, amount, status). Never a card number, CVV or UPI PIN.</li>
            <li><span className="tick">•</span> Model version identifiers for diagnostics, so a wrong prediction can be traced.</li>
          </ul>
          <p className="small muted" style={{ marginTop: 12 }}>
            Storage is Postgres with row-level security. Every table enforces
            <span className="mono"> user_id = auth.uid()</span>; the browser key cannot read another
            account&apos;s rows and cannot write to catalog, entitlement or payment tables at all.
            Storage endpoint: <span className="mono">{SUPABASE_URL.replace('https://', '')}</span>.
          </p>
        </section>

        <section style={{ marginTop: 16 }} className="card card-pad">
          <h2 style={{ fontSize: 21, marginBottom: 10 }}>What we never do</h2>
          <ul className="feature-list">
            <li><span className="tick">•</span> No advertising SDKs and no third-party trackers.</li>
            <li><span className="tick">•</span> No selling or sharing of food logs or health data.</li>
            <li><span className="tick">•</span> No microphones, no contacts, no location permission for the diary.</li>
            <li><span className="tick">•</span> No training of third-party models on your photos.</li>
          </ul>
        </section>

        <section style={{ marginTop: 16 }} className="card card-pad">
          <h2 style={{ fontSize: 21, marginBottom: 10 }}>Export and deletion</h2>
          <p className="small muted">
            Your diary can be exported as CSV or JSON from the account screen. Deleting an entry is
            immediate and soft-deleted rows are purged within 30 days. Deleting your account removes
            profile, logs, weight history, preferences, plan data and photos — the delete cascades from
            the account row, so nothing is left orphaned. Payment records are retained as required for
            tax and dispute handling, stripped of anything beyond the transaction reference.
          </p>
        </section>

        <section style={{ marginTop: 16 }} className="card card-pad">
          <h2 style={{ fontSize: 21, marginBottom: 10 }}>Health disclaimer</h2>
          <p className="small muted">
            BharatBite provides nutrition information for general wellbeing. It is not a medical device,
            does not diagnose, and is not a substitute for advice from a doctor or registered dietitian.
            If you are pregnant, managing diabetes, kidney disease or an eating disorder, use these
            numbers with your clinician — not instead of them.
          </p>
        </section>

        <p className="small muted" style={{ marginTop: 24 }}>
          Deletion or data questions: open an issue on{' '}
          <a href="https://github.com/kbugga230209-png/API/issues" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            GitHub
          </a>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}
