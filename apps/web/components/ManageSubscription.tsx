'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { SUPABASE_URL } from '@/lib/config';

export function ManageSubscription({ hasPlus }: { hasPlus: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function sync() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-entitlement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token ?? ''}`,
        },
        body: '{}',
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setMessage({ tone: 'error', text: body.message ?? body.error ?? 'Could not sync entitlement.' });
      } else {
        setMessage({ tone: 'ok', text: 'Status refreshed from the billing provider.' });
        router.refresh();
      }
    } catch {
      setMessage({ tone: 'error', text: 'Network error while syncing.' });
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm('Cancel the Plus mandate? You keep access until the paid period ends.')) return;
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token ?? ''}`,
        },
        body: '{}',
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setMessage({
          tone: 'error',
          text:
            body.error === 'no_active_subscription'
              ? 'No auto-renewing subscription found. One-time payments simply expire — nothing to cancel.'
              : body.message ?? body.error ?? 'Cancellation failed.',
        });
      } else {
        setMessage({ tone: 'ok', text: 'Cancelled. Access continues until the current period ends.' });
        router.refresh();
      }
    } catch {
      setMessage({ tone: 'error', text: 'Network error while cancelling.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="row row-wrap">
        <button className="btn btn-ghost btn-sm" type="button" onClick={sync} disabled={busy}>
          {busy ? 'Working…' : 'Refresh billing status'}
        </button>
        {hasPlus && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={cancel} disabled={busy}>
            Cancel auto-renew
          </button>
        )}
      </div>
      {message && (
        <p className={message.tone === 'ok' ? 'alert alert-success' : 'alert alert-error'} style={{ marginTop: 10 }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
