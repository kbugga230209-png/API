/**
 * Browser adapters for the model installer.
 *
 * The install logic itself lives in `@bharatbite/core` (`model-install.ts`) and is
 * fully unit-tested with injected dependencies. This file supplies the real ones:
 * fetch, Cache Storage, WebCrypto SHA-256, WebCrypto Ed25519 and a runtime check.
 *
 * Two limits are stated rather than hidden:
 *  - Ed25519 verification needs WebCrypto Ed25519 support; where the browser lacks
 *    it we fail closed instead of skipping verification.
 *  - This build has no TFLite interpreter, so the runtime check fails with
 *    `RuntimeUnavailable`. The installer therefore never claims `ready` here: it
 *    reports exactly that the bytes verified but cannot be executed yet.
 */

import {
  installModel,
  type ArtifactResponse,
  type InferenceRuntime,
  type InstallOutcome,
  type ManifestResponse,
  type InstallState,
  type ModelManifest,
  type ModelStore,
} from '@bharatbite/core';

import { APP_VERSION, SUPABASE_URL } from './config';

export const MODEL_MANIFEST_URL = `${SUPABASE_URL}/functions/v1/model-manifest`;
export const MODEL_PUBLIC_KEY: string = process.env.NEXT_PUBLIC_MODEL_PUBLIC_KEY ?? '';
export const MODEL_CACHE = 'bharatbite-models-v1';

export class RuntimeUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeUnavailable';
  }
}

export class SignatureUnsupported extends Error {
  constructor() {
    super('This browser cannot verify Ed25519 signatures, so a model cannot be trusted here.');
    this.name = 'SignatureUnsupported';
  }
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) throw new Error('not a hex string');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.trim());
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const ed25519Verifier = async (
  payload: Uint8Array,
  signatureBase64: string,
  publicKeyBase64: string,
): Promise<boolean> => {
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey('raw', base64ToBytes(publicKeyBase64), { name: 'Ed25519' }, false, [
      'verify',
    ]);
  } catch {
    throw new SignatureUnsupported();
  }
  return crypto.subtle.verify({ name: 'Ed25519' }, key, base64ToBytes(signatureBase64), payload);
};

/** Cache Storage store. Bytes are written only after the caller verified them. */
export const cacheStore: ModelStore = {
  async save(modelId, version, bytes) {
    const cache = await caches.open(MODEL_CACHE);
    const request = new Request(`/${MODEL_CACHE}/${modelId}`);
    await cache.put(
      request,
      new Response(bytes.slice(), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-BharatBite-Model-Version': version,
        },
      }),
    );
  },
  async load(modelId) {
    const cache = await caches.open(MODEL_CACHE);
    const response = await cache.match(`/${MODEL_CACHE}/${modelId}`);
    if (!response) return null;
    return {
      version: response.headers.get('X-BharatBite-Model-Version') ?? 'unknown',
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  },
  async clear(modelId) {
    const cache = await caches.open(MODEL_CACHE);
    await cache.delete(`/${MODEL_CACHE}/${modelId}`);
  },
};

/** A TFLite flatbuffer starts with 4 bytes of offset then the magic "TFL3". */
export function looksLikeTflite(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false;
  return bytes[4] === 0x54 && bytes[5] === 0x46 && bytes[6] === 0x4c && bytes[7] === 0x33;
}

export const structuralRuntime: InferenceRuntime = {
  async healthCheck(bytes, manifest: ModelManifest) {
    if (!looksLikeTflite(bytes)) {
      throw new Error('artifact is not a TFLite flatbuffer');
    }
    throw new RuntimeUnavailable(
      `model ${manifest.version} downloaded and verified, but this build has no TFLite interpreter to run it. ` +
        'Recognition stays off; search and the nutrition catalog are unaffected.',
    );
  },
};

async function fetchManifest(url: string): Promise<ManifestResponse> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json(),
  };
}

async function fetchArtifact(url: string, signal?: AbortSignal): Promise<ArtifactResponse> {
  const response = await fetch(url, { signal });
  return {
    ok: response.ok,
    status: response.status,
    contentLength: Number(response.headers.get('content-length') ?? 0) || null,
    arrayBuffer: () => response.arrayBuffer(),
  };
}

export interface RunInstallOptions {
  readonly skipConsent?: boolean;
  readonly onState?: (state: InstallState) => void;
  readonly signal?: AbortSignal;
}

export async function runModelInstall(options: RunInstallOptions = {}): Promise<InstallOutcome> {
  return installModel(
    {
      manifestUrl: MODEL_MANIFEST_URL,
      publicKeyBase64: MODEL_PUBLIC_KEY,
      appVersion: APP_VERSION,
      fetchManifest,
      fetchArtifact,
      store: cacheStore,
      runtime: structuralRuntime,
      verifySignature: ed25519Verifier,
      sha256: sha256Hex,
    },
    { skipConsent: options.skipConsent, onState: options.onState, signal: options.signal },
  );
}

/** True when this build can even attempt a verified install. */
export function modelInstallPreconditions(): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (typeof window === 'undefined') reasons.push('not running in a browser');
  if (!MODEL_PUBLIC_KEY) reasons.push('no publisher public key is compiled into this build');
  if (typeof caches === 'undefined') reasons.push('Cache Storage is unavailable');
  if (typeof crypto === 'undefined' || !crypto.subtle) reasons.push('WebCrypto is unavailable (HTTPS required)');
  return { ready: reasons.length === 0, reasons };
}
