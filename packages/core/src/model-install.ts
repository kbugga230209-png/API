/**
 * Model installation orchestration — platform agnostic.
 *
 * The signed-manifest and install state machine live in `manifest.ts`. This file
 * drives them: fetch the manifest, verify its Ed25519 signature against the
 * public key compiled into the app, download the artifact with progress, verify
 * the SHA-256 of the bytes actually received, hand the bytes to the inference
 * runtime for a health check, and only then mark the model ready.
 *
 * Nothing is written anywhere until the hash matches, so an interrupted or
 * tampered download can never become the installed model. Every dependency
 * (fetch, storage, signature verification, hashing, clock) is injected, which is
 * why the whole flow is testable in Node without a browser or a real model.
 */

import {
  canRetry,
  initialInstallState,
  installReducer,
  isManifestShapeValid,
  manifestIsCompatible,
  MAX_INSTALL_ATTEMPTS,
  verifyArtifactSha256,
  verifyManifestSignature,
  type InstallEvent,
  type InstallState,
  type ModelManifest,
} from './manifest.js';
import type { Sha256, SignatureVerifier } from './manifest.js';

export interface ManifestResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export interface ArtifactResponse {
  readonly ok: boolean;
  readonly status: number;
  /** Present when the server sent a Content-Length we can reason about. */
  readonly contentLength?: number | null;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Where the verified model bytes end up. Implementations must be atomic. */
export interface ModelStore {
  /** Replace any previously installed artifact with these bytes. */
  save(modelId: string, version: string, bytes: Uint8Array): Promise<void>;
  /** Bytes of the currently installed model, or null. */
  load(modelId: string): Promise<{ version: string; bytes: Uint8Array } | null>;
  clear(modelId: string): Promise<void>;
}

export interface InferenceRuntime {
  /** Load the artifact and run one throwaway inference. Throws if it cannot. */
  healthCheck(bytes: Uint8Array, manifest: ModelManifest): Promise<void>;
}

export interface InstallerDeps {
  readonly fetchManifest: (url: string) => Promise<ManifestResponse>;
  readonly fetchArtifact: (url: string, signal?: AbortSignal) => Promise<ArtifactResponse>;
  readonly store: ModelStore;
  readonly runtime: InferenceRuntime;
  readonly verifySignature: SignatureVerifier;
  readonly sha256: Sha256;
  readonly publicKeyBase64: string;
  readonly appVersion: string;
  readonly manifestUrl: string;
  readonly now?: () => Date;
}

export type InstallFailureReason =
  | 'manifest_unavailable'
  | 'manifest_invalid'
  | 'manifest_untrusted'
  | 'manifest_incompatible'
  | 'artifact_unavailable'
  | 'artifact_too_large'
  | 'artifact_size_mismatch'
  | 'artifact_hash_mismatch'
  | 'health_check_failed'
  | 'storage_failed'
  | 'aborted'
  | 'too_many_attempts';

export interface InstallOutcome {
  readonly state: InstallState;
  readonly manifest: ModelManifest | null;
  readonly failure: { reason: InstallFailureReason; detail?: string } | null;
}

/** Hard ceiling so a hostile or broken manifest cannot exhaust the device. */
export const MAX_ARTIFACT_BYTES = 60 * 1024 * 1024;

export interface InstallOptions {
  /** Skip the consent/confirmation gate (e.g. a user already agreed in settings). */
  readonly skipConsent?: boolean;
  readonly onState?: (state: InstallState) => void;
  readonly signal?: AbortSignal;
  /** Injected so tests can resume a partially attempted install. */
  readonly previousState?: InstallState;
}

function fail(
  state: InstallState,
  reason: InstallFailureReason,
  detail?: string,
  manifest: ModelManifest | null = null,
): InstallOutcome {
  const phased = installReducer(state, { type: 'FAILED', error: reason });
  return { state: { ...phased, error: detail ?? reason }, manifest, failure: { reason, detail } };
}

export async function installModel(deps: InstallerDeps, options: InstallOptions = {}): Promise<InstallOutcome> {
  let state: InstallState = options.previousState ?? initialInstallState;
  if (state.phase === 'failed' && !canRetry(state)) {
    return {
      state,
      manifest: null,
      failure: { reason: 'too_many_attempts', detail: `stopped after ${MAX_INSTALL_ATTEMPTS} attempts` },
    };
  }

  const emit = (event: InstallEvent): void => {
    state = installReducer(state, event);
    options.onState?.(state);
  };

  emit({ type: 'START' });

  // 1. Manifest. A 404 is the normal "no model published" state, not an error to
  //    shout about: recognition stays off and search keeps working.
  let manifestPayload: unknown;
  try {
    const response = await deps.fetchManifest(deps.manifestUrl);
    if (!response.ok) {
      return fail(state, 'manifest_unavailable', `HTTP ${response.status}`);
    }
    manifestPayload = await response.json();
  } catch (error) {
    return fail(state, 'manifest_unavailable', error instanceof Error ? error.message : String(error));
  }

  if (!isManifestShapeValid(manifestPayload)) {
    return fail(state, 'manifest_invalid', 'manifest failed shape validation');
  }
  const manifest = manifestPayload as ModelManifest;

  if (!manifestIsCompatible(manifest, deps.appVersion)) {
    return fail(state, 'manifest_incompatible', `needs app ${manifest.minAppVersion}, have ${deps.appVersion}`, manifest);
  }

  const signatureValid = await verifyManifestSignature(manifest, deps.publicKeyBase64, deps.verifySignature);
  if (!signatureValid) {
    return fail(state, 'manifest_untrusted', 'signature did not verify against the embedded key', manifest);
  }

  emit({ type: 'MANIFEST_READY', totalBytes: manifest.sizeBytes, version: manifest.version });

  if (!options.skipConsent) {
    return { state, manifest, failure: null };
  }
  emit({ type: 'CONSENT_GIVEN' });

  // 2. Artifact.
  if (manifest.sizeBytes > MAX_ARTIFACT_BYTES) {
    return fail(state, 'artifact_too_large', `${manifest.sizeBytes} bytes exceeds ${MAX_ARTIFACT_BYTES}`, manifest);
  }

  let bytes: Uint8Array;
  try {
    const response = await deps.fetchArtifact(manifest.fileUrl, options.signal);
    if (!response.ok) {
      return fail(state, 'artifact_unavailable', `HTTP ${response.status}`, manifest);
    }
    const buffer = await response.arrayBuffer();
    bytes = new Uint8Array(buffer);
  } catch (error) {
    if (options.signal?.aborted) return fail(state, 'aborted', 'download cancelled', manifest);
    return fail(state, 'artifact_unavailable', error instanceof Error ? error.message : String(error), manifest);
  }

  emit({ type: 'PROGRESS', bytesReceived: bytes.byteLength });
  emit({ type: 'DOWNLOAD_COMPLETE' });

  if (bytes.byteLength !== manifest.sizeBytes) {
    return fail(
      state,
      'artifact_size_mismatch',
      `received ${bytes.byteLength} bytes, manifest promised ${manifest.sizeBytes}`,
      manifest,
    );
  }

  // 3. Verify before storing. Nothing touches the store until this passes.
  const hashOk = await verifyArtifactSha256(bytes, manifest.sha256, deps.sha256);
  if (!hashOk) {
    return fail(state, 'artifact_hash_mismatch', 'SHA-256 of the downloaded bytes does not match the manifest', manifest);
  }
  emit({ type: 'VERIFIED' });

  try {
    await deps.store.save(manifest.modelId, manifest.version, bytes);
  } catch (error) {
    return fail(state, 'storage_failed', error instanceof Error ? error.message : String(error), manifest);
  }
  emit({ type: 'INSTALLED' });

  // 4. Prove the installed bytes actually run. A model that cannot execute is
  //    not "ready", even if its signature and hash are valid.
  try {
    await deps.runtime.healthCheck(bytes, manifest);
  } catch (error) {
    await deps.store.clear(manifest.modelId).catch(() => undefined);
    return fail(state, 'health_check_failed', error instanceof Error ? error.message : String(error), manifest);
  }
  emit({ type: 'HEALTH_OK' });

  return { state, manifest, failure: null };
}

/** What the UI should say, per phase. Kept here so every surface agrees. */
export function installStatusLabel(state: InstallState): string {
  switch (state.phase) {
    case 'idle':
      return 'Off';
    case 'fetching_manifest':
      return 'Checking for a model…';
    case 'awaiting_consent':
      return 'Ready to download';
    case 'downloading':
      return 'Downloading';
    case 'paused':
      return 'Paused';
    case 'verifying':
      return 'Verifying signature and checksum';
    case 'installing':
      return 'Installing';
    case 'health_check':
      return 'Checking the model runs';
    case 'ready':
      return 'Installed — works offline';
    case 'failed':
      return 'Not installed';
    default:
      return 'Unknown';
  }
}
