import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { APP_VERSION, GITHUB_RELEASES, GITHUB_REPO } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Download BharatBite for Android',
  description:
    'Install the BharatBite Android app. Signed APKs with SHA-256 checksums on GitHub Releases, plus installation and update instructions.',
};

const RELEASES = [
  {
    version: APP_VERSION,
    date: '2026-11-25',
    channel: 'Source release',
    status: 'no-signed-apk',
    notes:
      'Repository and web application released. The Android APK for this version has not been built: the build sandbox has no JDK or Android SDK, and no release signing key exists yet. Do not expect a downloadable APK below until that is resolved.',
  },
];

export default function DownloadPage() {
  return (
    <>
      <SiteNav />
      <main className="wrap" style={{ paddingTop: 44, paddingBottom: 64, maxWidth: 900 }}>
        <span className="eyebrow">Android</span>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 44px)', margin: '10px 0 12px' }}>
          Install BharatBite
        </h1>
        <p className="muted" style={{ maxWidth: '62ch' }}>
          BharatBite is distributed independently of Google Play, from this site and from GitHub
          Releases. Both channels use the same account, the same cloud sync and the same Plus
          entitlement.
        </p>

        <div className="alert alert-error" style={{ marginTop: 24 }}>
          <strong>No signed APK published yet.</strong> The application source, signing
          configuration and release workflow are in the repository, but no release keystore exists and
          this environment cannot run the Android toolchain. We will not publish an unsigned or
          unverified APK — a build that has not been signature-verified must never be distributed.
        </div>

        <div className="grid-2" style={{ marginTop: 24 }}>
          <div className="card card-pad">
            <h3 style={{ fontSize: 18, marginBottom: 10 }}>1 · Verify before you install</h3>
            <p className="small muted">
              Every APK is published with its SHA-256. After downloading, compute the hash and compare
              it with the value on the release page:
            </p>
            <pre
              className="mono small"
              style={{
                background: 'var(--surface-2)',
                padding: 12,
                borderRadius: 10,
                overflowX: 'auto',
                marginTop: 10,
              }}
            >
              sha256sum bharatbite-{APP_VERSION}.apk
            </pre>
          </div>
          <div className="card card-pad">
            <h3 style={{ fontSize: 18, marginBottom: 10 }}>2 · Install on your phone</h3>
            <p className="small muted">
              Open the downloaded file. Android will ask you to allow installs from this source; that
              prompt is expected for apps distributed outside Play. BharatBite asks for camera access
              only when you start a scan.
            </p>
          </div>
        </div>

        <h2 style={{ fontSize: 26, marginTop: 40, marginBottom: 14 }}>Releases</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {RELEASES.map((release) => (
            <div key={release.version} className="card card-pad">
              <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <h3 style={{ fontSize: 18 }}>v{release.version}</h3>
                  <p className="tiny muted">
                    {release.date} · {release.channel}
                  </p>
                </div>
                <span className="badge badge-audit">APK not published</span>
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                {release.notes}
              </p>
            </div>
          ))}
        </div>

        <div className="card card-pad" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 18, marginBottom: 10 }}>Update policy</h3>
          <ul className="feature-list">
            <li>
              <span className="tick">•</span> The app checks the signed release manifest on launch and
              shows an in-app banner when a newer version exists.
            </li>
            <li>
              <span className="tick">•</span> The AI model updates separately from the app, is
              SHA-256 verified and installs atomically — a failed download never leaves a half-written
              model behind.
            </li>
            <li>
              <span className="tick">•</span> Compatibility: Android 8.0 (API 26) and above, arm64
              with ONNX Runtime Mobile or TensorFlow Lite.
            </li>
          </ul>
        </div>

        <p className="small muted" style={{ marginTop: 22 }}>
          Prefer the browser? The{' '}
          <Link href="/app" style={{ textDecoration: 'underline' }}>
            web app
          </Link>{' '}
          has the full diary, dashboard and planner. Release notes live on{' '}
          <a href={GITHUB_RELEASES} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            GitHub
          </a>
          . Source: <a href={GITHUB_REPO} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>kbugga230209-png/API</a>.
        </p>
      </main>
      <Footer />
    </>
  );
}
