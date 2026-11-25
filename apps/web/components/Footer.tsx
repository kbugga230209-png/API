import Link from 'next/link';
import { GITHUB_REPO, APP_VERSION } from '@/lib/config';

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div style={{ maxWidth: '38ch' }}>
          <div className="brand" style={{ fontSize: 18, marginBottom: 8 }}>
            <span className="brand-mark" aria-hidden />
            BharatBite
          </div>
          <p className="small">
            Nutrition guidance for Indian plates. Not medical advice — talk to a doctor or registered
            dietitian for clinical nutrition.
          </p>
        </div>
        <div className="small">
          <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Product</p>
          <p><Link href="/foods">Food database</Link></p>
          <p><Link href="/download">Android download</Link></p>
          <p><Link href="/app/plus">BharatBite Plus</Link></p>
        </div>
        <div className="small">
          <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Trust</p>
          <p><Link href="/privacy">Privacy and data</Link></p>
          <p><Link href="/foods?tab=sources">Data sources</Link></p>
          <p><a href={GITHUB_REPO} target="_blank" rel="noreferrer">Source code</a></p>
        </div>
        <div className="small">
          <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Build</p>
          <p className="mono">v{APP_VERSION}</p>
          <p>Made in India</p>
        </div>
      </div>
    </footer>
  );
}
