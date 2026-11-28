import JSZip from 'jszip';
import { createId } from '../model/documentModel';
import {
  BinaryAssetRecord,
  CustomStickerRecord,
  CustomTemplateRecord,
  DocumentVersionSnapshot,
  INKVAULT_SCHEMA_VERSION,
  InkVaultDocument,
  InkVaultFolder,
  StudySet,
  SyncConflictRecord,
} from '../model/types';
import { InkVaultStorageEngine } from './storageEngine';

/**
 * Collects all binary asset IDs referenced anywhere inside a single InkVaultDocument.
 */
export function collectDocumentAssetIds(doc: InkVaultDocument): Set<string> {
  const ids = new Set<string>();
  if (doc.cover.customImageAssetId) ids.add(doc.cover.customImageAssetId);
  for (const s of doc.audioSessions) {
    if (s.assetId) ids.add(s.assetId);
  }
  for (const p of doc.pages) {
    if (p.background.pdfAssetId) ids.add(p.background.pdfAssetId);
    if (p.background.imageAssetId) ids.add(p.background.imageAssetId);
    for (const im of p.images) {
      if (im.assetId) ids.add(im.assetId);
    }
    for (const st of p.stickers) {
      if (st.assetId) ids.add(st.assetId);
    }
  }
  return ids;
}

/**
 * Exports a single notebook + all its binary assets (PDFs, images, audio recordings)
 * into a portable, lossless `.inkvault` ZIP archive.
 */
export async function exportSingleNotebookArchive(
  doc: InkVaultDocument,
  storage: InkVaultStorageEngine
): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        format: 'inkvault-notebook-archive',
        schemaVersion: INKVAULT_SCHEMA_VERSION,
        exportedAt: Date.now(),
        documentId: doc.id,
        title: doc.title,
      },
      null,
      2
    )
  );
  zip.file('document.json', JSON.stringify(doc, null, 2));

  const assetIds = collectDocumentAssetIds(doc);
  for (const id of assetIds) {
    const asset = await storage.getAsset(id);
    if (asset) {
      zip.file(`assets/${id}.json`, JSON.stringify(asset));
    }
  }

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Exports Markdown + Recognized OCR / PDF / Typed Text summary of a notebook.
 */
export function exportDocumentToMarkdown(doc: InkVaultDocument): string {
  const lines: string[] = [`# ${doc.title}`, ''];
  if (doc.outline.length > 0) {
    lines.push('## Outline');
    for (const node of doc.outline) {
      const pIdx = doc.pages.findIndex((p) => p.id === node.pageId);
      lines.push(`${'  '.repeat(node.level)}- ${node.title} (Page ${pIdx + 1})`);
    }
    lines.push('');
  }

  doc.pages.forEach((p, idx) => {
    lines.push(`## Page ${idx + 1}${p.bookmarked ? ` — ★ ${p.bookmarkLabel || 'Bookmarked'}` : ''}`);
    for (const tb of p.textBoxes) {
      if (tb.text.trim()) {
        lines.push(tb.text.trim());
        lines.push('');
      }
    }
    if (p.ocrText && p.ocrText.trim()) {
      lines.push(`> **Handwriting / Image OCR:** ${p.ocrText.trim()}`);
      lines.push('');
    }
    if (p.pdfText && p.pdfText.trim()) {
      lines.push(`> **PDF Text:** ${p.pdfText.trim()}`);
      lines.push('');
    }
  });

  return lines.join('\n');
}

export interface FullLibraryBackupManifest {
  format: 'inkvault-full-library-backup';
  schemaVersion: string;
  createdAt: number;
  documentCount: number;
  folderCount: number;
  studySetCount: number;
  assetCount: number;
  versionCount: number;
}

/**
 * Exports the user's COMPLETE local library (notebooks, encrypted vaults, folders,
 * binary PDF/image/audio assets, study sets, custom templates, stickers, version snapshots, settings)
 * into a single open `.inkvault-backup.zip` archive.
 */
