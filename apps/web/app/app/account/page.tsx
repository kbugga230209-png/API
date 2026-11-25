import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { getEntitlement, getProfile } from '@/lib/data';
import { signOutAction, wipeHealthDataAction } from '@/lib/actions';
import { ManageSubscription } from '@/components/ManageSubscription';
import { GRACE_PERIOD_DAYS } from '@bharatbite/core';

export const dynamic = 'force-dynamic';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!user) return null;

  const [profile, { plusActive, entitlement }] = await Promise.all([
    getProfile(supabase, user.id),
    getEntitlement(supabase, user.id),
  ]);

  const { count: logCount } = await supabase
    .from('food_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('deleted_at', null);

  return (
    <div style={{ paddingTop: 8 }}>
      {params.ok && <div className="alert alert-success" style={{ marginBottom: 14 }}>{params.ok}</div>}
      {params.error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{params.error}</div>}

      <span className="eyebrow">You</span>
      <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', margin: '6px 0 10px' }}>Account and data</h1>
      <p className="muted small">Everything here is scoped to your account by row-level security.</p>

      <div className="grid-2" style={{ marginTop: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card card-pad">
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Profile</h2>
            <div className="kv"><span className="muted">Name</span><span>{profile?.display_name ?? '—'}</span></div>
            <div className="kv"><span className="muted">Email</span><span className="mono tiny">{user.email}</span></div>
            <div className="kv">
              <span className="muted">Member since</span>
              <span className="tiny">{new Date(user.created_at).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="kv"><span className="muted">Entries logged</span><span className="mono">{logCount ?? 0}</span></div>
            <div className="kv">
              <span className="muted">AI model</span>
              <span className="tiny">
                {profile?.ai_model_installed ? profile.ai_model_version ?? 'installed' : 'not installed on this device'}
              </span>
            </div>
            <form action={signOutAction} style={{ marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>

          <div className="card card-pad">
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Export</h2>
            <p className="small muted">
              Your diary, weights and plans, in an open format. Photos are not included by default.
            </p>
            <div className="row row-wrap" style={{ marginTop: 12 }}>
              <a className="btn btn-ghost btn-sm" href="/api/export?format=csv">
                Download CSV
              </a>
              <a className="btn btn-ghost btn-sm" href="/api/export?format=json">
                Download JSON
              </a>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card card-pad">
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>BharatBite Plus</h2>
            <div className="kv">
              <span className="muted">Status</span>
              <span style={{ fontWeight: 600 }}>{plusActive ? `Active · ${entitlement.planCode.replace('plus_', '')}` : 'Free'}</span>
            </div>
            {entitlement.currentPeriodEnd && (
              <div className="kv">
                <span className="muted">Period ends</span>
                <span className="mono tiny">{new Date(entitlement.currentPeriodEnd).toLocaleDateString('en-IN')}</span>
              </div>
            )}
            {entitlement.graceUntil && (
              <div className="kv">
                <span className="muted">Grace until</span>
                <span className="mono tiny">{new Date(entitlement.graceUntil).toLocaleDateString('en-IN')}</span>
              </div>
            )}
            <p className="tiny muted" style={{ marginTop: 10 }}>
              A failed renewal keeps access for {GRACE_PERIOD_DAYS} days. Cancelling keeps the period you
              paid for — the planner stops at renewal.
            </p>
            <ManageSubscription hasPlus={plusActive} />
            {!plusActive && (
              <Link href="/app/plus" className="btn btn-gold btn-sm btn-block" style={{ marginTop: 12 }}>
                See Plus
              </Link>
            )}
          </div>

          <div className="card card-pad" style={{ borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--line))' }}>
            <h2 style={{ fontSize: 18, marginBottom: 8, color: 'var(--danger)' }}>Delete my health data</h2>
            <p className="small muted">
              Removes every diary entry, weight check-in, saved meal and diet plan from the server, and
              clears your targets. Your login stays so you can start fresh. This cannot be undone —
              export first.
            </p>
            <form action={wipeHealthDataAction} style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" type="submit">
                Delete all diary and plan data
              </button>
            </form>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              To remove the account itself, delete your data here and then contact us through GitHub —
              <a href="https://github.com/kbugga230209-png/API/issues" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                {' '}
                open an issue
              </a>
              . We do not claim self-service account deletion exists until it does.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
