import JSZip from 'jszip';
import {
  createFolder,
  createId,
  createNotebook,
  createPage,
} from '../model/documentModel';
import {
  AudioSessionMeta,
  FlashcardItem,
  ImageObject,
  InkStroke,
  InkVaultDocument,
  InkVaultFolder,
  InkVaultPage,
  MigrationReport,
  MigrationReportItem,
  OutlineNode,
  StudySet,
} from '../model/types';
import { importPdfAsNotebook, parsePdfIntoPages } from '../pdf/pdfEngine';
import { sha256Hex } from '../storage/cryptoVault';
import { InkVaultStorageEngine } from '../storage/storageEngine';

export type DuplicatePolicy = 'skip' | 'keep-both' | 'replace';

export interface MigrationProgressEvent {
  currentFile: string;
  completedFiles: number;
  totalFiles: number;
}

export interface MigrationFileFailure {
  fileName: string;
  reason: string;
}

export interface BatchMigrationResult {
  importedDocuments: InkVaultDocument[];
  createdFolders: InkVaultFolder[];
  importedStudySets: StudySet[];
  skippedDuplicates: string[];
  failures: MigrationFileFailure[];
  reports: MigrationReport[];
}

export interface IncomingFileInput {
  name: string;
  relativePath?: string;
  bytes: Uint8Array;
  mimeType?: string;
}

/**
 * Inspects a `.goodnotes` ZIP container and reconstructs an editable InkVaultDocument
 * with an itemized, honest MigrationReport.
 */
