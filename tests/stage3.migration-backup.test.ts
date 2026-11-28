import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import { runBatchGoodnotesMigration } from '../src/core/migration/goodnotesMigration';
import { createFolder, createId, createNotebook } from '../src/core/model/documentModel';
import {
  exportFullLibraryBackupZip,
  exportSingleNotebookArchive,
  reconcileSyncBundle,
  resolveSyncConflict,
  restoreFullLibraryBackupZip,
} from '../src/core/storage/backupAndSync';
import { InkVaultStorageEngine } from '../src/core/storage/storageEngine';

async function makePdf(label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setCreator('Goodnotes 6');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p = doc.addPage([600, 800]);
  p.drawText(label, { x: 40, y: 720, size: 16, font });
  return doc.save();
}

describe('Stage 3 — Goodnotes Migration, Archive Export, Full Backup/Restore, Version History & Sync', () => {
  let storage: InkVaultStorageEngine;

  beforeEach(async () => {
    storage = new InkVaultStorageEngine();
    await storage.clearAllData();
  });

  it('migrates native .goodnotes archives and Goodnotes PDFs with honest fidelity reports', async () => {
    // 1. Construct a realistic .goodnotes container with an embedded PDF attachment + protobuf .notes stream
    const gnZip = new JSZip();
    const pdfBytes = await makePdf('Lecture Slide 1');
    gnZip.file('attachments/slide-deck.pdf', pdfBytes);
    gnZip.file('index.notes', new Uint8Array([0x08, 0x01, 0x12, 0x04]));
    gnZip.file('audio/lecture.m4a', new Uint8Array([0x00, 0x00, 0x00, 0x18]));
    const gnBytes = await gnZip.generateAsync({ type: 'uint8array' });

    // 2. Also pass a flattened Goodnotes PDF export
    const flattenedPdf = await makePdf('Goodnotes Flattened Handout');

    const result = await runBatchGoodnotesMigration(
      [
        { name: 'Physics_Week1.goodnotes', bytes: gnBytes },
        { name: 'Goodnotes_Handout.pdf', bytes: flattenedPdf },
      ],
      storage
    );

    expect(result.failures).toHaveLength(0);
    expect(result.importedDocuments).toHaveLength(2);

    const nativeDoc = result.importedDocuments.find((d) =>
      d.migrationReport?.sourceFormat === 'goodnotes-native'
    )!;
    expect(nativeDoc.pages.length).toBeGreaterThanOrEqual(1);
    expect(nativeDoc.audioSessions).toHaveLength(1);
    expect(
      nativeDoc.migrationReport?.items.some((i) => i.status === 'partial')
    ).toBe(true);

    const pdfDoc = result.importedDocuments.find(
      (d) => d.migrationReport?.sourceFormat === 'goodnotes-pdf'
    )!;
    // Must NEVER falsely claim native vector stroke migration from a flattened PDF!
    expect(pdfDoc.migrationReport?.isFlattenedPdf).toBe(true);
    expect(pdfDoc.migrationReport?.editableStrokesReconstructed).toBe(0);
    expect(
      pdfDoc.migrationReport?.items.some(
        (i) => i.status === 'warning' && i.detail.toLowerCase().includes('flattened')
      )
    ).toBe(true);
  });

  it('batch-imports nested .zip archives, recreates folders, detects SHA-256 duplicates, and reports bad files cleanly', async () => {
    const batchZip = new JSZip();
    const validPdf = await makePdf('Organic Chem');
    batchZip.file('Year 2/Chemistry/OrgChem.pdf', validPdf);
    batchZip.file('Year 2/Chemistry/Flashcards.csv', 'Alkene,Carbon-carbon double bond\nAlkyne,Triple bond');
    batchZip.file('Year 2/Corrupted.pdf', new TextEncoder().encode('NOT_A_VALID_PDF'));
    const zipBytes = await batchZip.generateAsync({ type: 'uint8array' });

    const res1 = await runBatchGoodnotesMigration(
      [{ name: 'Goodnotes_Backup.zip', bytes: zipBytes }],
      storage,
      { duplicatePolicy: 'skip' }
    );

    expect(res1.createdFolders.map((f) => f.name)).toEqual(['Year 2', 'Chemistry']);
    expect(res1.importedDocuments).toHaveLength(1);
    expect(res1.importedStudySets).toHaveLength(1);
    expect(res1.importedStudySets[0].cards).toHaveLength(2);
    expect(res1.failures).toHaveLength(1);
    expect(res1.failures[0].fileName).toBe('Corrupted.pdf');

    // Re-importing the exact same PDF with policy 'skip' detects the SHA-256 duplicate!
    const res2 = await runBatchGoodnotesMigration(
      [{ name: 'OrgChem.pdf', bytes: validPdf }],
      storage,
      { duplicatePolicy: 'skip' }
    );
    expect(res2.importedDocuments).toHaveLength(0);
    expect(res2.skippedDuplicates).toEqual(['OrgChem.pdf']);
  });

  it('backs up the entire library to .inkvault-backup.zip, wipes local storage, and restores 100% of folders, notebooks, assets & versions', async () => {
    const folder = createFolder('Architecture');
    await storage.saveFolder(folder);
    const asset = await storage.storeBinaryAsset(new Uint8Array([1, 2, 3, 4, 5]), 'image/png', 'sketch.png');

    const doc = createNotebook({ title: 'Structural Loads', folderId: folder.id });
    doc.pages[0].images.push({
      id: createId('img'),
      kind: 'image',
      assetId: asset.id,
      layerId: doc.pages[0].layers[0].id,
      zIndex: 1,
      x: 20,
      y: 20,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      naturalWidth: 100,
      naturalHeight: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await storage.saveDocument(doc);
    const v1 = await storage.createVersionSnapshot(doc, 'Initial Load Calc', 'manual');

    // Also verify single notebook .inkvault archive export
    const singleArchiveBytes = await exportSingleNotebookArchive(doc, storage);
    expect(singleArchiveBytes.byteLength).toBeGreaterThan(100);

    // Export full backup
    const { bytes: backupBytes, manifest } = await exportFullLibraryBackupZip(storage);
    expect(manifest.documentCount).toBe(1);
    expect(manifest.folderCount).toBe(1);
    expect(manifest.assetCount).toBe(1);

    // Wipe database completely
    await storage.clearAllData();
    expect(await storage.listDocuments()).toHaveLength(0);

    // Restore complete library
    await restoreFullLibraryBackupZip(backupBytes, storage, 'replace');
    const restoredDocs = await storage.listDocuments();
    expect(restoredDocs).toHaveLength(1);
    expect(restoredDocs[0].title).toBe('Structural Loads');
    expect((await storage.getAsset(asset.id))?.sizeBytes).toBe(5);

    // Test Version History restore (creating automatic pre-restore checkpoint)
    const modified = { ...restoredDocs[0], title: 'Edited Title', revision: 5 };
    await storage.saveDocument(modified);
    const snaps = await storage.listVersionSnapshots(doc.id);
    const restoredSnap = await storage.restoreVersionSnapshot(snaps[0].id);
    expect(restoredSnap?.title).toBe('Structural Loads');
    void v1;
  });

  it('detects divergent cross-device sync conflicts and resolves them cleanly', async () => {
    const baseDoc = createNotebook({ title: 'Shared Research' });
    const localVersion = {
      ...baseDoc,
      deviceId: 'ipad_local',
      revision: 3,
      updatedAt: 2000,
    };
    await storage.saveDocument(localVersion);

    const remoteVersion = {
      ...structuredClone(baseDoc),
      title: 'Shared Research (Mac Edits)',
      deviceId: 'macbook_remote',
      revision: 4,
      updatedAt: 2500,
    };

    const syncResult = await reconcileSyncBundle(
      {
        format: 'inkvault-sync-bundle',
        exportedAt: 3000,
        documents: [remoteVersion],
        folders: [],
        studySets: [],
      },
      storage,
      1000
    );

    expect(syncResult.conflicts).toHaveLength(1);

    // Resolve with keep-both so zero work is lost
    await resolveSyncConflict(syncResult.conflicts[0], 'keep-both', storage);
    const allDocs = await storage.listDocuments();
    expect(allDocs).toHaveLength(2);
  });
});
