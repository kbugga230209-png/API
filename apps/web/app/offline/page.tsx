import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="wrap-narrow" style={{ paddingTop: 90, paddingBottom: 90, textAlign: 'center' }}>
      <span
        aria-hidden
        style={{
          display: 'block',
          width: 56,
          height: 56,
          margin: '0 auto 18px',
          borderRadius: '50%',
          border: '3px solid var(--accent)',
          borderRightColor: 'transparent',
        }}
      />
      <h1 style={{ fontSize: 30, marginBottom: 12 }}>You&apos;re offline</h1>
      <p className="muted" style={{ maxWidth: '46ch', margin: '0 auto 22px' }}>
        This page needs a connection. Anything you already opened is cached, and the Android app keeps
        working fully offline — including recognition and the diary.
      </p>
      <a className="btn btn-primary" href="/app">
        Try again
      </a>
    </main>
  );
}
