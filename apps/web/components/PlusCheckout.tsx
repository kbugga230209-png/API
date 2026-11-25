'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { SUPABASE_URL } from '@/lib/config';

type Mode = 'manual' | 'subscription';
type Interval = 'plus_monthly' | 'plus_annual';

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { email?: string };
  theme: { color: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T & { error?: string; message?: string } }> {
  const supabase = createBrowserSupabase();
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  return { ok: res.ok, status: res.status, data };
}

export function PlusCheckout({
  email,
  active,
  periodEnd,
}: {
  email: string | undefined;
  active: boolean;
  periodEnd: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Mode | Interval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const startManual = useCallback(async () => {
    setError(null);
    setNotice(null);
    setBusy('manual');
    try {
      const order = await callFunction<{ order_id: string; amount_paise: number; key_id: string }>(
        'create-manual-order',
        {},
      );
      if (!order.ok) {
        setError(
          order.data.message ??
            (order.status === 503
              ? 'Payments are not configured on this deployment yet. Nothing was charged.'
              : `Could not start checkout (${order.data.error ?? order.status}).`),
        );
        return;
      }
      const loaded = await loadRazorpay();
      if (!loaded) {
        setError('Could not load the payment window. Check your connection and try again.');
        return;
      }
      const rzp = new window.Razorpay!({
        key: order.data.key_id,
        amount: order.data.amount_paise,
        currency: 'INR',
        name: 'BharatBite Plus',
        description: '30 days of BharatBite Plus — one-time payment, no mandate',
        order_id: order.data.order_id,
        prefill: { email },
        theme: { color: '#b5451b' },
        modal: {
          ondismiss: () => {
            setBusy(null);
            setNotice('Checkout closed. No payment was taken.');
          },
        },
        handler: async (response) => {
          const verified = await callFunction<{ verified?: boolean; period_end?: string }>('verify-payment', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          if (!verified.ok) {
            setError(
              verified.data.message ??
                'The payment could not be verified yet. If money was deducted, Plus activates automatically once the webhook is confirmed — refresh in a minute.',
            );
            setBusy(null);
            return;
          }
          setBusy(null);
          setNotice('Plus activated. Welcome aboard.');
          router.refresh();
        },
      });
      rzp.open();
    } catch {
      setError('Something went wrong starting checkout. Please try again.');
      setBusy(null);
    }
  }, [email, router]);

  const startSubscription = useCallback(
    async (plan: Interval) => {
      setError(null);
      setNotice(null);
      setBusy(plan);
      try {
        const sub = await callFunction<{ short_url?: string; subscription_id?: string }>('create-subscription', {
          plan_code: plan,
        });
        if (!sub.ok) {
          setError(
            sub.data.message ??
              (sub.status === 503
                ? 'Recurring payments are not configured on this deployment yet. Use the one-time option or come back later.'
                : `Could not start the subscription (${sub.data.error ?? sub.status}).`),
          );
          setBusy(null);
          return;
        }
        if (sub.data.short_url) {
          window.location.href = sub.data.short_url;
          return;
        }
        setNotice('Subscription created. Complete the mandate in the payment window that opens.');
        setBusy(null);
        router.refresh();
      } catch {
        setError('Something went wrong starting the subscription.');
        setBusy(null);
      }
    },
    [router],
  );

  return (
    <div style={{ marginTop: 18 }}>
      {active && (
        <div className="alert alert-success" style={{ marginBottom: 14 }}>
          Plus is active{periodEnd ? ` until ${new Date(periodEnd).toLocaleDateString('en-IN')}` : ''}. Renewing
          early adds 30 days to the end of the current period.
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
      {notice && <div className="alert alert-success" style={{ marginBottom: 14 }}>{notice}</div>}

      <div className="grid-2">
        <div className="card card-pad">
          <span className="eyebrow">Recommended in India</span>
          <h3 style={{ fontSize: 19, margin: '8px 0 6px' }}>₹49 · 30 days, one-time</h3>
          <p className="small muted">
            UPI, card or netbanking. No auto-debit mandate is created and nothing renews on its own —
            you decide each month.
          </p>
          <button
            className="btn btn-gold btn-block"
            style={{ marginTop: 14 }}
            onClick={startManual}
            disabled={busy !== null}
          >
            {busy === 'manual' ? 'Opening checkout…' : 'Pay ₹49 with UPI or card'}
          </button>
        </div>
        <div className="card card-pad">
          <span className="eyebrow">Auto-renew</span>
          <h3 style={{ fontSize: 19, margin: '8px 0 6px' }}>₹49/month or ₹399/year</h3>
          <p className="small muted">
            A Razorpay subscription mandate. Cancel any time from Account — access continues until the
            period you already paid for ends.
          </p>
          <div className="row row-wrap" style={{ marginTop: 14 }}>
            <button
              className="btn btn-primary"
              onClick={() => startSubscription('plus_monthly')}
              disabled={busy !== null}
            >
              {busy === 'plus_monthly' ? 'Creating…' : 'Monthly'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => startSubscription('plus_annual')}
              disabled={busy !== null}
            >
              {busy === 'plus_annual' ? 'Creating…' : 'Annual · save 32%'}
            </button>
          </div>
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: 14 }}>
        Amounts are fixed server-side: the browser cannot choose a price. Payment signatures are
        verified against the Razorpay secret and every payment is re-read from the Razorpay API before
        Plus is granted.
      </p>
    </div>
  );
}
