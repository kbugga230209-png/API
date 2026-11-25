import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { getSessionUser } from '@/lib/supabase/server';
import { signInAction, signUpAction } from '@/lib/actions';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to BharatBite to track your day, scan meals and sync across devices.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; notice?: string; next?: string }>;
}) {
  const params = await searchParams;
  const { user } = await getSessionUser();
  if (user) redirect('/app');

  const isSignup = params.mode === 'signup';
  const next = params.next ?? '/app';

  return (
    <>
      <SiteNav />
      <main className="wrap-narrow" style={{ paddingTop: 56, paddingBottom: 80 }}>
        <div className="card card-pad" style={{ padding: 30 }}>
          <span className="eyebrow">{isSignup ? 'Create account' : 'Welcome back'}</span>
          <h1 style={{ fontSize: 30, margin: '10px 0 8px' }}>
            {isSignup ? 'Start with today’s plate' : 'Sign in to BharatBite'}
          </h1>
          <p className="small muted" style={{ marginBottom: 22 }}>
            {isSignup
              ? 'Free forever for scanning, logging and nutrition. No card needed.'
              : 'Your diary, weight history and plans are waiting.'}
          </p>

          {params.error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{params.error}</div>}
          {params.notice && <div className="alert alert-success" style={{ marginBottom: 16 }}>{params.notice}</div>}

          <form action={isSignup ? signUpAction : signInAction}>
            <input type="hidden" name="next" value={next} />
            {isSignup && (
              <div className="field">
                <label htmlFor="display_name">Name (optional)</label>
                <input className="input" id="display_name" name="display_name" autoComplete="name" placeholder="Meera" />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                required
                minLength={isSignup ? 8 : 6}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }}>
              {isSignup ? 'Create free account' : 'Sign in'}
            </button>
          </form>

          <hr className="divider" />
          <p className="small muted" style={{ textAlign: 'center' }}>
            {isSignup ? 'Already have an account?' : 'New to BharatBite?'}{' '}
            <Link
              href={isSignup ? '/login' : '/login?mode=signup'}
              style={{ textDecoration: 'underline', color: 'var(--accent)' }}
            >
              {isSignup ? 'Sign in' : 'Create one free'}
            </Link>
          </p>
          <p className="tiny muted" style={{ textAlign: 'center', marginTop: 10 }}>
            <Link href="/privacy" style={{ textDecoration: 'underline' }}>
              How your data is handled
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
