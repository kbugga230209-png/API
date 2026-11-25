import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/supabase/server';
import { getEntitlement, getProfile } from '@/lib/data';
import { signOutAction } from '@/lib/actions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SideNav } from '@/components/SideNav';

export const metadata: Metadata = {
  title: 'BharatBite',
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect('/login?next=/app');

  const [profile, { plusActive, entitlement }] = await Promise.all([
    getProfile(supabase, user.id),
    getEntitlement(supabase, user.id),
  ]);

  const name = profile?.display_name ?? user.email?.split('@')[0] ?? 'there';

  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <Link href="/app" className="brand" aria-label="BharatBite app home">
            <span className="brand-mark" aria-hidden />
            BharatBite
          </Link>
          <div className="nav-actions">
            {plusActive ? (
              <span className="badge badge-audit">Plus · {entitlement.planCode.replace('plus_', '')}</span>
            ) : (
              <Link href="/app/plus" className="badge">
                Upgrade to Plus
              </Link>
            )}
            <ThemeToggle />
            <Link href="/app/settings" className="btn btn-ghost btn-sm">
              {name}
            </Link>
            <form action={signOutAction}>
              <button className="btn btn-ghost btn-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="wrap shell">
        <SideNav />
        <main style={{ minWidth: 0 }}>{children}</main>
      </div>
    </>
  );
}
