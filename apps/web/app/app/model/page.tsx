import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ModelInstallDiagnostics } from '@/components/ModelInstallDiagnostics';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Recognition model',
  description: 'Model installation status for this device.',
};

export const dynamic = 'force-dynamic';

export default async function ModelPage() {
  const session = await getSessionUser();
  if (!session) redirect('/login?next=/app/model');

  return (
    <main className="wrap" style={{ paddingTop: 36, paddingBottom: 64, maxWidth: 820 }}>
      <p className="small muted">
        <Link href="/app/settings">← Settings</Link>
      </p>
      <span className="eyebrow">On-device recognition</span>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', margin: '10px 0 12px' }}>Recognition model</h1>
      <p className="muted" style={{ maxWidth: '64ch' }}>
        BharatBite can recognise Indian dishes from a photo, on the device, without uploading anything. It
        only does that once a model has been published and verified. This page runs the real installation
        pipeline — manifest signature, artifact checksum, storage, runtime check — and reports exactly where
        it stands. Search and the nutrition catalog work regardless.
      </p>

      <ModelInstallDiagnostics />
    </main>
  );
}
