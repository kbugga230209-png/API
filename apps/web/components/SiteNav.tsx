import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { ThemeToggle } from './ThemeToggle';

export async function SiteNav() {
  const { user } = await getSessionUser();

  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand" aria-label="BharatBite home">
          <span className="brand-mark" aria-hidden />
          BharatBite
        </Link>
        <nav className="nav-links" aria-label="Main">
          <Link href="/foods">Food database</Link>
          <Link href="/download">Download</Link>
          <Link href="/#pricing">Plus</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          {user ? (
            <Link href="/app" className="btn btn-primary btn-sm">
              Open app
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link href="/login?mode=signup" className="btn btn-primary btn-sm">
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
