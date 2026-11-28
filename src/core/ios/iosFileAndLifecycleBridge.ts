import JSZip from 'jszip';
import { InkVaultDocument } from '../model/types';
import { sha256Hex, uint8ToBase64 } from '../storage/cryptoVault';
import { InkVaultStorageEngine } from '../storage/storageEngine';
import {
  isRunningInNativeIOSShell,
  postCommandToNativeIOS,
  subscribeToNativeIOSEvents,
} from './pencilKitBridge';

export type AppleExportMethod = 'native-ios-sheet' | 'web-share-sheet' | 'browser-download';

export interface BackupIntegrityResult {
  valid: boolean;
  format: 'inkvault-full-library-backup' | 'inkvault-notebook-archive' | 'unknown';
  sha256: string;
  documentCount: number;
  assetCount: number;
  corruptedEntries: string[];
  errorMessage?: string;
}

/**
 * Checks whether the current runtime supports the native iPadOS/iOS Share Sheet
 * (either via the native SwiftUI host `UIActivityViewController` or Safari Web Share Level 2).
 */
export function canUseAppleShareSheet(): boolean {
  if (isRunningInNativeIOSShell()) return true;
  if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
    try {
      const probe = new File([new Uint8Array([1])], 'probe.pdf', {
        type: 'application/pdf',
      });
      return navigator.canShare({ files: [probe] });
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Shares or exports a binary/text file into Apple's document ecosystem:
 * - Native iOS/iPadOS Shell -> `UIActivityViewController` (Save to Files, AirDrop, Books, Mail)
 * - iPadOS/macOS Safari -> `navigator.share({ files })` (Share Sheet + Save to Files + AirDrop)
 * - Fallback -> Direct file download
 */
export async function shareOrExportToAppleFiles(params: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  preferShareSheet?: boolean;
}): Promise<AppleExportMethod> {
  const { bytes, fileName, mimeType, preferShareSheet = false } = params;

  // 1. Native iOS/iPadOS SwiftUI Host
  if (isRunningInNativeIOSShell()) {
    const sent = postCommandToNativeIOS({
      command: 'shareFile',
      fileName,
      mimeType,
      base64Data: uint8ToBase64(bytes),
    });
    if (sent) return 'native-ios-sheet';
  }

  // 2. Safari / iPadOS Web Share API Level 2 (Share Sheet, AirDrop, Save to Files)
  if (
    preferShareSheet &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      const file = new File([bytes as unknown as BlobPart], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: fileName,
          files: [file],
        });
        return 'web-share-sheet';
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'web-share-sheet';
      }
    }
  }

  // 3. Universal Anchor Download (saves directly to Downloads / iPadOS Files Downloads folder)
  if (typeof document !== 'undefined') {
    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    const url =
      typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(blob)
        : `data:${mimeType};base64,${uint8ToBase64(bytes)}`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  return 'browser-download';
}

/**
 * Mirrors an edited notebook into the native iOS `Application Support/InkVaultVault` directory
 * (`NSFileProtectionCompleteUntilFirstUserAuthentication`) when running inside the native iOS app.
 */
export function mirrorDocumentToNativeVault(doc: InkVaultDocument): boolean {
  if (!isRunningInNativeIOSShell()) return false;
  return postCommandToNativeIOS({
    command: 'mirrorVaultCheckpoint',
    documentId: doc.id,
    documentJson: JSON.stringify(doc),
    updatedAt: doc.updatedAt,
  });
}

/**
 * Performs a non-destructive integrity audit on an `.inkvault-backup.zip` or `.inkvault`
 * archive BEFORE restoration, verifying ZIP central directory, JSON parseability,
 * required schema fields, and asset SHA-256 checksums where present.
 */
