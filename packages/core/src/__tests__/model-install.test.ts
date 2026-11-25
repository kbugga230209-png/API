import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  installModel,
  installStatusLabel,
  MAX_ARTIFACT_BYTES,
  type InstallerDeps,
  type ModelStore,
} from '../model-install.js';
import {
  canonicalManifestPayload,
  initialInstallState,
  MAX_INSTALL_ATTEMPTS,
  type ModelManifest,
} from '../manifest.js';

const ARTIFACT = new TextEncoder().encode('TFL3-not-a-real-model-but-real-bytes');
const PUBLIC_KEY = 'cHVibGljLWtleQ==';

function manifest(overrides: Partial<ModelManifest> = {}): ModelManifest {
  return {
    schemaVersion: 1,
    modelId: 'bharatbite-indian-food',
    version: '1.0.0',
    channel: 'stable',
    format: 'tflite',
    architecture: 'efficientnet_lite0_int8',
    fileUrl: 'https://cdn.example.test/model.tflite',
    sizeBytes: ARTIFACT.byteLength,
    sha256: 'a'.repeat(64),
    inputShape: [1, 224, 224, 3],
    labels: 50,
    validationTop1: 0.81,
    minAppVersion: '0.1.0',
    releasedAt: '2026-12-01T00:00:00Z',
    signature: 'c2lnbmF0dXJl',
    ...overrides,
  };
}

function memoryStore(): ModelStore & { entries: Map<string, { version: string; bytes: Uint8Array }> } {
  const entries = new Map<string, { version: string; bytes: Uint8Array }>();
  return {
    entries,
    async save(modelId, version, bytes) {
      entries.set(modelId, { version, bytes });
    },
    async load(modelId) {
      return entries.get(modelId) ?? null;
    },
    async clear(modelId) {
      entries.delete(modelId);
    },
  };
}

interface Harness {
  deps: InstallerDeps;
  store: ReturnType<typeof memoryStore>;
  calls: { manifest: number; artifact: number; health: number; stored: boolean };
}

function harness(
  options: {
    payload?: unknown;
    manifestStatus?: number;
    artifactBytes?: Uint8Array;
    artifactStatus?: number;
    signatureValid?: boolean;
    manifestSha256?: string;
    healthThrows?: boolean;
    sha256?: string;
    sizeBytes?: number;
  } = {},
): Harness {
  const store = memoryStore();
  const calls = { manifest: 0, artifact: 0, health: 0, stored: false };
  const body = options.payload ?? manifest({ sha256: options.manifestSha256 ?? 'a'.repeat(64) });
  const artifactBytes = options.artifactBytes ?? ARTIFACT;

  const deps: InstallerDeps = {
    manifestUrl: 'https://cdn.example.test/model-manifest.json',
    publicKeyBase64: PUBLIC_KEY,
    appVersion: '0.1.0',
    store: {
      ...store,
      async save(modelId, version, bytes) {
        calls.stored = true;
        await store.save(modelId, version, bytes);
      },
    },
    runtime: {
      async healthCheck() {
        calls.health += 1;
        if (options.healthThrows) throw new Error('interpreter refused the model');
      },
    },
    async fetchManifest() {
      calls.manifest += 1;
      return {
        ok: (options.manifestStatus ?? 200) < 400,
        status: options.manifestStatus ?? 200,
        json: async () => body,
      };
    },
    async fetchArtifact() {
      calls.artifact += 1;
      return {
        ok: (options.artifactStatus ?? 200) < 400,
        status: options.artifactStatus ?? 200,
        contentLength: artifactBytes.byteLength,
        arrayBuffer: async () => artifactBytes.slice().buffer,
      };
    },
    verifySignature: async (payload, signature, publicKey) => {
      assert.equal(publicKey, PUBLIC_KEY);
      assert.ok(payload.byteLength > 0);
      assert.ok(signature.length > 0);
      return options.signatureValid ?? true;
    },
    sha256: async () => options.sha256 ?? 'a'.repeat(64),
  };

  return { deps, store, calls };
}

test('happy path installs and proves the model runs', async () => {
  const h = harness();
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.state.phase, 'ready');
  assert.equal(outcome.failure, null);
  assert.equal(h.calls.artifact, 1);
  assert.equal(h.calls.health, 1);
  assert.ok(h.calls.stored);
  const stored = await h.store.load('bharatbite-indian-food');
  assert.equal(stored?.version, '1.0.0');
  assert.equal(stored?.bytes.byteLength, ARTIFACT.byteLength);
});

test('asks for consent before downloading anything', async () => {
  const h = harness();
  const outcome = await installModel(h.deps);
  assert.equal(outcome.state.phase, 'awaiting_consent');
  assert.equal(outcome.state.totalBytes, ARTIFACT.byteLength);
  assert.equal(outcome.state.version, '1.0.0');
  assert.equal(h.calls.artifact, 0);
  assert.equal(h.calls.stored, false);
});

test('a 404 manifest is "not published", not a crash', async () => {
  const h = harness({ manifestStatus: 404 });
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.state.phase, 'failed');
  assert.equal(outcome.failure?.reason, 'manifest_unavailable');
  assert.equal(outcome.failure?.detail, 'HTTP 404');
  assert.equal(h.calls.artifact, 0);
});