export async function exportFullLibraryBackupZip(
  storage: InkVaultStorageEngine
): Promise<{ bytes: Uint8Array; manifest: FullLibraryBackupManifest }> {
  const [
    documents,
    folders,
    studySets,
    assets,
    versions,
    customTemplates,
    customStickers,
    settings,
  ] = await Promise.all([
    storage.listDocuments(),
    storage.listFolders(),
    storage.listStudySets(),
    storage.listAssets(),
    storage.listAllVersionSnapshots(),
    storage.listCustomTemplates(),
    storage.listCustomStickers(),
    storage.loadSettings(),
  ]);

  const manifest: FullLibraryBackupManifest = {
    format: 'inkvault-full-library-backup',
    schemaVersion: INKVAULT_SCHEMA_VERSION,
    createdAt: Date.now(),
    documentCount: documents.length,
    folderCount: folders.length,
    studySetCount: studySets.length,
    assetCount: assets.length,
    versionCount: versions.length,
  };

  const zip = new JSZip();
  zip.file('backup-manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('documents.json', JSON.stringify(documents, null, 2));
  zip.file('folders.json', JSON.stringify(folders, null, 2));
  zip.file('study-sets.json', JSON.stringify(studySets, null, 2));
  zip.file('versions.json', JSON.stringify(versions, null, 2));
  zip.file('custom-templates.json', JSON.stringify(customTemplates, null, 2));
  zip.file('custom-stickers.json', JSON.stringify(customStickers, null, 2));
  zip.file('settings.json', JSON.stringify(settings, null, 2));

  for (const asset of assets) {
    zip.file(`assets/${asset.id}.json`, JSON.stringify(asset));
  }

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  await storage.saveSettings({ ...settings, lastBackupAt: manifest.createdAt });
  return { bytes, manifest };
}

/**
 * Restores a complete `.inkvault-backup.zip` archive into local storage (`replace` or `merge` mode).
 */
export async function restoreFullLibraryBackupZip(
  backupZipBytes: Uint8Array,
  storage: InkVaultStorageEngine,
  mode: 'replace' | 'merge' = 'merge'
): Promise<FullLibraryBackupManifest> {
  const zip = await JSZip.loadAsync(backupZipBytes);
  const manifestFile = zip.files['backup-manifest.json'];
  if (!manifestFile) {
    throw new Error('Invalid backup file: missing backup-manifest.json');
  }
  const manifest = JSON.parse(await manifestFile.async('string')) as FullLibraryBackupManifest;
  if (manifest.format !== 'inkvault-full-library-backup') {
    throw new Error(`Unsupported backup format: ${String(manifest.format)}`);
  }

  if (mode === 'replace') {
    await storage.clearAllData();
  }

  const readJsonArray = async <T>(path: string): Promise<T[]> => {
    if (!zip.files[path]) return [];
    return JSON.parse(await zip.files[path].async('string')) as T[];
  };

  const [folders, documents, studySets, versions, customTemplates, customStickers] =
    await Promise.all([
      readJsonArray<InkVaultFolder>('folders.json'),
      readJsonArray<InkVaultDocument>('documents.json'),
      readJsonArray<StudySet>('study-sets.json'),
      readJsonArray<DocumentVersionSnapshot>('versions.json'),
      readJsonArray<CustomTemplateRecord>('custom-templates.json'),
      readJsonArray<CustomStickerRecord>('custom-stickers.json'),
    ]);

  // Restore binary assets first so documents always find their referenced assets
  const assetEntries = Object.keys(zip.files).filter(
    (k) => k.startsWith('assets/') && k.endsWith('.json')
  );
  for (const aKey of assetEntries) {
    const asset = JSON.parse(await zip.files[aKey].async('string')) as BinaryAssetRecord;
    await storage.putAssetRecord(asset);
  }

  for (const f of folders) await storage.saveFolder(f);
  for (const d of documents) await storage.saveDocument(d);
  for (const s of studySets) await storage.saveStudySet(s);
  for (const ct of customTemplates) await storage.saveCustomTemplate(ct);
  for (const cs of customStickers) await storage.saveCustomSticker(cs);
  for (const v of versions) {
    await storage.createVersionSnapshot(v.documentSnapshot, v.label, v.trigger);
  }

  if (zip.files['settings.json'] && mode === 'replace') {
    const restoredSettings = JSON.parse(await zip.files['settings.json'].async('string'));
    await storage.saveSettings(restoredSettings);
  }

  return manifest;
}

// --- Optional Cross-Device Synchronisation & Deterministic Conflict Resolution ---

export interface SyncPayloadBundle {
  format: 'inkvault-sync-bundle';
  exportedAt: number;
  documents: InkVaultDocument[];
  folders: InkVaultFolder[];
  studySets: StudySet[];
}

/**
 * Reconciles a remote SyncPayloadBundle (either fetched from a user-configured REST/WebDAV JSON endpoint
 * or imported from a synced folder file) against local storage, detecting divergent concurrent edits
 * and returning explicit `SyncConflictRecord[]` rather than silently overwriting user notes!
 */
export async function reconcileSyncBundle(
  remoteBundle: SyncPayloadBundle,
  storage: InkVaultStorageEngine,
  lastSyncAt: number | null
): Promise<{
  appliedRemoteDocs: number;
  conflicts: SyncConflictRecord[];
}> {
  const localDocs = await storage.listDocuments();
  const localById = new Map(localDocs.map((d) => [d.id, d]));
  const conflicts: SyncConflictRecord[] = [];
  let appliedRemoteDocs = 0;

  for (const rf of remoteBundle.folders ?? []) {
    await storage.saveFolder(rf);
  }

  for (const remoteDoc of remoteBundle.documents ?? []) {
    const localDoc = localById.get(remoteDoc.id);
    if (!localDoc) {
      await storage.saveDocument(remoteDoc);
      appliedRemoteDocs++;
      continue;
    }

    // Identical state -> nothing to do
    if (
      localDoc.revision === remoteDoc.revision &&
      localDoc.updatedAt === remoteDoc.updatedAt
    ) {
      continue;
    }

    const baseline = lastSyncAt ?? 0;
    const localChangedSinceSync = localDoc.updatedAt > baseline;
    const remoteChangedSinceSync = remoteDoc.updatedAt > baseline;
    const differentOrigin = localDoc.deviceId !== remoteDoc.deviceId;

    if (localChangedSinceSync && remoteChangedSinceSync && differentOrigin) {
      conflicts.push({
        id: createId('cnf'),
        documentId: localDoc.id,
        documentTitle: localDoc.title,
        localDoc,
        remoteDoc,
        detectedAt: Date.now(),
      });
    } else if (remoteDoc.updatedAt > localDoc.updatedAt) {
      await storage.saveDocument(remoteDoc);
      appliedRemoteDocs++;
    }
  }

  return { appliedRemoteDocs, conflicts };
}

export async function resolveSyncConflict(
  conflict: SyncConflictRecord,
  resolution: 'keep-local' | 'accept-remote' | 'keep-both',
  storage: InkVaultStorageEngine
): Promise<void> {
  if (resolution === 'keep-local') {
    await storage.saveDocument({
      ...conflict.localDoc,
      revision: Math.max(conflict.localDoc.revision, conflict.remoteDoc.revision) + 1,
      updatedAt: Date.now(),
    });
    return;
  }

  if (resolution === 'accept-remote') {
    await storage.createVersionSnapshot(
      conflict.localDoc,
      'Local copy before accepting remote sync',
      'pre-restore'
    );
    await storage.saveDocument({
      ...conflict.remoteDoc,
      revision: Math.max(conflict.localDoc.revision, conflict.remoteDoc.revision) + 1,
      updatedAt: Date.now(),
    });
    return;
  }

  // keep-both: retain local AND save remote as an independent copy!
  const remoteCopy: InkVaultDocument = {
    ...structuredClone(conflict.remoteDoc),
    id: createId('doc'),
    title: `${conflict.remoteDoc.title} (Synced Copy)`,
    updatedAt: Date.now(),
  };
  await storage.saveDocument(remoteCopy);
}
