import { IDBPDatabase, openDB } from 'idb';
import { createId } from '../model/documentModel';
import { DEFAULT_SETTINGS } from '../model/templates';
import {
  AppSettings,
  BinaryAssetRecord,
  CustomStickerRecord,
  CustomTemplateRecord,
  DocumentVersionSnapshot,
  InkVaultDocument,
  InkVaultFolder,
  StudySet,
} from '../model/types';
import { sha256Hex, uint8ToBase64 } from './cryptoVault';

const DB_NAME = 'inkvault_local_db_v1';
const DB_VERSION = 1;

export interface CrashJournalEntry {
  documentId: string;
  document: InkVaultDocument;
  savedAt: number;
}

export class InkVaultStorageEngine {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingAutosaveDocs = new Map<string, InkVaultDocument>();

  private getDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('documents')) {
            const docStore = db.createObjectStore('documents', { keyPath: 'id' });
            docStore.createIndex('folderId', 'folderId', { unique: false });
            docStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
          if (!db.objectStoreNames.contains('folders')) {
            const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
            folderStore.createIndex('parentId', 'parentId', { unique: false });
          }
          if (!db.objectStoreNames.contains('assets')) {
            const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
            assetStore.createIndex('sha256', 'sha256', { unique: false });
          }
          if (!db.objectStoreNames.contains('versions')) {
            const verStore = db.createObjectStore('versions', { keyPath: 'id' });
            verStore.createIndex('documentId', 'documentId', { unique: false });
          }
          if (!db.objectStoreNames.contains('studySets')) {
            db.createObjectStore('studySets', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('customTemplates')) {
            db.createObjectStore('customTemplates', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('customStickers')) {
            db.createObjectStore('customStickers', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('crashRecovery')) {
            db.createObjectStore('crashRecovery', { keyPath: 'documentId' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  // --- Documents ---
  async listDocuments(): Promise<InkVaultDocument[]> {
    const db = await this.getDb();
    const docs = (await db.getAll('documents')) as InkVaultDocument[];
    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getDocument(id: string): Promise<InkVaultDocument | undefined> {
    const db = await this.getDb();
    return db.get('documents', id);
  }

  async saveDocument(doc: InkVaultDocument): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(['documents', 'crashRecovery'], 'readwrite');
    await tx.objectStore('documents').put(doc);
    await tx.objectStore('crashRecovery').delete(doc.id);
    await tx.done;
  }

  /**
   * Non-blocking incremental autosave with synchronous in-memory staging and
   * immediate crash-recovery journal write so lifecycle backgrounding never loses strokes.
   */
  scheduleAutosave(
    doc: InkVaultDocument,
    debounceMs = 350,
    onSaved?: (savedDoc: InkVaultDocument) => void
  ): void {
    this.pendingAutosaveDocs.set(doc.id, doc);

    // Write lightweight crash journal immediately without blocking ink
    this.getDb()
      .then((db) =>
        db.put('crashRecovery', {
          documentId: doc.id,
          document: doc,
          savedAt: Date.now(),
        } satisfies CrashJournalEntry)
      )
      .catch(() => {});

    const prev = this.autosaveTimers.get(doc.id);
    if (prev) clearTimeout(prev);

    const timer = setTimeout(async () => {
      this.autosaveTimers.delete(doc.id);
      this.pendingAutosaveDocs.delete(doc.id);
      await this.saveDocument(doc);
      onSaved?.(doc);
    }, debounceMs);

    this.autosaveTimers.set(doc.id, timer);
  }

  async flushPendingSaves(): Promise<number> {
    for (const [, timer] of this.autosaveTimers) {
      clearTimeout(timer);
    }
    this.autosaveTimers.clear();

    let flushed = 0;
    const staged = Array.from(this.pendingAutosaveDocs.values());
    this.pendingAutosaveDocs.clear();

    for (const doc of staged) {
      await this.saveDocument(doc);
      flushed++;
    }

    const recovered = await this.recoverCrashJournal();
    return flushed + recovered;
  }

  async recoverCrashJournal(): Promise<number> {
    const db = await this.getDb();
    const entries = (await db.getAll('crashRecovery')) as CrashJournalEntry[];
    if (entries.length === 0) return 0;
    let recovered = 0;
    for (const entry of entries) {
      const existing = (await db.get('documents', entry.documentId)) as InkVaultDocument | undefined;
      if (!existing || entry.document.updatedAt >= existing.updatedAt) {
        await db.put('documents', entry.document);
        recovered++;
      }
      await db.delete('crashRecovery', entry.documentId);
    }
    return recovered;
  }

  async moveDocumentToTrash(id: string): Promise<void> {
    const doc = await this.getDocument(id);
    if (!doc) return;
    await this.saveDocument({
      ...doc,
      trashedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  async restoreDocumentFromTrash(id: string): Promise<void> {
    const doc = await this.getDocument(id);
    if (!doc) return;
    await this.saveDocument({
      ...doc,
      trashedAt: null,
      updatedAt: Date.now(),
    });
  }

  async permanentlyDeleteDocument(id: string): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(['documents', 'versions', 'crashRecovery'], 'readwrite');
    await tx.objectStore('documents').delete(id);
    await tx.objectStore('crashRecovery').delete(id);
    const verIndex = tx.objectStore('versions').index('documentId');
    let cursor = await verIndex.openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  // --- Folders ---
  async listFolders(): Promise<InkVaultFolder[]> {
    const db = await this.getDb();
    const folders = (await db.getAll('folders')) as InkVaultFolder[];
    return folders.sort((a, b) => a.order - b.order);
  }

  async saveFolder(folder: InkVaultFolder): Promise<void> {
    const db = await this.getDb();
    await db.put('folders', folder);
  }

  async moveFolderToTrash(folderId: string): Promise<void> {
    const folders = await this.listFolders();
    const docs = await this.listDocuments();
    const now = Date.now();
    const affectedFolderIds = collectDescendantFolderIds(folderId, folders);

    const db = await this.getDb();
    const tx = db.transaction(['folders', 'documents'], 'readwrite');
    for (const f of folders) {
      if (affectedFolderIds.has(f.id)) {
        await tx.objectStore('folders').put({ ...f, trashedAt: now, updatedAt: now });
      }
    }
    for (const d of docs) {
      if (d.folderId && affectedFolderIds.has(d.folderId)) {
        await tx.objectStore('documents').put({ ...d, trashedAt: now, updatedAt: now });
      }
    }
    await tx.done;
  }

  async restoreFolderFromTrash(folderId: string): Promise<void> {
    const folders = await this.listFolders();
    const docs = await this.listDocuments();
    const affectedFolderIds = collectDescendantFolderIds(folderId, folders);

    const db = await this.getDb();
    const tx = db.transaction(['folders', 'documents'], 'readwrite');
    for (const f of folders) {
      if (affectedFolderIds.has(f.id)) {
        await tx.objectStore('folders').put({ ...f, trashedAt: null, updatedAt: Date.now() });
      }
    }
    for (const d of docs) {
      if (d.folderId && affectedFolderIds.has(d.folderId)) {
        await tx.objectStore('documents').put({ ...d, trashedAt: null, updatedAt: Date.now() });
      }
    }
    await tx.done;
  }

  async permanentlyDeleteFolder(folderId: string): Promise<void> {
    const folders = await this.listFolders();
    const docs = await this.listDocuments();
    const affectedFolderIds = collectDescendantFolderIds(folderId, folders);
    for (const d of docs) {
      if (d.folderId && affectedFolderIds.has(d.folderId)) {
        await this.permanentlyDeleteDocument(d.id);
      }
    }
    const db = await this.getDb();
    const tx = db.transaction('folders', 'readwrite');
    for (const fId of affectedFolderIds) {
      await tx.store.delete(fId);
    }
    await tx.done;
  }

  async emptyTrash(): Promise<void> {
    const docs = await this.listDocuments();
    const folders = await this.listFolders();
    for (const d of docs) {
      if (d.trashedAt !== null) {
        await this.permanentlyDeleteDocument(d.id);
      }
    }
    const db = await this.getDb();
    const tx = db.transaction('folders', 'readwrite');
    for (const f of folders) {
      if (f.trashedAt !== null) {
        await tx.store.delete(f.id);
      }
    }
    await tx.done;
  }

  // --- Binary Assets (Deduplicated by SHA-256) ---
  async storeBinaryAsset(
    bytes: Uint8Array | ArrayBuffer,
    mimeType: string,
    fileName?: string
  ): Promise<BinaryAssetRecord> {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const hash = await sha256Hex(u8);
    const db = await this.getDb();
    const existing = (await db.getFromIndex('assets', 'sha256', hash)) as BinaryAssetRecord | undefined;
    if (existing) {
      return existing;
    }

    const record: BinaryAssetRecord = {
      id: createId('ast'),
      mimeType,
      fileName,
      sizeBytes: u8.byteLength,
      sha256: hash,
      dataBase64: uint8ToBase64(u8),
      createdAt: Date.now(),
    };
    await db.put('assets', record);
    return record;
  }

  async putAssetRecord(record: BinaryAssetRecord): Promise<void> {
    const db = await this.getDb();
    await db.put('assets', record);
  }

  async getAsset(assetId: string): Promise<BinaryAssetRecord | undefined> {
    const db = await this.getDb();
    return db.get('assets', assetId);
  }

  async listAssets(): Promise<BinaryAssetRecord[]> {
    const db = await this.getDb();
    return db.getAll('assets');
  }

  // --- Version History ---
  async createVersionSnapshot(
    doc: InkVaultDocument,
    label: string,
    trigger: DocumentVersionSnapshot['trigger'] = 'manual',
    maxSnapshotsPerDoc = 25
  ): Promise<DocumentVersionSnapshot> {
    const db = await this.getDb();
    const snapshot: DocumentVersionSnapshot = {
      id: createId('ver'),
      documentId: doc.id,
      label,
      trigger,
      revision: doc.revision,
      pageCount: doc.pages.length,
      createdAt: Date.now(),
      documentSnapshot: structuredClone(doc),
    };
    await db.put('versions', snapshot);

    const allForDoc = await this.listVersionSnapshots(doc.id);
    if (allForDoc.length > maxSnapshotsPerDoc) {
      const oldest = allForDoc.slice(maxSnapshotsPerDoc);
      const tx = db.transaction('versions', 'readwrite');
      for (const old of oldest) {
        await tx.store.delete(old.id);
      }
      await tx.done;
    }
    return snapshot;
  }

  async listVersionSnapshots(documentId: string): Promise<DocumentVersionSnapshot[]> {
    const db = await this.getDb();
    const list = (await db.getAllFromIndex('versions', 'documentId', documentId)) as DocumentVersionSnapshot[];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  async listAllVersionSnapshots(): Promise<DocumentVersionSnapshot[]> {
    const db = await this.getDb();
    return db.getAll('versions');
  }

  async restoreVersionSnapshot(snapshotId: string): Promise<InkVaultDocument | null> {
    const db = await this.getDb();
    const snap = (await db.get('versions', snapshotId)) as DocumentVersionSnapshot | undefined;
    if (!snap) return null;

    const current = await this.getDocument(snap.documentId);
    if (current && !current.isEncrypted) {
      await this.createVersionSnapshot(
        current,
        `Before restoring "${snap.label}"`,
        'pre-restore'
      );
    }

    const restored: InkVaultDocument = {
      ...structuredClone(snap.documentSnapshot),
      revision: (current?.revision ?? snap.revision) + 1,
      updatedAt: Date.now(),
    };
    await this.saveDocument(restored);
    return restored;
  }

  // --- Study Sets ---
  async listStudySets(): Promise<StudySet[]> {
    const db = await this.getDb();
    const sets = (await db.getAll('studySets')) as StudySet[];
    return sets.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async saveStudySet(studySet: StudySet): Promise<void> {
    const db = await this.getDb();
    await db.put('studySets', studySet);
  }

  async deleteStudySet(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('studySets', id);
  }

  // --- Custom Templates & Stickers ---
  async listCustomTemplates(): Promise<CustomTemplateRecord[]> {
    const db = await this.getDb();
    return db.getAll('customTemplates');
  }

  async saveCustomTemplate(tpl: CustomTemplateRecord): Promise<void> {
    const db = await this.getDb();
    await db.put('customTemplates', tpl);
  }

  async deleteCustomTemplate(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('customTemplates', id);
  }

  async listCustomStickers(): Promise<CustomStickerRecord[]> {
    const db = await this.getDb();
    return db.getAll('customStickers');
  }

  async saveCustomSticker(stk: CustomStickerRecord): Promise<void> {
    const db = await this.getDb();
    await db.put('customStickers', stk);
  }

  async deleteCustomSticker(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('customStickers', id);
  }

  // --- Settings ---
  async loadSettings(): Promise<AppSettings> {
    const db = await this.getDb();
    const row = await db.get('settings', 'app_settings');
    if (!row || !row.value) {
      return structuredClone(DEFAULT_SETTINGS);
    }
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...row.value,
    };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDb();
    await db.put('settings', { key: 'app_settings', value: settings });
  }

  // --- Storage Telemetry & Reset ---
  async getStorageStats(): Promise<{
    documentCount: number;
    trashedCount: number;
    folderCount: number;
    studySetCount: number;
    assetCount: number;
    totalAssetBytes: number;
    versionSnapshotCount: number;
  }> {
    const [docs, folders, sets, assets, versions] = await Promise.all([
      this.listDocuments(),
      this.listFolders(),
      this.listStudySets(),
      this.listAssets(),
      this.listAllVersionSnapshots(),
    ]);
    const totalAssetBytes = assets.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);
    return {
      documentCount: docs.filter((d) => d.trashedAt === null).length,
      trashedCount: docs.filter((d) => d.trashedAt !== null).length,
      folderCount: folders.filter((f) => f.trashedAt === null).length,
      studySetCount: sets.length,
      assetCount: assets.length,
      totalAssetBytes,
      versionSnapshotCount: versions.length,
    };
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDb();
    const stores = [
      'documents',
      'folders',
      'assets',
      'versions',
      'studySets',
      'customTemplates',
      'customStickers',
      'settings',
      'crashRecovery',
    ];
    const tx = db.transaction(stores, 'readwrite');
    for (const s of stores) {
      await tx.objectStore(s).clear();
    }
    await tx.done;
  }
}

function collectDescendantFolderIds(rootId: string, allFolders: InkVaultFolder[]): Set<string> {
  const result = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of allFolders) {
      if (f.parentId && result.has(f.parentId) && !result.has(f.id)) {
        result.add(f.id);
        added = true;
      }
    }
  }
  return result;
}

export const defaultStorage = new InkVaultStorageEngine();