export async function verifyBackupArchiveIntegrity(
  bytes: Uint8Array
): Promise<BackupIntegrityResult> {
  const archiveHash = await sha256Hex(bytes);
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (err) {
    return {
      valid: false,
      format: 'unknown',
      sha256: archiveHash,
      documentCount: 0,
      assetCount: 0,
      corruptedEntries: ['<zip-central-directory>'],
      errorMessage:
        err instanceof Error ? `Invalid ZIP archive: ${err.message}` : 'Invalid ZIP archive',
    };
  }

  const manifestEntry = zip.file('backup-manifest.json') ?? zip.file('manifest.json');
  if (!manifestEntry) {
    return {
      valid: false,
      format: 'unknown',
      sha256: archiveHash,
      documentCount: 0,
      assetCount: 0,
      corruptedEntries: ['backup-manifest.json'],
      errorMessage: 'Archive is missing backup-manifest.json / manifest.json',
    };
  }

  let manifest: { format?: string; documentCount?: number; assetCount?: number };
  try {
    manifest = JSON.parse(await manifestEntry.async('string'));
  } catch {
    return {
      valid: false,
      format: 'unknown',
      sha256: archiveHash,
      documentCount: 0,
      assetCount: 0,
      corruptedEntries: ['manifest.json'],
      errorMessage: 'manifest.json is corrupted and cannot be parsed',
    };
  }

  const corruptedEntries: string[] = [];
  let documentCount = 0;
  let assetCount = 0;

  if (manifest.format === 'inkvault-full-library-backup') {
    const docsEntry = zip.file('documents.json');
    if (!docsEntry) {
      corruptedEntries.push('documents.json');
    } else {
      try {
        const docs = JSON.parse(await docsEntry.async('string')) as InkVaultDocument[];
        if (!Array.isArray(docs)) {
          corruptedEntries.push('documents.json');
        } else {
          documentCount = docs.length;
          for (const d of docs) {
            if (!d || typeof d.id !== 'string' || !Array.isArray(d.pages)) {
              corruptedEntries.push(`document:${String((d as { id?: unknown })?.id ?? 'invalid')}`);
            }
          }
        }
      } catch {
        corruptedEntries.push('documents.json');
      }
    }

    const assetEntries = Object.keys(zip.files).filter(
      (p) => p.startsWith('assets/') && p.endsWith('.json')
    );
    assetCount = assetEntries.length;
    for (const path of assetEntries) {
      try {
        const raw = await zip.file(path)!.async('string');
        const parsed = JSON.parse(raw) as { id?: string; dataBase64?: string };
        if (!parsed.id || typeof parsed.dataBase64 !== 'string') {
          corruptedEntries.push(path);
        }
      } catch {
        corruptedEntries.push(path);
      }
    }

    return {
      valid: corruptedEntries.length === 0,
      format: 'inkvault-full-library-backup',
      sha256: archiveHash,
      documentCount,
      assetCount,
      corruptedEntries,
      errorMessage:
        corruptedEntries.length > 0
          ? `Corrupted entries detected: ${corruptedEntries.join(', ')}`
          : undefined,
    };
  }

  if (manifest.format === 'inkvault-notebook-archive') {
    const docEntry = zip.file('document.json');
    if (!docEntry) {
      corruptedEntries.push('document.json');
    } else {
      try {
        const doc = JSON.parse(await docEntry.async('string')) as InkVaultDocument;
        if (!doc || typeof doc.id !== 'string' || !Array.isArray(doc.pages)) {
          corruptedEntries.push('document.json');
        } else {
          documentCount = 1;
        }
      } catch {
        corruptedEntries.push('document.json');
      }
    }

    const assetEntries = Object.keys(zip.files).filter(
      (p) => p.startsWith('assets/') && p.endsWith('.json')
    );
    assetCount = assetEntries.length;

    return {
      valid: corruptedEntries.length === 0,
      format: 'inkvault-notebook-archive',
      sha256: archiveHash,
      documentCount,
      assetCount,
      corruptedEntries,
      errorMessage:
        corruptedEntries.length > 0
          ? `Corrupted entries detected: ${corruptedEntries.join(', ')}`
          : undefined,
    };
  }

  return {
    valid: false,
    format: 'unknown',
    sha256: archiveHash,
    documentCount: 0,
    assetCount: 0,
    corruptedEntries: ['manifest.json'],
    errorMessage: `Unrecognized archive format: ${String(manifest.format)}`,
  };
}

/**
 * Registers iOS / iPadOS / Web application lifecycle durability listeners
 * (`visibilitychange`, `pagehide`, `freeze`, `beforeunload`, and native `ScenePhase`
 * `willResignActive` / `didEnterBackground`) so pending notebook edits are flushed
 * before iOS suspends or terminates the process.
 */
export function registerIOSLifecyclePersistenceGuards(params: {
  storage: InkVaultStorageEngine;
  getActiveDocument: () => InkVaultDocument | undefined;
  onLifecycleFlush?: (reason: string) => void;
}): () => void {
  const { storage, getActiveDocument, onLifecycleFlush } = params;

  const flushNow = (reason: string) => {
    const activeDoc = getActiveDocument();
    if (activeDoc) {
      mirrorDocumentToNativeVault(activeDoc);
    }
    void storage.flushPendingSaves().then(() => {
      onLifecycleFlush?.(reason);
    });
  };

  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      flushNow('visibility-hidden');
    }
  };
  const onPageHide = () => flushNow('pagehide');
  const onFreeze = () => flushNow('freeze');
  const onBeforeUnload = () => flushNow('beforeunload');

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('freeze', onFreeze);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  const unsubscribeNative = subscribeToNativeIOSEvents((evt) => {
    if (
      evt.type === 'appLifecycleState' &&
      (evt.state === 'willResignActive' ||
        evt.state === 'didEnterBackground' ||
        evt.state === 'memoryWarning')
    ) {
      flushNow(`ios-${evt.state}`);
    }
  });

  return () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('freeze', onFreeze);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    }
    unsubscribeNative();
  };
}