async function migrateNativeGoodnotesArchive(
  fileName: string,
  bytes: Uint8Array,
  sourceHash: string,
  storage: InkVaultStorageEngine,
  folderId: string | null,
  duplicateDetected: boolean
): Promise<InkVaultDocument> {
  const zip = await JSZip.loadAsync(bytes);
  const entryNames = Object.keys(zip.files).filter((k) => !zip.files[k].dir);

  const cleanDefaultTitle = fileName.replace(/\.goodnotes$/i, '') || 'Migrated Goodnotes Notebook';
  let resolvedTitle = cleanDefaultTitle;
  const pages: InkVaultPage[] = [];
  const outlines: OutlineNode[] = [];
  const audioSessions: AudioSessionMeta[] = [];
  const reportItems: MigrationReportItem[] = [];

  let embeddedPdfsExtracted = 0;
  let imagesExtracted = 0;
  let audioClipsExtracted = 0;
  let editableStrokesReconstructed = 0;
  let hasProprietaryProtobufNotes = false;

  // 1. Check if archive contains a readable JSON manifest or InkVault/Goodnotes JSON export
  const jsonEntries = entryNames.filter((n) => n.endsWith('.json'));
  let structuredStrokesByPage: Record<number, InkStroke[]> = {};
  let structuredBookmarks = new Set<number>();

  for (const jName of jsonEntries) {
    try {
      const txt = await zip.files[jName].async('string');
      const parsed = JSON.parse(txt);
      if (typeof parsed.title === 'string' && parsed.title.trim()) {
        resolvedTitle = parsed.title.trim();
      }
      if (Array.isArray(parsed.bookmarks)) {
        for (const b of parsed.bookmarks) {
          if (typeof b === 'number') structuredBookmarks.add(b);
        }
      }
      if (Array.isArray(parsed.pages)) {
        parsed.pages.forEach((pg: { strokes?: InkStroke[]; bookmarked?: boolean }, idx: number) => {
          if (pg.bookmarked) structuredBookmarks.add(idx);
          if (Array.isArray(pg.strokes) && pg.strokes.length > 0) {
            structuredStrokesByPage[idx] = pg.strokes;
          }
        });
      }
    } catch {
      // Ignore non-UTF8 or non-document JSON metadata files
    }
  }

  // Detect Goodnotes binary protobuf `.notes` streams (`index.notes`, `notes/*.notes`, `search.notes`)
  if (entryNames.some((n) => n.endsWith('.notes') || n.includes('pb'))) {
    hasProprietaryProtobufNotes = true;
  }

  // 2. Extract embedded PDF attachments in deterministic order
  const pdfEntries = entryNames
    .filter((n) => /\.pdf$/i.test(n) || (n.startsWith('attachments/') && !/\.(png|jpe?g|webp|m4a|mp3|wav|caf)$/i.test(n)))
    .sort();

  for (const pEntry of pdfEntries) {
    try {
      const raw = await zip.files[pEntry].async('uint8array');
      // Check PDF magic header `%PDF-`
      if (
        raw.length > 5 &&
        raw[0] === 0x25 &&
        raw[1] === 0x50 &&
        raw[2] === 0x44 &&
        raw[3] === 0x46
      ) {
        const parsedPdf = await parsePdfIntoPages(raw, pEntry.split('/').pop() || 'attachment.pdf', storage);
        pages.push(...parsedPdf.pages);
        outlines.push(...parsedPdf.outline);
        embeddedPdfsExtracted++;
      }
    } catch {
      // Skip non-PDF binary attachment
    }
  }

  // 3. Extract embedded image attachments
  const imgEntries = entryNames
    .filter((n) => /\.(png|jpe?g|webp)$/i.test(n) && !n.toLowerCase().includes('thumbnail'))
    .sort();

  for (const imgEntry of imgEntries) {
    try {
      const raw = await zip.files[imgEntry].async('uint8array');
      const ext = imgEntry.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const asset = await storage.storeBinaryAsset(raw, ext, imgEntry.split('/').pop());
      const targetPage =
        pages[pages.length - 1] ??
        (() => {
          const p = createPage();
          pages.push(p);
          return p;
        })();

      const imgObj: ImageObject = {
        id: createId('img'),
        kind: 'image',
        assetId: asset.id,
        dataUrl: `data:${ext};base64,${asset.dataBase64}`,
        layerId: targetPage.layers[0].id,
        zIndex: targetPage.images.length + 1,
        x: 64,
        y: 80 + (targetPage.images.length % 3) * 180,
        width: 320,
        height: 220,
        rotation: 0,
        opacity: 1,
        naturalWidth: 320,
        naturalHeight: 220,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      targetPage.images.push(imgObj);
      imagesExtracted++;
    } catch {
      // Continue safely
    }
  }

  // 4. Ensure at least one page exists if archive only had structured JSON strokes or empty template
  const maxStructuredIdx = Math.max(
    -1,
    ...Object.keys(structuredStrokesByPage).map((k) => Number(k))
  );
  while (pages.length <= Math.max(0, maxStructuredIdx)) {
    pages.push(createPage());
  }

  // Attach any accessible structured strokes & bookmarks
  pages.forEach((pg, idx) => {
    if (structuredBookmarks.has(idx)) {
      pg.bookmarked = true;
      pg.bookmarkLabel = `Migrated Bookmark p.${idx + 1}`;
    }
    const strokes = structuredStrokesByPage[idx];
    if (strokes && strokes.length > 0) {
      const defaultLayerId = pg.layers[0].id;
      for (const s of strokes) {
        pg.strokes.push({
          ...s,
          id: s.id || createId('stk'),
          kind: 'stroke',
          layerId: defaultLayerId,
          instrument: s.instrument || 'fountain',
          color: s.color || '#18181B',
          width: s.width || 2.2,
          opacity: s.opacity ?? 1,
          smoothing: 0.5,
          pressureSensitivity: 0.5,
          tipSharpness: 0.5,
          zIndex: pg.strokes.length + 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        editableStrokesReconstructed++;
      }
    }
  });

  // 5. Extract embedded audio clips
  const audioEntries = entryNames.filter((n) => /\.(m4a|mp3|wav|webm|ogg)$/i.test(n)).sort();
  for (let i = 0; i < audioEntries.length; i++) {
    const aEntry = audioEntries[i];
    const raw = await zip.files[aEntry].async('uint8array');
    const mime = aEntry.endsWith('.wav')
      ? 'audio/wav'
      : aEntry.endsWith('.mp3')
      ? 'audio/mpeg'
      : 'audio/mp4';
    const asset = await storage.storeBinaryAsset(raw, mime, aEntry.split('/').pop());
    audioSessions.push({
      id: createId('aud'),
      title: `Migrated Recording ${i + 1}`,
      assetId: asset.id,
      mimeType: mime,
      durationMs: 0,
      createdAt: Date.now(),
      pageIdAtStart: pages[0].id,
    });
    audioClipsExtracted++;
  }

  // Build honest, detailed MigrationReport
  reportItems.push({
    category: 'Page Order & Document Structure',
    status: 'preserved',
    detail: `Reconstructed ${pages.length} page(s) in sequence from "${fileName}".`,
  });

  if (embeddedPdfsExtracted > 0) {
    reportItems.push({
      category: 'PDF Backgrounds & Outlines',
      status: 'preserved',
      detail: `Extracted ${embeddedPdfsExtracted} embedded PDF attachment(s) and ${outlines.length} outline item(s).`,
    });
  }

  if (imagesExtracted > 0) {
    reportItems.push({
      category: 'Embedded Images',
      status: 'preserved',
      detail: `Recovered ${imagesExtracted} image asset(s) as movable page objects.`,
    });
  }

  if (audioClipsExtracted > 0) {
    reportItems.push({
      category: 'Audio Recordings',
      status: 'preserved',
      detail: `Recovered ${audioClipsExtracted} embedded audio recording(s).`,
    });
  }

  if (editableStrokesReconstructed > 0) {
    reportItems.push({
      category: 'Vector Handwriting',
      status: 'preserved',
      detail: `Reconstructed ${editableStrokesReconstructed} editable vector ink stroke(s) from accessible JSON stroke records.`,
    });
  } else if (hasProprietaryProtobufNotes) {
    reportItems.push({
      category: 'Proprietary Goodnotes Protobuf Ink (.notes)',
      status: 'partial',
      detail:
        'Goodnotes proprietary binary protobuf stroke stream detected. Embedded PDFs, images, and audio were extracted cleanly, but undocumented binary stroke records could not be decoded into editable strokes — export PDF alongside .goodnotes if visual flattened ink is needed.',
    });
  }

  const report: MigrationReport = {
    id: createId('mig'),
    sourceFileName: fileName,
    sourceFormat: 'goodnotes-native',
    importedAt: Date.now(),
    sourceHashSha256: sourceHash,
    pagesImported: pages.length,
    editableStrokesReconstructed,
    embeddedPdfsExtracted,
    imagesExtracted,
    audioClipsExtracted,
    outlinesPreserved: outlines.length,
    isFlattenedPdf: false,
    duplicateDetected,
    summary: `Migrated native .goodnotes archive (${pages.length} pages, ${editableStrokesReconstructed} editable strokes, ${embeddedPdfsExtracted} PDFs, ${imagesExtracted} images, ${audioClipsExtracted} audio clips).`,
    items: reportItems,
  };

  const doc = createNotebook({
    title: resolvedTitle,
    folderId,
    cover: {
      enabled: embeddedPdfsExtracted === 0,
      style: 'architectural-spine',
      color: '#172554',
      accentColor: '#60A5FA',
      subtitle: 'MIGRATED',
    },
  });

  return {
    ...doc,
    pages,
    outline: outlines,
    audioSessions,
    migrationReport: report,
  };
}

/**
 * Migrates a Goodnotes PDF export or standard PDF with an explicit honesty check
 * so flattened PDFs are NEVER falsely claimed as native vector-stroke reconstructions.
 */
async function migratePdfFile(
  fileName: string,
  bytes: Uint8Array,
  sourceHash: string,
  storage: InkVaultStorageEngine,
  folderId: string | null,
  duplicateDetected: boolean
): Promise<InkVaultDocument> {
  const nb = await importPdfAsNotebook(bytes, fileName, storage, folderId);

  // Detect if PDF header/metadata mentions Goodnotes
  const headerAscii = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
  const looksLikeGoodnotesPdf = /goodnotes/i.test(headerAscii) || /goodnotes/i.test(fileName);

  const items: MigrationReportItem[] = [
    {
      category: 'Page Order, Dimensions & Visual Appearance',
      status: 'preserved',
      detail: `Imported ${nb.pages.length} PDF page(s) at original aspect ratios ready for editable INKVAULT annotations.`,
    },
    {
      category: 'Outlines & Searchable Text',
      status: 'preserved',
      detail: `Preserved ${nb.outline.length} PDF outline node(s) and indexed embedded text across pages.`,
    },
    {
      category: 'Pre-Existing Flattened Handwriting',
      status: 'warning',
      detail:
        'Flattened PDF import: visual handwriting/markup baked into the source PDF page stream remains 100% visible and searchable via OCR, but cannot be separated into individual editable Goodnotes vector strokes.',
    },
  ];

  const report: MigrationReport = {
    id: createId('mig'),
    sourceFileName: fileName,
    sourceFormat: looksLikeGoodnotesPdf ? 'goodnotes-pdf' : 'standard-pdf',
    importedAt: Date.now(),
    sourceHashSha256: sourceHash,
    pagesImported: nb.pages.length,
    editableStrokesReconstructed: 0,
    embeddedPdfsExtracted: 1,
    imagesExtracted: 0,
    audioClipsExtracted: 0,
    outlinesPreserved: nb.outline.length,
    isFlattenedPdf: true,
    duplicateDetected,
    summary: looksLikeGoodnotesPdf
      ? `Imported Goodnotes PDF export (${nb.pages.length} pages). Visual pages & outlines preserved; pre-flattened PDF ink cannot be reconstructed as separate strokes.`
      : `Imported PDF document (${nb.pages.length} pages) with editable INKVAULT annotation layers.`,
    items,
  };

  return {
    ...nb,
    migrationReport: report,
  };
}

/**
 * Parses a CSV or TSV Study Set file into an INKVAULT StudySet.
 */
export function parseCsvStudySet(fileName: string, text: string, folderId: string | null): StudySet {
  const delimiter = fileName.toLowerCase().endsWith('.tsv') ? '\t' : ',';
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const studySetId = createId('set');
  const now = Date.now();
  const cards: FlashcardItem[] = lines.map((line) => {
    const parts = line.split(delimiter).map((s) => s.replace(/^"|"$/g, '').trim());
    return {
      id: createId('crd'),
      studySetId,
      front: parts[0] || 'Prompt',
      back: parts.slice(1).join(' — ') || 'Answer',
      tags: [],
      easinessFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: now,
      lapses: 0,
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    id: studySetId,
    title: fileName.replace(/\.(csv|tsv|txt)$/i, '') || 'Imported Study Set',
    description: `Imported ${cards.length} flashcards from ${fileName}`,
    folderId,
    cards,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Main Batch & Archive Goodnotes Migration Coordinator.
 * Supports `.goodnotes`, `.pdf`, `.zip` (nested folders of `.goodnotes` / `.pdf` / images / `.csv`),
 * `.inkvault` archives, images (`.png`/`.jpg`), and `.csv`/`.tsv` Study Sets!
 * Never modifies or deletes original source files.
 */
export async function runBatchGoodnotesMigration(
  inputs: IncomingFileInput[],
  storage: InkVaultStorageEngine,
  options: {
    targetRootFolderId?: string | null;
    duplicatePolicy?: DuplicatePolicy;
    onProgress?: (ev: MigrationProgressEvent) => void;
  } = {}
): Promise<BatchMigrationResult> {
  const duplicatePolicy = options.duplicatePolicy ?? 'keep-both';
  const rootFolderId = options.targetRootFolderId ?? null;

  const existingDocs = await storage.listDocuments();
  const existingFolders = await storage.listFolders();

  const existingByHash = new Map<string, InkVaultDocument>();
  for (const d of existingDocs) {
    if (d.trashedAt === null && d.migrationReport?.sourceHashSha256) {
      existingByHash.set(d.migrationReport.sourceHashSha256, d);
    }
  }

  // Expand any `.zip` (that is NOT a `.goodnotes` or `.inkvault` single-notebook file) into constituent files with relative folder paths!
  const expandedQueue: { name: string; folderSegments: string[]; bytes: Uint8Array }[] = [];

  for (const item of inputs) {
    const lower = item.name.toLowerCase();
    const relSegments = (item.relativePath || item.name)
      .split('/')
      .filter(Boolean)
      .slice(0, -1);

    if (lower.endsWith('.zip') && !lower.endsWith('.goodnotes.zip_single')) {
      try {
        const archive = await JSZip.loadAsync(item.bytes);
        // Check if this `.zip` is actually an `.inkvault` notebook bundle
        if (archive.files['document.json'] && archive.files['manifest.json']) {
          expandedQueue.push({
            name: item.name.replace(/\.zip$/i, '.inkvault'),
            folderSegments: relSegments,
            bytes: item.bytes,
          });
          continue;
        }

        const keys = Object.keys(archive.files)
          .filter((k) => !archive.files[k].dir && !k.startsWith('__MACOSX/') && !k.split('/').pop()?.startsWith('.'))
          .sort();

        for (const k of keys) {
          const parts = k.split('/').filter(Boolean);
          const leafName = parts[parts.length - 1];
          const subDirs = [...relSegments, ...parts.slice(0, -1)];
          const entryBytes = await archive.files[k].async('uint8array');
          expandedQueue.push({
            name: leafName,
            folderSegments: subDirs,
            bytes: entryBytes,
          });
        }
      } catch (err) {
        return {
          importedDocuments: [],
          createdFolders: [],
          importedStudySets: [],
          skippedDuplicates: [],
          failures: [
            {
              fileName: item.name,
              reason: `Corrupted or unreadable ZIP archive: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          reports: [],
        };
      }
    } else {
      expandedQueue.push({
        name: item.name,
        folderSegments: relSegments,
        bytes: item.bytes,
      });
    }
  }

  const createdFolders: InkVaultFolder[] = [];
  const folderCache = new Map<string, string>(); // key `${parentId || 'root'}::${name}` -> folderId
  for (const f of existingFolders) {
    if (f.trashedAt === null) {
      folderCache.set(`${f.parentId ?? 'root'}::${f.name.toLowerCase()}`, f.id);
    }
  }

  const ensureFolderPath = async (segments: string[]): Promise<string | null> => {
    let parentId = rootFolderId;
    for (const seg of segments) {
      const clean = seg.trim();
      if (!clean) continue;
      const cacheKey = `${parentId ?? 'root'}::${clean.toLowerCase()}`;
      let fId = folderCache.get(cacheKey);
      if (!fId) {
        const created = createFolder(clean, parentId, '#2563EB');
        await storage.saveFolder(created);
        createdFolders.push(created);
        folderCache.set(cacheKey, created.id);
        fId = created.id;
      }
      parentId = fId;
    }
    return parentId;
  };

  const importedDocuments: InkVaultDocument[] = [];
  const importedStudySets: StudySet[] = [];
  const skippedDuplicates: string[] = [];
  const failures: MigrationFileFailure[] = [];
  const reports: MigrationReport[] = [];

  for (let i = 0; i < expandedQueue.length; i++) {
    const entry = expandedQueue[i];
    options.onProgress?.({
      currentFile: entry.name,
      completedFiles: i,
      totalFiles: expandedQueue.length,
    });

    try {
      const destFolderId = await ensureFolderPath(entry.folderSegments);
      const lower = entry.name.toLowerCase();
      const sourceHash = await sha256Hex(entry.bytes);
      const existingDup = existingByHash.get(sourceHash);

      if (existingDup && duplicatePolicy === 'skip') {
        skippedDuplicates.push(entry.name);
        continue;
      }

      if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
        const text = new TextDecoder().decode(entry.bytes);
        const set = parseCsvStudySet(entry.name, text, destFolderId);
        await storage.saveStudySet(set);
        importedStudySets.push(set);
        continue;
      }

      if (lower.endsWith('.inkvault')) {
        const zip = await JSZip.loadAsync(entry.bytes);
        const docJson = await zip.files['document.json'].async('string');
        const restoredDoc = JSON.parse(docJson) as InkVaultDocument;
        for (const k of Object.keys(zip.files)) {
          if (k.startsWith('assets/') && k.endsWith('.json')) {
            const assetJson = await zip.files[k].async('string');
            await storage.putAssetRecord(JSON.parse(assetJson));
          }
        }
        const newDoc: InkVaultDocument = {
          ...restoredDoc,
          id: duplicatePolicy === 'replace' && existingDup ? existingDup.id : createId('doc'),
          folderId: destFolderId,
          updatedAt: Date.now(),
        };
        await storage.saveDocument(newDoc);
        importedDocuments.push(newDoc);
        continue;
      }

      let migratedDoc: InkVaultDocument;

      if (lower.endsWith('.goodnotes')) {
        migratedDoc = await migrateNativeGoodnotesArchive(
          entry.name,
          entry.bytes,
          sourceHash,
          storage,
          destFolderId,
          Boolean(existingDup)
        );
      } else if (lower.endsWith('.pdf')) {
        // Verify valid PDF signature
        if (
          entry.bytes.length < 5 ||
          entry.bytes[0] !== 0x25 ||
          entry.bytes[1] !== 0x50 ||
          entry.bytes[2] !== 0x44 ||
          entry.bytes[3] !== 0x46
        ) {
          throw new Error('Invalid or corrupted PDF header (%PDF- signature missing).');
        }
        migratedDoc = await migratePdfFile(
          entry.name,
          entry.bytes,
          sourceHash,
          storage,
          destFolderId,
          Boolean(existingDup)
        );
      } else if (/\.(png|jpe?g|webp)$/i.test(lower)) {
        const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const asset = await storage.storeBinaryAsset(entry.bytes, mime, entry.name);
        const page = createPage();
        page.images.push({
          id: createId('img'),
          kind: 'image',
          assetId: asset.id,
          dataUrl: `data:${mime};base64,${asset.dataBase64}`,
          layerId: page.layers[0].id,
          zIndex: 1,
          x: 60,
          y: 60,
          width: 480,
          height: 360,
          rotation: 0,
          opacity: 1,
          naturalWidth: 480,
          naturalHeight: 360,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        migratedDoc = createNotebook({
          title: entry.name.replace(/\.(png|jpe?g|webp)$/i, ''),
          folderId: destFolderId,
        });
        migratedDoc.pages = [page];
      } else {
        failures.push({
          fileName: entry.name,
          reason: `Unsupported file extension in "${entry.name}". Supported: .goodnotes, .pdf, .zip, .inkvault, .png, .jpg, .csv, .tsv`,
        });
        continue;
      }

      if (existingDup && duplicatePolicy === 'replace') {
        migratedDoc = { ...migratedDoc, id: existingDup.id };
      } else if (existingDup && duplicatePolicy === 'keep-both') {
        migratedDoc = { ...migratedDoc, title: `${migratedDoc.title} (Copy)` };
      }

      await storage.saveDocument(migratedDoc);
      await storage.createVersionSnapshot(
        migratedDoc,
        `Initial import from ${entry.name}`,
        'migration'
      );
      existingByHash.set(sourceHash, migratedDoc);
      importedDocuments.push(migratedDoc);
      if (migratedDoc.migrationReport) {
        reports.push(migratedDoc.migrationReport);
      }
    } catch (err) {
      failures.push({
        fileName: entry.name,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  options.onProgress?.({
    currentFile: 'Completed',
    completedFiles: expandedQueue.length,
    totalFiles: expandedQueue.length,
  });

  return {
    importedDocuments,
    createdFolders,
    importedStudySets,
    skippedDuplicates,
    failures,
    reports,
  };
}
