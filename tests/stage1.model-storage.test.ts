import { beforeEach, describe, expect, it } from 'vitest';
import {
  createFolder,
  createId,
  createNotebook,
  createPage,
  deletePagesFromDocument,
  duplicatePageInDocument,
  insertPageInDocument,
  moveObjectsBetweenPages,
  reorderPageInDocument,
  rotatePageInDocument,
  togglePageBookmark,
  updatePageInDocument,
} from '../src/core/model/documentModel';
import { DocumentHistoryManager } from '../src/core/model/historyManager';
import { decryptDocumentContent, encryptDocumentContent } from '../src/core/storage/cryptoVault';
import { InkVaultStorageEngine } from '../src/core/storage/storageEngine';

describe('Stage 1 — Portable Document Model, History & Local-First Storage', () => {
  let storage: InkVaultStorageEngine;

  beforeEach(async () => {
    storage = new InkVaultStorageEngine();
    await storage.clearAllData();
  });

  it('creates notebooks with multiple page dimensions, backgrounds, and persistent object identities', () => {
    const nb = createNotebook({
      title: 'Differential Equations',
      sizeId: 'a4',
      orientation: 'portrait',
      templateId: 'cornell',
      paperColor: 'cream',
      initialPageCount: 2,
    });

    expect(nb.pages).toHaveLength(2);
    expect(nb.pages[0].width).toBe(794);
    expect(nb.pages[0].height).toBe(1123);
    expect(nb.pages[0].background.templateId).toBe('cornell');
    expect(nb.pages[0].background.paperColor).toBe('cream');
    expect(nb.pages[0].id).not.toBe(nb.pages[1].id);

    // Insert a wide landscape presentation page in the same notebook
    const slidePage = createPage({
      sizeId: 'wide-slide',
      orientation: 'landscape',
      templateId: 'grid',
      paperColor: 'slate-dark',
    });
    const mixedNb = insertPageInDocument(nb, slidePage, 1);
    expect(mixedNb.pages).toHaveLength(3);
    expect(mixedNb.pages[1].width).toBe(1280);
    expect(mixedNb.pages[1].height).toBe(720);
    expect(mixedNb.pages[1].background.paperColor).toBe('slate-dark');
  });

  it('supports page reordering, duplication, rotation, bookmarking, and safe deletion', () => {
    let nb = createNotebook({ title: 'Page Ops', initialPageCount: 3 });
    const [p0, p1, p2] = nb.pages.map((p) => p.id);

    nb = reorderPageInDocument(nb, 0, 2);
    expect(nb.pages.map((p) => p.id)).toEqual([p1, p2, p0]);

    nb = rotatePageInDocument(nb, p1, 90);
    expect(nb.pages[0].rotation).toBe(90);

    nb = togglePageBookmark(nb, p2, 'Midterm Theorem');
    expect(nb.pages[1].bookmarked).toBe(true);
    expect(nb.pages[1].bookmarkLabel).toBe('Midterm Theorem');

    nb = duplicatePageInDocument(nb, 1);
    expect(nb.pages).toHaveLength(4);
    expect(nb.pages[2].id).not.toBe(nb.pages[1].id);

    // Deleting all pages safely retains 1 clean sheet so a notebook is never corrupted
    const allIds = nb.pages.map((p) => p.id);
    nb = deletePagesFromDocument(nb, allIds);
    expect(nb.pages).toHaveLength(1);
  });

  it('maintains deterministic Undo and Redo history across edits', () => {
    const history = new DocumentHistoryManager(50);
    const initial = createNotebook({ title: 'History Test' });
    history.initDocument(initial);

    const strokeId = createId('stk');
    const step1 = updatePageInDocument(initial, initial.pages[0].id, (p) => ({
      ...p,
      strokes: [
        ...p.strokes,
        {
          id: strokeId,
          kind: 'stroke',
          layerId: p.layers[0].id,
          zIndex: 1,
          instrument: 'fountain',
          color: '#18181B',
          width: 2.5,
          opacity: 1,
          smoothing: 0.5,
          pressureSensitivity: 0.6,
          tipSharpness: 0.5,
          points: [
            { x: 10, y: 10, p: 0.5, t: 0 },
            { x: 90, y: 40, p: 0.7, t: 16 },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    }));
    history.commit(step1);

    expect(history.canUndo(initial.id)).toBe(true);
    const undone = history.undo(initial.id)!;
    expect(undone.pages[0].strokes).toHaveLength(0);

    expect(history.canRedo(initial.id)).toBe(true);
    const redone = history.redo(initial.id)!;
    expect(redone.pages[0].strokes).toHaveLength(1);
    expect(redone.pages[0].strokes[0].id).toBe(strokeId);
  });

  it('moves objects between pages while preserving persistent object IDs', () => {
    let nb = createNotebook({ title: 'Cross Page Move', initialPageCount: 2 });
    const strokeId = createId('stk');
    nb = updatePageInDocument(nb, nb.pages[0].id, (p) => ({
      ...p,
      strokes: [
        {
          id: strokeId,
          kind: 'stroke',
          layerId: p.layers[0].id,
          zIndex: 1,
          instrument: 'ballpoint',
          color: '#1D4ED8',
          width: 2,
          opacity: 1,
          smoothing: 0.4,
          pressureSensitivity: 0.3,
          tipSharpness: 0.2,
          points: [
            { x: 20, y: 20, p: 0.5, t: 0 },
            { x: 50, y: 50, p: 0.6, t: 12 },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    }));

    nb = moveObjectsBetweenPages(nb, nb.pages[0].id, nb.pages[1].id, [strokeId]);
    expect(nb.pages[0].strokes).toHaveLength(0);
    expect(nb.pages[1].strokes).toHaveLength(1);
    expect(nb.pages[1].strokes[0].id).toBe(strokeId);
  });

  it('persists folders, notebooks, trash recovery, crash recovery, and AES-256-GCM encryption locally', async () => {
    const parentFolder = createFolder('Engineering');
    const subFolder = createFolder('Thermodynamics', parentFolder.id);
    await storage.saveFolder(parentFolder);
    await storage.saveFolder(subFolder);

    const doc = createNotebook({ title: 'Entropy Notes', folderId: subFolder.id });
    await storage.saveDocument(doc);

    const loaded = await storage.getDocument(doc.id);
    expect(loaded?.title).toBe('Entropy Notes');

    // Trash & Restore folder cascade
    await storage.moveFolderToTrash(parentFolder.id);
    expect((await storage.getDocument(doc.id))?.trashedAt).not.toBeNull();

    await storage.restoreFolderFromTrash(parentFolder.id);
    expect((await storage.getDocument(doc.id))?.trashedAt).toBeNull();

    // Real AES-256-GCM encryption & decryption
    const encrypted = await encryptDocumentContent(doc, 'vault-secret-2026', 'year');
    expect(encrypted.isEncrypted).toBe(true);
    expect(encrypted.pages).toHaveLength(0);
    expect(encrypted.encryptionEnvelope?.ciphertextBase64.length).toBeGreaterThan(20);

    await expect(decryptDocumentContent(encrypted, 'wrong-passphrase')).rejects.toThrow();
    const decrypted = await decryptDocumentContent(encrypted, 'vault-secret-2026');
    expect(decrypted.isEncrypted).toBe(false);
    expect(decrypted.pages).toHaveLength(1);
  });
});
