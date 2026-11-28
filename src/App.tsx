import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createFolder,
  createId,
  createNotebook,
  duplicateNotebook,
  getNextZIndex,
  updatePageInDocument,
} from './core/model/documentModel';
import { DocumentHistoryManager } from './core/model/historyManager';
import { DEFAULT_SETTINGS } from './core/model/templates';
import {
  AppSettings,
  CustomStickerRecord,
  CustomTemplateRecord,
  EditablePageObject,
  InkStroke,
  InkVaultDocument,
  InkVaultFolder,
  InkVaultPage,
  MigrationReport,
  PaperColorId,
  StudySet,
  TemplateId,
} from './core/model/types';
import {
  AsyncOcrQueue,
  searchAcrossLibrary,
  SearchMatchSource,
} from './core/ocr/ocrAndSearchEngine';
import {
  getRenderedPdfPageCanvas,
  mergePdfIntoDocument,
  splitDocumentByPages,
} from './core/pdf/pdfEngine';
import {
  requestDurableLocalStorage,
  resolveEffectiveTheme,
} from './core/platform/platformAdapter';
import {
  mirrorDocumentToNativeVault,
  registerIOSLifecyclePersistenceGuards,
} from './core/ios/iosFileAndLifecycleBridge';
import { subscribeToNativeIOSEvents } from './core/ios/pencilKitBridge';
import { runBatchGoodnotesMigration } from './core/migration/goodnotesMigration';
import {
  base64ToUint8,
  decryptDocumentContent,
  encryptDocumentContent,
} from './core/storage/cryptoVault';
import {
  defaultStorage,
  InkVaultStorageEngine,
} from './core/storage/storageEngine';
import {
  createStudySetFromExtractedHighlights,
  extractHighlightsAndAnnotationsFromDocument,
} from './core/study/studyEngine';
import { CreateNotebookModal } from './ui/library/CreateNotebookModal';
import { LibraryView, SearchHitItem } from './ui/library/LibraryView';
import { BackupAndSyncModal } from './ui/modals/BackupAndSyncModal';
import { ExportModal } from './ui/modals/ExportModal';
import { MigrationModal } from './ui/modals/MigrationModal';
import { SettingsModal } from './ui/modals/SettingsModal';
import { TemplateGalleryModal } from './ui/modals/TemplateGalleryModal';
import { VersionHistoryModal } from './ui/modals/VersionHistoryModal';
import { StudySetModal } from './ui/study/StudySetModal';
import { AudioNotesBar } from './ui/workspace/AudioNotesBar';
import { NotebookWorkspace } from './ui/workspace/NotebookWorkspace';

interface AppProps {
  storage?: InkVaultStorageEngine;
}

