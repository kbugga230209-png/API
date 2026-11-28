import { EncryptionEnvelope, InkVaultDocument } from '../model/types';

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations = 100_000): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts sensitive notebook content (pages, outlines, audioSessions, migrationReport)
 * using real PBKDF2-SHA256 + AES-256-GCM authenticated encryption while preserving
 * minimal library card metadata (id, title, folderId, cover, timestamps) so locked
 * notebooks appear in the Library with a Lock badge until unlocked.
 */
export async function encryptDocumentContent(
  doc: InkVaultDocument,
  passphrase: string,
  hint?: string
): Promise<InkVaultDocument> {
  if (!passphrase || passphrase.length < 1) {
    throw new Error('Passphrase is required to encrypt a notebook.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 100_000;
  const key = await deriveAesKey(passphrase, salt, iterations);

  const secretPayload = JSON.stringify({
    pages: doc.pages,
    outline: doc.outline,
    audioSessions: doc.audioSessions,
    migrationReport: doc.migrationReport,
    activePageIndex: doc.activePageIndex,
  });

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(secretPayload)
  );

  const envelope: EncryptionEnvelope = {
    encrypted: true,
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations,
    saltBase64: uint8ToBase64(salt),
    ivBase64: uint8ToBase64(iv),
    ciphertextBase64: uint8ToBase64(new Uint8Array(cipherBuffer)),
    hint,
  };

  return {
    ...doc,
    pages: [],
    outline: [],
    audioSessions: [],
    migrationReport: undefined,
    isEncrypted: true,
    encryptionEnvelope: envelope,
    updatedAt: Date.now(),
  };
}

export async function decryptDocumentContent(
  encryptedDoc: InkVaultDocument,
  passphrase: string
): Promise<InkVaultDocument> {
  if (!encryptedDoc.isEncrypted || !encryptedDoc.encryptionEnvelope) {
    return encryptedDoc;
  }
  const env = encryptedDoc.encryptionEnvelope;
  const salt = base64ToUint8(env.saltBase64);
  const iv = base64ToUint8(env.ivBase64);
  const ciphertext = base64ToUint8(env.ciphertextBase64);
  const key = await deriveAesKey(passphrase, salt, env.iterations || 100_000);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
  } catch {
    throw new Error('Incorrect passphrase or corrupted encrypted payload.');
  }

  const parsed = JSON.parse(new TextDecoder().decode(decryptedBuffer));
  return {
    ...encryptedDoc,
    pages: parsed.pages ?? [],
    outline: parsed.outline ?? [],
    audioSessions: parsed.audioSessions ?? [],
    migrationReport: parsed.migrationReport,
    activePageIndex: parsed.activePageIndex ?? 0,
    isEncrypted: false,
    encryptionEnvelope: undefined,
  };
}
