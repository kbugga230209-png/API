'use client';

import { useCallback, useEffect, useState } from 'react';

import { installStatusLabel, progressPercent, type InstallState } from '@bharatbite/core';

import {
  MODEL_MANIFEST_URL,
  modelInstallPreconditions,
  runModelInstall,
  SignatureUnsupported,
} from '@/lib/model-install-client';

type Report =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; version: string; sha256: string | null }
  | { kind: 'stopped'; reason: string; detail: string | null };

export function ModelInstallDiagnostics() {
  const [preconditions, setPreconditions] = useState<{ ready: boolean; reasons: string[] }>({
    ready: false,
    reasons: ['checking this browser…'],
  });
  const [state, setState] = useState<InstallState | null>(null);
  const [report, setReport] = useState<Report>({ kind: 'idle' });

  useEffect(() => {
    setPreconditions(modelInstallPreconditions());
  }, []);

  const run = useCallback(
    async (skipConsent: boolean) => {
      setReport({ kind: 'running' });
      try {
        const outcome = await runModelInstall({ skipConsent, onState: setState });
        if (outcome.state.phase === 'awaiting_consent') {
          setReport({ kind: 'stopped', reason: 'consent_required', detail: `Model ${outcome.manifest?.version ?? '?'} is published and its signature verified.` });
          return;
        }
        if (outcome.failure) {
          const detail =
            outcome.failure.reason === 'manifest_unavailable'
              ? 'No model has been published for this deployment yet. Nothing is downloaded and nothing is claimed.'
              : (outcome.failure.detail ?? null);
          setReport({ kind: 'stopped', reason: outcome.failure.reason, detail });
          return;
        }
        setReport({
          kind: 'ok',
          version: outcome.manifest?.version ?? '?',
          sha256: outcome.manifest?.sha256 ?? null,
        });
      } catch (error) {
        if (error instanceof SignatureUnsupported) {
          setReport({ kind: 'stopped', reason: 'signature_unsupported', detail: error.message });
          return;
        }
        setReport({
          kind: 'stopped',
          reason: 'unexpected_error',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [],
  );

  const busy = report.kind === 'running';

  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 22 }}>
      <div className="card card-pad">
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>This device</h2>
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          <li>
            Publisher key:{' '}
            {preconditions.ready ? (
              <strong>compiled in</strong>
            ) : (
              <strong>{preconditions.reasons.join('; ')}</strong>
            )}
          </li>
          <li>
            Manifest endpoint: <code className="mono">{MODEL_MANIFEST_URL}</code>
          </li>
          <li>
            Stage: <strong>{state ? installStatusLabel(state) : 'idle'}</strong>
            {state && state.totalBytes > 0 && state.phase !== 'idle' ? (
              <span className="muted"> · {progressPercent(state)}% of {state.totalBytes} bytes</span>
            ) : null}
          </li>
          {state?.error ? <li>Last error: <code className="mono">{state.error}</code></li> : null}
        </ul>
      </div>

      <div className="card card-pad">
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Check what is published</h2>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Fetches the signed manifest and verifies its Ed25519 signature. This never downloads the model and
          never writes to storage.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={() => run(false)} disabled={busy}>
            {busy ? 'Checking…' : 'Check for a model'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => run(true)} disabled={busy}>
            Download and verify
          </button>
        </div>
      </div>

      {report.kind === 'stopped' ? (
        <div className="alert alert-error">
          <strong>Installation stopped: {report.reason}</strong>
          {report.detail ? <p className="small" style={{ marginTop: 6 }}>{report.detail}</p> : null}
          <p className="small muted" style={{ marginTop: 6 }}>
            Nothing unverified was kept. Search, the diary and the planner work as normal.
          </p>
        </div>
      ) : null}

      {report.kind === 'ok' ? (
        <div className="alert">
          <strong>Model {report.version} installed.</strong>
          <p className="small" style={{ marginTop: 6 }}>
            Signature and SHA-256 both verified{report.sha256 ? ` (${report.sha256.slice(0, 16)}…)` : ''}.
          </p>
        </div>
      ) : null}

      <p className="small muted">
        Verification runs in the browser: Ed25519 over the canonical manifest, then SHA-256 over the exact
        bytes received. Bytes are written to Cache Storage only after the checksum matches, and they are
        discarded if the runtime fails to load them.
      </p>
    </div>
  );
}