export const App: React.FC<AppProps> = ({ storage = defaultStorage }) => {
  const [hydrated, setHydrated] = useState(false);
  const [documents, setDocuments] = useState<InkVaultDocument[]>([]);
  const [folders, setFolders] = useState<InkVaultFolder[]>([]);
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplateRecord[]>([]);
  const [customStickers, setCustomStickers] = useState<CustomStickerRecord[]>([]);
  const [customCoverUrls, setCustomCoverUrls] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [viewMode, setViewMode] = useState<'library' | 'workspace'>('library');
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [saveStatusLabel, setSaveStatusLabel] = useState('Saved locally');

  // Search & OCR state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [ocrBusyCount, setOcrBusyCount] = useState(0);

  // Audio notes state
  const [audioDrawerOpen, setAudioDrawerOpen] = useState(false);
  const [recordingCtx, setRecordingCtx] = useState<{
    sessionId: string | null;
    getOffsetMs: () => number;
  }>({ sessionId: null, getOffsetMs: () => 0 });
  const [playbackSync, setPlaybackSync] = useState<{
    sessionId: string | null;
    offsetMs: number | null;
  }>({ sessionId: null, offsetMs: null });
  const [externalSeekRequest, setExternalSeekRequest] = useState<{
    sessionId: string;
    offsetMs: number;
    token: number;
  } | null>(null);

  // Modal states
  const [createNotebookFolderId, setCreateNotebookFolderId] = useState<
    string | null | undefined
  >(undefined);
  const [migrationModalState, setMigrationModalState] = useState<{
    open: boolean;
    folderId: string | null;
    inspectReport: MigrationReport | null;
  }>({ open: false, folderId: null, inspectReport: null });
  const [exportDocId, setExportDocId] = useState<string | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [activeStudySetState, setActiveStudySetState] = useState<{
    open: boolean;
    studySetId: string | null;
  }>({ open: false, studySetId: null });
  const [storageStats, setStorageStats] = useState<{
    documentCount: number;
    trashedCount: number;
    folderCount: number;
    studySetCount: number;
    assetCount: number;
    totalAssetBytes: number;
    versionSnapshotCount: number;
  } | null>(null);

  const historyRef = useRef(new DocumentHistoryManager(100));
  const lastAutoVersionMapRef = useRef<Map<string, number>>(new Map());
  const ocrQueueRef = useRef<AsyncOcrQueue | null>(null);

  // Reload complete vault state from IndexedDB
  const reloadVaultFromStorage = useCallback(async () => {
    await storage.recoverCrashJournal();
    const [docs, flds, sets, tpls, stks, loadedSettings, stats] = await Promise.all([
      storage.listDocuments(),
      storage.listFolders(),
      storage.listStudySets(),
      storage.listCustomTemplates(),
      storage.listCustomStickers(),
      storage.loadSettings(),
      storage.getStorageStats(),
    ]);

    const coverMap: Record<string, string> = {};
    for (const d of docs) {
      if (d.cover.customImageAssetId) {
        const ast = await storage.getAsset(d.cover.customImageAssetId);
        if (ast) {
          coverMap[d.cover.customImageAssetId] = `data:${ast.mimeType};base64,${ast.dataBase64}`;
        }
      }
    }

    setDocuments(docs);
    setFolders(flds);
    setStudySets(sets);
    setCustomTemplates(tpls);
    setCustomStickers(stks);
    setCustomCoverUrls(coverMap);
    setSettings(loadedSettings);
    setStorageStats(stats);
    setHydrated(true);
  }, [storage]);

  useEffect(() => {
    void requestDurableLocalStorage();
    void reloadVaultFromStorage();
  }, [reloadVaultFromStorage]);

  // iOS / iPadOS Application Lifecycle Saving & Incoming Native Document Open-In / AirDrop Handler
  const activeDocRef = useRef<InkVaultDocument | undefined>(undefined);
  activeDocRef.current = documents.find((d) => d.id === activeDocId);

  useEffect(() => {
    const cleanupLifecycle = registerIOSLifecyclePersistenceGuards({
      storage,
      getActiveDocument: () => activeDocRef.current,
      onLifecycleFlush: () => setSaveStatusLabel('Saved locally'),
    });

    const cleanupNativeImport = subscribeToNativeIOSEvents((evt) => {
      if (evt.type === 'nativeDocumentImported') {
        const bytes = base64ToUint8(evt.base64Data);
        void runBatchGoodnotesMigration(
          [
            {
              name: evt.fileName,
              relativePath: evt.fileName,
              bytes,
              mimeType: evt.mimeType,
            },
          ],
          storage,
          {
            targetRootFolderId: null,
            duplicatePolicy: 'keep-both',
          }
        ).then(() => reloadVaultFromStorage());
      }
    });

    return () => {
      cleanupLifecycle();
      cleanupNativeImport();
    };
  }, [storage, reloadVaultFromStorage]);

  // Apply light/dark theme attribute to document root
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveEffectiveTheme(settings.theme);
    };
    apply();
    if (settings.theme === 'system' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener?.('change', apply);
      return () => mql.removeEventListener?.('change', apply);
    }
  }, [settings.theme]);

  // Initialize Async Non-Blocking OCR Queue (Handwriting + Image OCR)
  useEffect(() => {
    ocrQueueRef.current = new AsyncOcrQueue((docId, pageId, ocrText, imageOcrById) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const updatedPages = d.pages.map((p) => {
            if (p.id !== pageId) return p;
            const nextImages = imageOcrById
              ? p.images.map((im) =>
                  imageOcrById[im.id] !== undefined
                    ? { ...im, ocrText: imageOcrById[im.id] }
                    : im
                )
              : p.images;
            return {
              ...p,
              ocrText,
              images: nextImages,
              ocrUpdatedAt: Date.now(),
            };
          });
          const updatedDoc = { ...d, pages: updatedPages };
          storage.scheduleAutosave(updatedDoc, 400);
          historyRef.current.replacePresentSilently(updatedDoc);
          return updatedDoc;
        })
      );
      setOcrBusyCount(ocrQueueRef.current?.getPendingCount() ?? 0);
    });
  }, [storage]);

  const handleUpdateSettings = useCallback(
    async (next: AppSettings) => {
      setSettings(next);
      await storage.saveSettings(next);
    },
    [storage]
  );

  // Open a notebook into workspace tabs
  const handleOpenDocument = useCallback(
    (docId: string, pageIndex?: number) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== docId) return d;
          const opened: InkVaultDocument = {
            ...d,
            lastOpenedAt: Date.now(),
            activePageIndex:
              typeof pageIndex === 'number'
                ? Math.max(0, Math.min(d.pages.length - 1, pageIndex))
                : d.activePageIndex,
          };
          historyRef.current.initDocument(opened);
          storage.scheduleAutosave(opened, 200);
          return opened;
        })
      );
      setOpenTabIds((tabs) => (tabs.includes(docId) ? tabs : [...tabs, docId]));
      setActiveDocId(docId);
      setViewMode('workspace');
    },
    [storage]
  );

  // Commit an edit from NotebookWorkspace with undo/redo history + non-interrupting autosave + background OCR
  const handleCommitDocument = useCallback(
    (nextDoc: InkVaultDocument) => {
      historyRef.current.commit(nextDoc);
      setDocuments((prev) => prev.map((d) => (d.id === nextDoc.id ? nextDoc : d)));
      setSaveStatusLabel('Saving…');
      mirrorDocumentToNativeVault(nextDoc);

      storage.scheduleAutosave(
        nextDoc,
        settings.autosaveDebounceMs,
        () => setSaveStatusLabel('Saved locally')
      );

      // Periodic automatic version history snapshot
      const now = Date.now();
      const lastSnap = lastAutoVersionMapRef.current.get(nextDoc.id) ?? 0;
      const intervalMs = Math.max(1, settings.autoVersionIntervalMin) * 60_000;
      if (now - lastSnap >= intervalMs) {
        lastAutoVersionMapRef.current.set(nextDoc.id, now);
        void storage.createVersionSnapshot(
          nextDoc,
          `Auto Checkpoint (rev ${nextDoc.revision})`,
          'auto'
        );
      }

      // Enqueue active page for background asynchronous OCR if enabled
      if (settings.backgroundOcrEnabled && ocrQueueRef.current) {
        const activePage = nextDoc.pages[nextDoc.activePageIndex];
        if (activePage) {
          ocrQueueRef.current.enqueuePage(nextDoc.id, activePage);
          setOcrBusyCount(ocrQueueRef.current.getPendingCount());
        }
      }
    },
    [settings.autoVersionIntervalMin, settings.autosaveDebounceMs, settings.backgroundOcrEnabled, storage]
  );

  const handleUndo = useCallback(() => {
    if (!activeDocId) return;
    const prev = historyRef.current.undo(activeDocId);
    if (!prev) return;
    setDocuments((docs) => docs.map((d) => (d.id === prev.id ? prev : d)));
    storage.scheduleAutosave(prev, settings.autosaveDebounceMs);
  }, [activeDocId, settings.autosaveDebounceMs, storage]);

  const handleRedo = useCallback(() => {
    if (!activeDocId) return;
    const next = historyRef.current.redo(activeDocId);
    if (!next) return;
    setDocuments((docs) => docs.map((d) => (d.id === next.id ? next : d)));
    storage.scheduleAutosave(next, settings.autosaveDebounceMs);
  }, [activeDocId, settings.autosaveDebounceMs, storage]);

  // Search hits for LibraryView Search Section
  const searchHits: SearchHitItem[] = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const filterMap: Record<string, SearchMatchSource[] | undefined> = {
      all: undefined,
      title: ['title'],
      handwriting: ['handwriting-ocr'],
      'handwriting-ocr': ['handwriting-ocr'],
      image: ['image-ocr'],
      'image-ocr': ['image-ocr'],
      typed: ['typed'],
      'typed-text': ['typed'],
      pdf: ['pdf'],
      'pdf-text': ['pdf'],
      outline: ['outline'],
    };
    const raw = searchAcrossLibrary(documents, searchQuery, {
      sources: filterMap[searchFilter],
      bookmarkedOnly: searchFilter === 'bookmark',
    });
    return raw.map((r) => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      pageIndex: r.pageIndex,
      pageId: r.pageId,
      matchType:
        r.source === 'typed'
          ? 'typed-text'
          : r.source === 'pdf'
          ? 'pdf-text'
          : r.source,
      snippet: r.snippet,
    }));
  }, [documents, searchFilter, searchQuery]);

  const openDocuments = useMemo(
    () =>
      openTabIds
        .map((id) => documents.find((d) => d.id === id && d.trashedAt === null))
        .filter((d): d is InkVaultDocument => Boolean(d)),
    [documents, openTabIds]
  );

  const activeDocument = useMemo(
    () => openDocuments.find((d) => d.id === activeDocId) ?? openDocuments[0] ?? null,
    [activeDocId, openDocuments]
  );

  // Upload custom template (PNG/JPG/WebP or PDF page 1) or custom cover
  const handleUploadCustomTemplate = useCallback(
    async (file: File, kind: 'paper' | 'cover'): Promise<CustomTemplateRecord> => {
      const ab = await file.arrayBuffer();
      let bytes = new Uint8Array(ab);
      let mime = file.type || 'image/png';
      let previewDataUrl = '';

      if (file.name.toLowerCase().endsWith('.pdf') || mime === 'application/pdf') {
        const pdfAsset = await storage.storeBinaryAsset(bytes, 'application/pdf', file.name);
        const renderedCanvas = await getRenderedPdfPageCanvas(
          storage,
          pdfAsset.id,
          1,
          794 * 1.5,
          1123 * 1.5
        );
        if (renderedCanvas) {
          previewDataUrl = renderedCanvas.toDataURL('image/png');
          const bin = atob(previewDataUrl.split(',')[1] || '');
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          mime = 'image/png';
        }
      }

      const asset = await storage.storeBinaryAsset(bytes, mime, file.name);
      if (!previewDataUrl) {
        previewDataUrl = `data:${mime};base64,${asset.dataBase64}`;
      }
      const record: CustomTemplateRecord = {
        id: createId('tpl'),
        name: file.name.replace(/\.[^.]+$/, ''),
        kind,
        assetId: asset.id,
        previewDataUrl,
        width: 794,
        height: 1123,
        createdAt: Date.now(),
      };
      await storage.saveCustomTemplate(record);
      setCustomTemplates((prev) => [...prev, record]);
      if (kind === 'cover') {
        setCustomCoverUrls((prev) => ({ ...prev, [asset.id]: previewDataUrl }));
      }
      return record;
    },
    [storage]
  );

  if (!hydrated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--iv-bg-app)',
          color: 'var(--iv-text-secondary)',
          fontSize: 13,
        }}
      >
        Opening Local INKVAULT Storage…
      </div>
    );
  }

  const exportTargetDoc =
    documents.find((d) => d.id === exportDocId) ?? activeDocument ?? null;

  const activeStudySet =
    studySets.find((s) => s.id === activeStudySetState.studySetId) ?? null;

  return (
    <>
      {viewMode === 'workspace' && activeDocument ? (
        <NotebookWorkspace
          openDocuments={openDocuments}
          activeDocument={activeDocument}
          settings={settings}
          storage={storage}
          customStickers={customStickers}
          canUndo={historyRef.current.canUndo(activeDocument.id)}
          canRedo={historyRef.current.canRedo(activeDocument.id)}
          saveStatusLabel={saveStatusLabel}
          audioDrawerOpen={audioDrawerOpen}
          isRecordingAudio={Boolean(recordingCtx.sessionId)}
          activeRecordingSessionId={recordingCtx.sessionId}
          getRecordingOffsetMs={recordingCtx.getOffsetMs}
          activePlaybackSessionId={playbackSync.sessionId}
          playbackPositionMs={playbackSync.offsetMs ?? 0}
          onToggleAudioDrawer={() => setAudioDrawerOpen((v) => !v)}
          onSeekAudioToMs={(sessionId, offsetMs) => {
            setAudioDrawerOpen(true);
            setExternalSeekRequest({ sessionId, offsetMs, token: Date.now() });
          }}
          audioBarSlot={
            audioDrawerOpen ? (
              <AudioNotesBar
                doc={activeDocument}
                storage={storage}
                externalSeekRequest={externalSeekRequest}
                onRecordingContextChange={setRecordingCtx}
                onPlaybackSyncChange={setPlaybackSync}
                onAddAudioSession={(session) => {
                  handleCommitDocument({
                    ...activeDocument,
                    audioSessions: [...activeDocument.audioSessions, session],
                    revision: activeDocument.revision + 1,
                    updatedAt: Date.now(),
                  });
                }}
                onDeleteAudioSession={(sessionId) => {
                  handleCommitDocument({
                    ...activeDocument,
                    audioSessions: activeDocument.audioSessions.filter(
                      (s) => s.id !== sessionId
                    ),
                    revision: activeDocument.revision + 1,
                    updatedAt: Date.now(),
                  });
                }}
                onNavigateToPage={(pageIdx) => {
                  handleCommitDocument({
                    ...activeDocument,
                    activePageIndex: pageIdx,
                  });
                }}
                onClose={() => setAudioDrawerOpen(false)}
              />
            ) : null
          }
          onSelectTab={(docId) => setActiveDocId(docId)}
          onCloseTab={(docId) => {
            const remaining = openTabIds.filter((id) => id !== docId);
            setOpenTabIds(remaining);
            if (remaining.length === 0) {
              setActiveDocId(null);
              setViewMode('library');
            } else if (activeDocId === docId) {
              setActiveDocId(remaining[remaining.length - 1]);
            }
          }}
          onBackToLibrary={() => setViewMode('library')}
          onCommitDocument={handleCommitDocument}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onUpdateSettings={handleUpdateSettings}
          onOpenExportModal={() => setExportDocId(activeDocument.id)}
          onOpenVersionHistory={() => setVersionHistoryOpen(true)}
          onOpenStudyDrawer={() => {
            const linked = studySets.find(
              (s) => s.linkedDocumentId === activeDocument.id
            );
            setActiveStudySetState({
              open: true,
              studySetId: linked?.id ?? null,
            });
          }}
          onMergePdfFile={async (file) => {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const merged = await mergePdfIntoDocument(
              activeDocument,
              bytes,
              file.name,
              storage
            );
            handleCommitDocument(merged);
          }}
          onSplitPagesToNewNotebook={async (pageIndices) => {
            const splitNb = splitDocumentByPages(
              activeDocument,
              pageIndices,
              `${activeDocument.title} (Extracted Pages)`
            );
            await storage.saveDocument(splitNb);
            historyRef.current.initDocument(splitNb);
            setDocuments((prev) => [splitNb, ...prev]);
            setOpenTabIds((tabs) => [...tabs, splitNb.id]);
            setActiveDocId(splitNb.id);
          }}
          onConvertSelectionToText={async (page, selectedObjects, bounds) => {
            const strokes = selectedObjects.filter(
              (o): o is InkStroke => o.kind === 'stroke'
            );
            let recognized = '';
            if (strokes.length > 0 && ocrQueueRef.current) {
              try {
                recognized = await ocrQueueRef.current.recognizeSelectedStrokes(
                  page,
                  strokes
                );
              } catch {
                recognized = '';
              }
            }
            const textContent =
              recognized.trim() ||
              selectedObjects
                .map((o) => (o.kind === 'textbox' ? o.text : ''))
                .filter(Boolean)
                .join(' ') ||
              'Converted Handwriting Note';

            const strokeIdsToRemove = new Set(strokes.map((s) => s.id));
            const nextPage: InkVaultPage = {
              ...page,
              strokes: page.strokes.filter((s) => !strokeIdsToRemove.has(s.id)),
              textBoxes: [
                ...page.textBoxes,
                {
                  id: createId('txt'),
                  kind: 'textbox',
                  layerId: page.layers[0].id,
                  zIndex: getNextZIndex(page),
                  x: bounds.x,
                  y: bounds.y,
                  width: Math.max(200, bounds.w),
                  height: Math.max(48, bounds.h),
                  rotation: 0,
                  text: textContent,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 16,
                  fontWeight: 'normal',
                  fontStyle: 'normal',
                  align: 'left',
                  color: '#18181B',
                  backgroundColor: 'transparent',
                  borderColor: 'transparent',
                  lineHeight: 1.45,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ],
            };
            handleCommitDocument(
              updatePageInDocument(activeDocument, page.id, () => nextPage)
            );
          }}
          onExtractSelectionToFlashcard={async (page, selectedObjects) => {
            const textSummary =
              selectedObjects
                .map((o: EditablePageObject) => (o.kind === 'textbox' ? o.text : ''))
                .filter(Boolean)
                .join(' ') ||
              page.ocrText ||
              page.pdfText?.slice(0, 140) ||
              `Selected annotation from ${activeDocument.title}`;

            const existingSet = studySets.find(
              (s) => s.linkedDocumentId === activeDocument.id
            );
            const now = Date.now();
            const setId = existingSet?.id ?? createId('set');
            const newCard = {
              id: createId('crd'),
              studySetId: setId,
              front: `${activeDocument.title} (Page ${
                activeDocument.pages.findIndex((p) => p.id === page.id) + 1
              })`,
              back: textSummary,
              sourceDocumentId: activeDocument.id,
              sourcePageId: page.id,
              tags: ['selection'],
              easinessFactor: 2.5,
              intervalDays: 0,
              repetitions: 0,
              nextReviewAt: now,
              lapses: 0,
              createdAt: now,
              updatedAt: now,
            };

            const nextSet: StudySet = existingSet
              ? {
                  ...existingSet,
                  cards: [...existingSet.cards, newCard],
                  updatedAt: now,
                }
              : {
                  id: setId,
                  title: `${activeDocument.title} — Study Set`,
                  description: `Flashcards linked to ${activeDocument.title}`,
                  folderId: activeDocument.folderId,
                  linkedDocumentId: activeDocument.id,
                  cards: [newCard],
                  createdAt: now,
                  updatedAt: now,
                };

            await storage.saveStudySet(nextSet);
            setStudySets((prev) => [
              nextSet,
              ...prev.filter((x) => x.id !== nextSet.id),
            ]);
            setActiveStudySetState({ open: true, studySetId: nextSet.id });
          }}
          onSaveCustomSticker={async (label, snapshotDataUrl) => {
            const stk: CustomStickerRecord = {
              id: createId('cstk'),
              label,
              collection: 'Saved Elements',
              previewDataUrl: snapshotDataUrl,
              createdAt: Date.now(),
            };
            await storage.saveCustomSticker(stk);
            setCustomStickers((prev) => [...prev, stk]);
          }}
          onExtractPageHighlightsToStudySet={async () => {
            const highlights =
              extractHighlightsAndAnnotationsFromDocument(activeDocument);
            const created = createStudySetFromExtractedHighlights(
              activeDocument,
              highlights
            );
            const linked = { ...created, linkedDocumentId: activeDocument.id };
            await storage.saveStudySet(linked);
            setStudySets((prev) => [linked, ...prev]);
            setActiveStudySetState({ open: true, studySetId: linked.id });
          }}
        />
      ) : (
        <LibraryView
          documents={documents}
          folders={folders}
          studySets={studySets}
          openTabIds={openTabIds}
          customCoverUrls={customCoverUrls}
          searchHits={searchHits}
          searchQuery={searchQuery}
          searchFilter={searchFilter}
          ocrBusyCount={ocrBusyCount}
          settings={settings}
          storageStats={storageStats}
          onUpdateSettings={handleUpdateSettings}
          onSearchQueryChange={setSearchQuery}
          onSearchFilterChange={setSearchFilter}
          onOpenDocument={handleOpenDocument}
          onOpenNewNotebookModal={(folderId) => setCreateNotebookFolderId(folderId)}
          onQuickNote={async (folderId) => {
            const nb = createNotebook({
              title: `QuickNote — ${new Date().toLocaleDateString()}`,
              folderId,
              sizeId: settings.defaultPaperSize,
              templateId: settings.defaultTemplate,
              paperColor: settings.defaultPaperColor,
              cover: { enabled: false },
            });
            await storage.saveDocument(nb);
            historyRef.current.initDocument(nb);
            setDocuments((prev) => [nb, ...prev]);
            setOpenTabIds((tabs) => [...tabs, nb.id]);
            setActiveDocId(nb.id);
            setViewMode('workspace');
          }}
          onCreateQuickTemplateNotebook={async (templateId, title, folderId) => {
            const nb = createNotebook({
              title,
              folderId,
              sizeId: settings.defaultPaperSize,
              templateId,
              paperColor: settings.defaultPaperColor,
              cover: { enabled: true },
            });
            await storage.saveDocument(nb);
            historyRef.current.initDocument(nb);
            setDocuments((prev) => [nb, ...prev]);
            setOpenTabIds((tabs) => [...tabs, nb.id]);
            setActiveDocId(nb.id);
            setViewMode('workspace');
          }}
          onCreateFolder={async (name, parentId, color) => {
            const folder = createFolder(name, parentId, color);
            await storage.saveFolder(folder);
            setFolders((prev) => [...prev, folder]);
          }}
          onRenameFolder={async (folderId, newName) => {
            const target = folders.find((f) => f.id === folderId);
            if (!target) return;
            const updated = { ...target, name: newName, updatedAt: Date.now() };
            await storage.saveFolder(updated);
            setFolders((prev) => prev.map((f) => (f.id === folderId ? updated : f)));
          }}
          onRenameDocument={async (docId, newTitle) => {
            const target = documents.find((d) => d.id === docId);
            if (!target) return;
            const updated = { ...target, title: newTitle, updatedAt: Date.now() };
            await storage.saveDocument(updated);
            setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
          }}
          onUpdateDocumentTags={async (docId, tags) => {
            const target = documents.find((d) => d.id === docId);
            if (!target) return;
            const updated = { ...target, tags, updatedAt: Date.now() };
            await storage.saveDocument(updated);
            setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
          }}
          onDuplicateDocument={async (docId) => {
            const target = documents.find((d) => d.id === docId);
            if (!target) return;
            const copy = duplicateNotebook(target);
            await storage.saveDocument(copy);
            setDocuments((prev) => [copy, ...prev]);
          }}
          onToggleFavoriteDocument={async (docId) => {
            const target = documents.find((d) => d.id === docId);
            if (!target) return;
            const updated = {
              ...target,
              isFavorite: !target.isFavorite,
              updatedAt: Date.now(),
            };
            await storage.saveDocument(updated);
            setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
          }}
          onToggleFavoriteFolder={async (folderId) => {
            const target = folders.find((f) => f.id === folderId);
            if (!target) return;
            const updated = {
              ...target,
              isFavorite: !target.isFavorite,
              updatedAt: Date.now(),
            };
            await storage.saveFolder(updated);
            setFolders((prev) => prev.map((f) => (f.id === folderId ? updated : f)));
          }}
          onMoveDocumentToFolder={async (docId, targetFolderId) => {
            const target = documents.find((d) => d.id === docId);
            if (!target) return;
            const updated = {
              ...target,
              folderId: targetFolderId,
              updatedAt: Date.now(),
            };
            await storage.saveDocument(updated);
            setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
          }}
          onMoveDocumentToTrash={async (docId) => {
            await storage.moveDocumentToTrash(docId);
            setOpenTabIds((tabs) => tabs.filter((t) => t !== docId));
            await reloadVaultFromStorage();
          }}
          onRestoreDocument={async (docId) => {
            await storage.restoreDocumentFromTrash(docId);
            await reloadVaultFromStorage();
          }}
          onDeleteDocumentForever={async (docId) => {
            await storage.permanentlyDeleteDocument(docId);
            setOpenTabIds((tabs) => tabs.filter((t) => t !== docId));
            await reloadVaultFromStorage();
          }}
          onMoveFolderToTrash={async (folderId) => {
            await storage.moveFolderToTrash(folderId);
            await reloadVaultFromStorage();
          }}
          onRestoreFolder={async (folderId) => {
            await storage.restoreFolderFromTrash(folderId);
            await reloadVaultFromStorage();
          }}
          onDeleteFolderForever={async (folderId) => {
            await storage.permanentlyDeleteFolder(folderId);
            await reloadVaultFromStorage();
          }}
          onEmptyTrash={async () => {
            await storage.emptyTrash();
            await reloadVaultFromStorage();
          }}
          onOpenImportModal={(targetFolderId) =>
            setMigrationModalState({
              open: true,
              folderId: targetFolderId,
              inspectReport: null,
            })
          }
          onOpenSettingsModal={() => setSettingsModalOpen(true)}
          onOpenBackupModal={() => setBackupModalOpen(true)}
          onOpenTemplatesModal={() => setTemplatesModalOpen(true)}
          onEncryptDocument={async (docId, passphrase, hint) => {
            const target = documents.find((d) => d.id === docId);
            if (!target) return;
            const encrypted = await encryptDocumentContent(target, passphrase, hint);
            await storage.saveDocument(encrypted);
            setOpenTabIds((tabs) => tabs.filter((t) => t !== docId));
            setDocuments((prev) => prev.map((d) => (d.id === docId ? encrypted : d)));
          }}
          onUnlockAndOpenDocument={async (docId, passphrase) => {
            const target = documents.find((d) => d.id === docId);
            if (!target) return;
            const unlocked = await decryptDocumentContent(target, passphrase);
            await storage.saveDocument(unlocked);
            historyRef.current.initDocument(unlocked);
            setDocuments((prev) => prev.map((d) => (d.id === docId ? unlocked : d)));
            setOpenTabIds((tabs) => (tabs.includes(docId) ? tabs : [...tabs, docId]));
            setActiveDocId(docId);
            setViewMode('workspace');
          }}
          onToggleShareDocument={async (docId, collaboratorName) => {
            const target = documents.find((d) => d.id === docId);
            if (!target) return;
            const updated: InkVaultDocument = collaboratorName
              ? {
                  ...target,
                  isShared: true,
                  collaborators: [
                    ...target.collaborators,
                    {
                      id: createId('col'),
                      name: collaboratorName,
                      role: 'editor',
                      addedAt: Date.now(),
                    },
                  ],
                  updatedAt: Date.now(),
                }
              : {
                  ...target,
                  isShared: !target.isShared,
                  updatedAt: Date.now(),
                };
            await storage.saveDocument(updated);
            setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
          }}
          onExportDocument={(docId) => setExportDocId(docId)}
          onViewMigrationReport={(doc) => {
            if (doc.migrationReport) {
              setMigrationModalState({
                open: true,
                folderId: doc.folderId,
                inspectReport: doc.migrationReport,
              });
            }
          }}
          onOpenStudySet={(studySetId) =>
            setActiveStudySetState({
              open: true,
              studySetId: studySetId ?? studySets[0]?.id ?? null,
            })
          }
          onCreateStudySet={async (title, description) => {
            const now = Date.now();
            const created: StudySet = {
              id: createId('set'),
              title,
              description,
              folderId: null,
              cards: [],
              createdAt: now,
              updatedAt: now,
            };
            await storage.saveStudySet(created);
            setStudySets((prev) => [created, ...prev]);
            setActiveStudySetState({ open: true, studySetId: created.id });
          }}
          onReturnToActiveWorkspace={
            openDocuments.length > 0
              ? () => {
                  if (!activeDocId && openDocuments[0]) {
                    setActiveDocId(openDocuments[0].id);
                  }
                  setViewMode('workspace');
                }
              : undefined
          }
        />
      )}

      {/* Create Notebook Modal */}
      <CreateNotebookModal
        open={createNotebookFolderId !== undefined}
        defaultSize={settings.defaultPaperSize}
        defaultTemplate={settings.defaultTemplate}
        defaultColor={settings.defaultPaperColor}
        customTemplates={customTemplates}
        onUploadCustomTemplate={handleUploadCustomTemplate}
        onClose={() => setCreateNotebookFolderId(undefined)}
        onCreate={async (opts) => {
          let nb = createNotebook({
            ...opts,
            folderId: createNotebookFolderId ?? null,
          });
          if (opts.customTemplateId) {
            const tpl = customTemplates.find((c) => c.id === opts.customTemplateId);
            if (tpl) {
              nb = {
                ...nb,
                pages: nb.pages.map((p, idx) =>
                  idx === 0 && p.isCoverPage
                    ? p
                    : {
                        ...p,
                        background: {
                          ...p.background,
                          type: 'custom-image',
                          customTemplateId: tpl.id,
                          imageAssetId: tpl.assetId,
                        },
                      }
                ),
              };
            }
          }
          await storage.saveDocument(nb);
          await storage.createVersionSnapshot(nb, 'Created notebook', 'manual');
          historyRef.current.initDocument(nb);
          setDocuments((prev) => [nb, ...prev]);
          setCreateNotebookFolderId(undefined);
          setOpenTabIds((tabs) => [...tabs, nb.id]);
          setActiveDocId(nb.id);
          setViewMode('workspace');
        }}
      />

      {/* Templates & Stationery Studio */}
      <TemplateGalleryModal
        open={templatesModalOpen}
        customTemplates={customTemplates}
        onUploadCustomTemplate={handleUploadCustomTemplate}
        onDeleteCustomTemplate={async (id) => {
          await storage.deleteCustomTemplate(id);
          setCustomTemplates((prev) => prev.filter((x) => x.id !== id));
        }}
        onCreateFromTemplate={async (
          templateId: TemplateId,
          paperColor: PaperColorId,
          customTemplateId?: string,
          coverOverride?
        ) => {
          let nb = createNotebook({
            title: `${
              templateId === 'cornell'
                ? 'Cornell Notes'
                : templateId === 'planner-weekly'
                ? 'Weekly Planner'
                : 'Untitled Notebook'
            }`,
            sizeId: settings.defaultPaperSize,
            templateId,
            paperColor,
            cover: coverOverride,
          });
          if (customTemplateId) {
            const tpl = customTemplates.find((c) => c.id === customTemplateId);
            if (tpl) {
              nb = {
                ...nb,
                pages: nb.pages.map((p) =>
                  p.isCoverPage
                    ? p
                    : {
                        ...p,
                        background: {
                          ...p.background,
                          type: 'custom-image',
                          customTemplateId: tpl.id,
                          imageAssetId: tpl.assetId,
                        },
                      }
                ),
              };
            }
          }
          await storage.saveDocument(nb);
          historyRef.current.initDocument(nb);
          setDocuments((prev) => [nb, ...prev]);
          setOpenTabIds((tabs) => [...tabs, nb.id]);
          setActiveDocId(nb.id);
          setViewMode('workspace');
        }}
        onClose={() => setTemplatesModalOpen(false)}
      />

      {/* Goodnotes Migration & Batch Import Studio */}
      <MigrationModal
        open={migrationModalState.open}
        targetFolderId={migrationModalState.folderId}
        storage={storage}
        singleReportToInspect={migrationModalState.inspectReport}
        onClose={() =>
          setMigrationModalState({
            open: false,
            folderId: null,
            inspectReport: null,
          })
        }
        onMigrationComplete={async () => {
          await reloadVaultFromStorage();
        }}
      />

      {/* Multi-Format Export Modal */}
      <ExportModal
        open={exportDocId !== null}
        doc={exportTargetDoc}
        storage={storage}
        onClose={() => setExportDocId(null)}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        open={versionHistoryOpen}
        doc={activeDocument}
        storage={storage}
        onRestored={(restoredDoc) => {
          historyRef.current.initDocument(restoredDoc);
          historyRef.current.commit(restoredDoc);
          setDocuments((prev) =>
            prev.map((d) => (d.id === restoredDoc.id ? restoredDoc : d))
          );
        }}
        onClose={() => setVersionHistoryOpen(false)}
      />

      {/* Full Library Backup, Restore & Sync Conflict Resolution */}
      <BackupAndSyncModal
        open={backupModalOpen}
        storage={storage}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onLibraryRestoredOrSynced={reloadVaultFromStorage}
        onClose={() => setBackupModalOpen(false)}
      />

      {/* Optional Study Set & SM-2 Spaced Repetition Modal */}
      <StudySetModal
        open={activeStudySetState.open}
        studySet={activeStudySet}
        activeDocument={viewMode === 'workspace' ? activeDocument : null}
        onSaveStudySet={async (nextSet) => {
          await storage.saveStudySet(nextSet);
          setStudySets((prev) => [
            nextSet,
            ...prev.filter((x) => x.id !== nextSet.id),
          ]);
          setActiveStudySetState({ open: true, studySetId: nextSet.id });
        }}
        onJumpToSourcePage={(docId, pageId) => {
          const targetDoc = documents.find((d) => d.id === docId);
          if (!targetDoc) return;
          const pIdx = Math.max(
            0,
            targetDoc.pages.findIndex((p) => p.id === pageId)
          );
          handleOpenDocument(docId, pIdx);
        }}
        onClose={() => setActiveStudySetState({ open: false, studySetId: null })}
      />

      {/* System Settings Modal */}
      <SettingsModal
        open={settingsModalOpen}
        settings={settings}
        storage={storage}
        onUpdateSettings={handleUpdateSettings}
        onOpenBackupModal={() => setBackupModalOpen(true)}
        onOpenMigrationModal={() =>
          setMigrationModalState({
            open: true,
            folderId: null,
            inspectReport: null,
          })
        }
        onClose={() => setSettingsModalOpen(false)}
      />
    </>
  );
};
