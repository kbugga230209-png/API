import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap-narrow" style={{ paddingTop: 90, paddingBottom: 90, textAlign: 'center' }}>
      <span className="eyebrow">404</span>
      <h1 style={{ fontSize: 34, margin: '10px 0 12px' }}>That dish isn&apos;t on the menu</h1>
      <p className="muted" style={{ maxWidth: '48ch', margin: '0 auto 22px' }}>
        The page you asked for does not exist. The food database has 226 real entries though — try
        searching for thepla, dal tadka or ઢોકળા.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link href="/foods" className="btn btn-primary">
          Search foods
        </Link>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </main>
  );
}