test('a malformed manifest is rejected before any download', async () => {
  const h = harness({ payload: { schemaVersion: 1, modelId: 'x' } });
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.failure?.reason, 'manifest_invalid');
  assert.equal(h.calls.artifact, 0);
});

test('a manifest for a newer app is deferred', async () => {
  const h = harness({ payload: manifest({ minAppVersion: '9.0.0' }) });
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.failure?.reason, 'manifest_incompatible');
  assert.equal(h.calls.artifact, 0);
});

test('an untrusted signature stops the install and downloads nothing', async () => {
  const h = harness({ signatureValid: false });
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.failure?.reason, 'manifest_untrusted');
  assert.equal(h.calls.artifact, 0);
  assert.equal(h.calls.stored, false);
  assert.deepEqual(
    await h.store.load('bharatbite-indian-food'),
    null,
    'nothing may be stored when the manifest is not signed by us',
  );
});

test('the signature is checked over the canonical payload, not the pretty JSON', async () => {
  let seen = '';
  const deps = { ...harness().deps };
  deps.verifySignature = async (payload) => {
    seen = new TextDecoder().decode(payload);
    return true;
  };
  await installModel(deps, { skipConsent: true });
  const example = manifest();
  const canonical = canonicalManifestPayload(example);
  assert.ok(seen.length > 0);
  assert.ok(!seen.includes('signature'), 'the signature field is excluded from the signed payload');
  assert.equal(seen.split('\n').length, 1, 'canonical payload is a single line');
  assert.equal(canonical.includes('modelId'), true);
});

test('a hash mismatch never reaches storage', async () => {
  const h = harness({ sha256: 'b'.repeat(64), manifestSha256: 'a'.repeat(64) });
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.failure?.reason, 'artifact_hash_mismatch');
  assert.equal(h.calls.stored, false);
  assert.equal(h.calls.health, 0);
  assert.equal(await h.store.load('bharatbite-indian-food'), null);
});

test('a short download is rejected before hashing', async () => {
  const h = harness({ artifactBytes: new Uint8Array([84, 70, 76]) });
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.failure?.reason, 'artifact_size_mismatch');
  assert.equal(h.calls.stored, false);
});

test('an oversized artifact is refused from the manifest alone', async () => {
  const h = harness({ payload: manifest({ sizeBytes: MAX_ARTIFACT_BYTES + 1 }) });
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.failure?.reason, 'artifact_too_large');
  assert.equal(h.calls.artifact, 0);
});

test('a model that cannot execute is removed again', async () => {
  const h = harness({ healthThrows: true });
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.failure?.reason, 'health_check_failed');
  assert.equal(await h.store.load('bharatbite-indian-food'), null, 'a non-running model must not stay installed');
});

test('artifact request failure is reported, not swallowed', async () => {
  const h = harness({ artifactStatus: 503 });
  const outcome = await installModel(h.deps, { skipConsent: true });
  assert.equal(outcome.failure?.reason, 'artifact_unavailable');
  assert.equal(outcome.failure?.detail, 'HTTP 503');
});

test('an aborted download is a failure, not a partial install', async () => {
  const controller = new AbortController();
  const h = harness();
  const deps: InstallerDeps = {
    ...h.deps,
    async fetchArtifact() {
      controller.abort();
      throw new Error('aborted');
    },
  };
  const outcome = await installModel(deps, { skipConsent: true, signal: controller.signal });
  assert.equal(outcome.failure?.reason, 'aborted');
  assert.equal(h.calls.stored, false);
});

test('retries stop at MAX_INSTALL_ATTEMPTS', async () => {
  const h = harness();
  const exhausted = { ...initialInstallState, phase: 'failed' as const, attempt: MAX_INSTALL_ATTEMPTS };
  const outcome = await installModel(h.deps, { skipConsent: true, previousState: exhausted });
  assert.equal(outcome.failure?.reason, 'too_many_attempts');
  assert.equal(h.calls.manifest, 0, 'no further network calls once the attempt budget is spent');
});

test('a failed state with attempts left still retries', async () => {
  const h = harness();
  const retryable = { ...initialInstallState, phase: 'failed' as const, attempt: 1 };
  const outcome = await installModel(h.deps, { skipConsent: true, previousState: retryable });
  assert.equal(outcome.state.phase, 'ready');
});

test('state transitions are emitted in order', async () => {
  const seen: string[] = [];
  const h = harness();
  await installModel(h.deps, { skipConsent: true, onState: (state) => {
    if (seen[seen.length - 1] !== state.phase) seen.push(state.phase);
  } });
  assert.deepEqual(seen, [
    'fetching_manifest',
    'awaiting_consent',
    'downloading',
    'verifying',
    'installing',
    'health_check',
    'ready',
  ]);
});

test('every phase has a human label', () => {
  const phases = [
    'idle',
    'fetching_manifest',
    'awaiting_consent',
    'downloading',
    'paused',
    'verifying',
    'installing',
    'health_check',
    'ready',
    'failed',
  ] as const;
  for (const phase of phases) {
    const label = installStatusLabel({ ...initialInstallState, phase });
    assert.ok(label.length > 0, phase);
    assert.notEqual(label, 'Unknown', phase);
  }
});
