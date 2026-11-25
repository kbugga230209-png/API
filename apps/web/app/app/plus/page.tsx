import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/data';
import { PlusCheckout } from '@/components/PlusCheckout';
import { PLUS_ANNUAL_INR, PLUS_MONTHLY_INR } from '@/lib/config';
import { GRACE_PERIOD_DAYS } from '@bharatbite/core';

export const dynamic = 'force-dynamic';

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; ok?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!user) return null;
  const { plusActive, entitlement } = await getEntitlement(supabase, user.id);

  return (
    <div style={{ paddingTop: 8 }}>
      {params.reason && <div className="alert" style={{ marginBottom: 14 }}>{params.reason}</div>}
      {params.ok && <div className="alert alert-success" style={{ marginBottom: 14 }}>{params.ok}</div>}

      <span className="eyebrow">BharatBite Plus</span>
      <h1 style={{ fontSize: 'clamp(26px, 3.4vw, 34px)', margin: '8px 0 10px' }}>
        ₹{PLUS_MONTHLY_INR} a month for a plan you&apos;ll actually follow
      </h1>
      <p className="muted" style={{ maxWidth: '62ch' }}>
        Plus adds the weekly Indian diet planner, grocery lists and the extra themes. Scanning,
        logging, history and the entire nutrition database stay free — we will never put the calorie
        counter behind a paywall.
      </p>

      <div className="grid-2" style={{ marginTop: 22, alignItems: 'start' }}>
        <div className="card card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>What Plus includes</h2>
          <ul className="feature-list" style={{ marginTop: 0 }}>
            <li><span className="tick">✓</span> 7-day plans built from your cuisine, diet and allergies</li>
            <li><span className="tick">✓</span> Cooking-time and daily-budget constraints</li>
            <li><span className="tick">✓</span> Weekly grocery list with quantities and cost</li>
            <li><span className="tick">✓</span> One tap to log a planned meal into the diary</li>
            <li><span className="tick">✓</span> Exclusive dashboard layouts and themes</li>
            <li><span className="tick">✓</span> ₹{PLUS_ANNUAL_INR}/year option for two months free</li>
          </ul>
          <hr className="divider" />
          <div className="kv">
            <span className="muted">Your status</span>
            <span style={{ fontWeight: 600 }}>
              {plusActive ? `Plus · ${entitlement.planCode.replace('plus_', '')}` : 'Free'}
            </span>
          </div>
          {entitlement.currentPeriodEnd && (
            <div className="kv">
              <span className="muted">Renews / ends</span>
              <span className="mono tiny">{new Date(entitlement.currentPeriodEnd).toLocaleDateString('en-IN')}</span>
            </div>
          )}
          {entitlement.cancelAtPeriodEnd && (
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Cancellation scheduled — Plus stays active until the period ends.
            </p>
          )}
          <p className="tiny muted" style={{ marginTop: 12 }}>
            If a renewal fails, access continues for a {GRACE_PERIOD_DAYS}-day grace period before the
            account returns to Free. Nothing is deleted when Plus lapses.
          </p>
          {!plusActive && (
            <p className="tiny muted" style={{ marginTop: 10 }}>
              Want to try the planner first? Free accounts can still explore{' '}
              <Link href="/foods" style={{ textDecoration: 'underline' }}>
                every food and portion
              </Link>
              .
            </p>
          )}
        </div>

        <div>
          <PlusCheckout
            email={user.email}
            active={plusActive}
            periodEnd={entitlement.currentPeriodEnd}
          />
        </div>
      </div>
    </div>
  );
}
