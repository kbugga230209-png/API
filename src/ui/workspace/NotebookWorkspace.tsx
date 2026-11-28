import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Download,
  Eraser,
  Eye,
  GraduationCap,
  Highlighter,
  History,
  Image as ImageIcon,
  Lasso,
  Maximize2,
  Mic,
  Minimize2,
  PanelLeft,
  PenTool,
  Pencil,
  Plus,
  Radio,
  Redo2,
  RotateCcw,
  Ruler,
  Search,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Spline,
  SquareDashedBottomCode,
  Sticker,
  Type,
  Underline,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  pasteObjectsOntoPage,
  renderInkStrokeToCanvas,
  RulerState,
} from '../../core/ink/inkEngine';
import { renderPaperBackgroundToCanvas } from '../../core/ink/templateRenderer';
import {
  createId,
  createPage,
  deletePagesFromDocument,
  duplicatePageInDocument,
  getNextZIndex,
  insertPageInDocument,
  moveObjectsBetweenPages,
  reorderPageInDocument,
  rotatePageInDocument,
  togglePageBookmark,
  touchDocument,
  updatePageInDocument,
} from '../../core/model/documentModel';
import { BUILTIN_STICKERS, PAPER_COLORS, PAPER_TEMPLATES } from '../../core/model/templates';
import {
  ActiveTool,
  AppSettings,
  CustomStickerRecord,
  EditablePageObject,
  EraserFilter,
  EraserMode,
  ImageObject,
  InkStroke,
  InkVaultDocument,
  InkVaultPage,
  LassoFilter,
  LassoMode,
  PaperColorId,
  PenInstrument,
  ShapeKind,
  StickerObject,
  TemplateId,
} from '../../core/model/types';
import { InkVaultStorageEngine } from '../../core/storage/storageEngine';
import {
  deserializePencilKitToInkStrokes,
  isRunningInNativeIOSShell,
  mapInstrumentToPKInkType,
  postCommandToNativeIOS,
  serializeInkStrokesToPencilKit,
  subscribeToNativeIOSEvents,
} from '../../core/ios/pencilKitBridge';
import { PageCanvasStage } from './PageCanvasStage';
import { SidebarTabId, WorkspaceSidebar } from './WorkspaceSidebar';

export interface NotebookWorkspaceProps {
  openDocuments: InkVaultDocument[];
  activeDocument: InkVaultDocument;
  settings: AppSettings;
  storage: InkVaultStorageEngine;
  customStickers: CustomStickerRecord[];
  canUndo: boolean;
  canRedo: boolean;
  saveStatusLabel: string;
  /** Audio props */
  audioDrawerOpen: boolean;
  audioBarSlot?: React.ReactNode;
  isRecordingAudio: boolean;
  activeRecordingSessionId: string | null;
  getRecordingOffsetMs: () => number;
  activePlaybackSessionId: string | null;
  playbackPositionMs: number;
  onToggleAudioDrawer: () => void;
  onSeekAudioToMs: (sessionId: string, offsetMs: number) => void;
  /** Callbacks */
  onSelectTab: (docId: string) => void;
  onCloseTab: (docId: string) => void;
  onBackToLibrary: () => void;
  onCommitDocument: (nextDoc: InkVaultDocument) => void;
  onUndo: () => void;
  onRedo: () => void;
  onUpdateSettings: (next: AppSettings) => void;
  onOpenExportModal: () => void;
  onOpenVersionHistory: () => void;
  onOpenStudyDrawer: () => void;
  onMergePdfFile: (file: File) => void;
  onSplitPagesToNewNotebook: (pageIndices: number[]) => void;
  onConvertSelectionToText: (
    page: InkVaultPage,
    selectedObjects: EditablePageObject[],
    bounds: { x: number; y: number; w: number; h: number }
  ) => void;
  onExtractSelectionToFlashcard: (
    page: InkVaultPage,
    selectedObjects: EditablePageObject[],
    snapshotDataUrl: string
  ) => void;
  onSaveCustomSticker: (label: string, snapshotDataUrl: string) => void;
  onExtractPageHighlightsToStudySet: () => void;
}

export const NotebookWorkspace: React.FC<NotebookWorkspaceProps> = ({
  openDocuments,
  activeDocument,
  settings,
  storage,
  customStickers,
  canUndo,
  canRedo,
  saveStatusLabel,
  audioDrawerOpen,
  audioBarSlot,
  isRecordingAudio,
  activeRecordingSessionId,
  getRecordingOffsetMs,
  activePlaybackSessionId,
  playbackPositionMs,
  onToggleAudioDrawer,
  onSeekAudioToMs,
  onSelectTab,
  onCloseTab,
  onBackToLibrary,
  onCommitDocument,
  onUndo,
  onRedo,
  onUpdateSettings,
  onOpenExportModal,
  onOpenVersionHistory,
  onOpenStudyDrawer,
  onMergePdfFile,
  onSplitPagesToNewNotebook,
  onConvertSelectionToText,
  onExtractSelectionToFlashcard,
  onSaveCustomSticker,
  onExtractPageHighlightsToStudySet,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabId>('pages');
  const [zenMode, setZenMode] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [continuousScroll, setContinuousScroll] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Active Ink & Editing Tool State
  const [activeTool, setActiveTool] = useState<ActiveTool>('pen');
  const [previousDrawingTool, setPreviousDrawingTool] = useState<ActiveTool>('pen');
  const [activeInstrument, setActiveInstrument] = useState<PenInstrument>('fountain');
  const [strokeColor, setStrokeColor] = useState('#18181B');
  const [strokeWidth, setStrokeWidth] = useState(2.4);
  const [strokeOpacity, setStrokeOpacity] = useState(1);

  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle');
  const [connectorRouting, setConnectorRouting] = useState<'straight' | 'elbow' | 'curved'>('elbow');
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [eraserRadius, setEraserRadius] = useState(14);
  const [eraserFilter, setEraserFilter] = useState<EraserFilter>({
    pen: true,
    pencil: true,
    highlighter: true,
    shapes: true,
    tape: true,
  });
  const [lassoMode, setLassoMode] = useState<LassoMode>('freehand');
  const [lassoFilter, setLassoFilter] = useState<LassoFilter>({
    strokes: true,
    shapes: true,
    textBoxes: true,
    images: true,
    stickers: true,
    tapes: true,
  });

  const [tapeColor, setTapeColor] = useState('#EA580C');
  const [tapeWidth, setTapeWidth] = useState(26);
  const [ruler, setRuler] = useState<RulerState>({
    visible: false,
    x: 380,
    y: 340,
    angleDeg: 0,
    length: 440,
    thickness: 46,
  });

  // Zoom Window (Magnified Writing Box) State
  const [zoomWindowOpen, setZoomWindowOpen] = useState(false);
  const [zoomBox, setZoomBox] = useState({ x: 84, y: 120, width: 260, height: 84 });
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoomDrawingRef = useRef(false);
  const zoomPointsRef = useRef<{ x: number; y: number; p: number; t: number }[]>([]);

  // Popovers
  const [openPopover, setOpenPopover] = useState<
    | null
    | 'pen'
    | 'eraser'
    | 'lasso'
    | 'shape'
    | 'sticker'
    | 'template'
    | 'in-doc-search'
    | 'customise-toolbar'
  >(null);
  const [inDocQuery, setInDocQuery] = useState('');
  const [clipboardObjects, setClipboardObjects] = useState<EditablePageObject[]>([]);

  // Customisable Tool Arrangement (persisted in localStorage)
  type ToolbarSlotId =
    | 'pen'
    | 'pencil'
    | 'highlighter'
    | 'underline'
    | 'eraser'
    | 'lasso'
    | 'shape'
    | 'connector'
    | 'text'
    | 'image'
    | 'sticker'
    | 'ruler'
    | 'tape'
    | 'zoom-window'
    | 'laser';

  const DEFAULT_TOOLBAR_SLOTS: ToolbarSlotId[] = [
    'pen',
    'pencil',
    'highlighter',
    'underline',
    'eraser',
    'lasso',
    'shape',
    'connector',
    'text',
    'image',
    'sticker',
    'ruler',
    'tape',
    'zoom-window',
    'laser',
  ];

  const TOOLBAR_SLOT_LABELS: Record<ToolbarSlotId, string> = {
    pen: 'Fountain & Ballpoint Pen',
    pencil: 'Graphite Pencil',
    highlighter: 'Underlay Highlighter',
    underline: 'PDF & Note Underline',
    eraser: 'Stroke & Pixel Eraser',
    lasso: 'Lasso Selection',
    shape: 'Geometric Shapes',
    connector: 'Diagram Connector',
    text: 'Rich Text Box',
    image: 'Insert Image',
    sticker: 'Stickers & Elements',
    ruler: 'Graduated Snap Ruler',
    tape: 'Active-Recall Tape',
    'zoom-window': 'Magnified Zoom Lens',
    laser: 'Laser Pointer',
  };

  const [toolbarOrder, setToolbarOrder] = useState<ToolbarSlotId[]>(() => {
    try {
      const raw = localStorage.getItem('inkvault_toolbar_order_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as ToolbarSlotId[];
        const valid = parsed.filter((id) => DEFAULT_TOOLBAR_SLOTS.includes(id));
        const missing = DEFAULT_TOOLBAR_SLOTS.filter((id) => !valid.includes(id));
        return [...valid, ...missing];
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_TOOLBAR_SLOTS;
  });

  const [hiddenToolbarSlots, setHiddenToolbarSlots] = useState<Set<ToolbarSlotId>>(() => {
    try {
      const raw = localStorage.getItem('inkvault_toolbar_hidden_v1');
      if (raw) {
        return new Set(JSON.parse(raw) as ToolbarSlotId[]);
      }
    } catch {
      // ignore storage errors
    }
    return new Set();
  });

  const persistToolbarLayout = (
    nextOrder: ToolbarSlotId[],
    nextHidden: Set<ToolbarSlotId>
  ) => {
    setToolbarOrder(nextOrder);
    setHiddenToolbarSlots(nextHidden);
    try {
      localStorage.setItem('inkvault_toolbar_order_v1', JSON.stringify(nextOrder));
      localStorage.setItem(
        'inkvault_toolbar_hidden_v1',
        JSON.stringify(Array.from(nextHidden))
      );
    } catch {
      // ignore storage errors
    }
  };

  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const pdfMergeRef = useRef<HTMLInputElement | null>(null);
  const writingWellRef = useRef<HTMLDivElement | null>(null);

  const activePage =
    activeDocument.pages[activeDocument.activePageIndex] ?? activeDocument.pages[0];
  const [activeLayerId, setActiveLayerId] = useState<string>(
    activePage?.layers[0]?.id ?? 'default'
  );

  // Sync tool & page strokes with Native iOS/iPadOS PencilKit Overlay when running inside Native Shell
  useEffect(() => {
    if (!isRunningInNativeIOSShell() || !activePage) return;
    postCommandToNativeIOS({
      command: 'configureCanvasOverlay',
      enabled: !readOnly,
      documentId: activeDocument.id,
      pageId: activePage.id,
      stylusOnly: settings.stylusOnlyDrawing,
      activeTool,
      inkType: mapInstrumentToPKInkType(
        activeTool === 'highlighter'
          ? 'highlighter'
          : activeTool === 'pencil'
          ? 'pencil'
          : activeInstrument
      ),
      colorHex: strokeColor,
      width: strokeWidth,
      opacity: strokeOpacity,
      zoom,
    });
  }, [
    activeDocument.id,
    activePage?.id,
    readOnly,
    settings.stylusOnlyDrawing,
    activeTool,
    activeInstrument,
    strokeColor,
    strokeWidth,
    strokeOpacity,
    zoom,
  ]);

  useEffect(() => {
    if (!isRunningInNativeIOSShell() || !activePage) return;
    postCommandToNativeIOS({
      command: 'syncPageStrokesToNative',
      payload: serializeInkStrokesToPencilKit(
        activeDocument.id,
        activePage.id,
        activePage.strokes
      ),
    });
  }, [activeDocument.id, activePage?.id, activePage?.strokes.length]);

  // Listen for Native Apple Pencil Double-Tap, Apple Pencil Pro Squeeze, and Native PKCanvasView Commits
  useEffect(() => {
    return subscribeToNativeIOSEvents((evt) => {
      if (evt.type === 'pencilDoubleTap') {
        const action = settings.pencilDoubleTapAction ?? 'switch-eraser';
        if (action === 'ignore') return;
        if (action === 'toggle-ruler') {
          setRuler((r) => ({ ...r, visible: !r.visible }));
          return;
        }
        if (action === 'switch-eraser') {
          if (activeTool === 'eraser') {
            setActiveTool(previousDrawingTool);
          } else {
            setPreviousDrawingTool(activeTool);
            setActiveTool('eraser');
          }
          return;
        }
        if (action === 'switch-previous') {
          const prev = previousDrawingTool;
          setPreviousDrawingTool(activeTool);
          setActiveTool(prev);
        }
      } else if (evt.type === 'pencilSqueeze' && evt.phase === 'began') {
        setOpenPopover((p) => (p === 'pen' ? null : 'pen'));
      } else if (
        evt.type === 'nativeDrawingDidCommit' &&
        evt.payload.documentId === activeDocument.id &&
        activePage &&
        evt.payload.pageId === activePage.id
      ) {
        const bridgedStrokes = deserializePencilKitToInkStrokes(
          evt.payload,
          activeLayerId
        );
        onCommitDocument(
          updatePageInDocument(activeDocument, activePage.id, (p) => ({
            ...p,
            strokes: bridgedStrokes,
            updatedAt: Date.now(),
          }))
        );
      }
    });
  }, [
    activeDocument,
    activePage,
    activeLayerId,
    activeTool,
    previousDrawingTool,
    settings.pencilDoubleTapAction,
    onCommitDocument,
  ]);

  useEffect(() => {
    if (activePage && !activePage.layers.some((l) => l.id === activeLayerId)) {
      setActiveLayerId(activePage.layers[0]?.id ?? 'default');
    }
  }, [activePage, activeLayerId]);

  // Smart default ink adjustment if switching onto dark paper while holding black ink
  useEffect(() => {
    if (!activePage) return;
    const palette = PAPER_COLORS[activePage.background.paperColor];
    if (palette?.isDark && strokeColor.toLowerCase() === '#18181b') {
      setStrokeColor('#F8FAFC');
    } else if (!palette?.isDark && strokeColor.toLowerCase() === '#f8fafc') {
      setStrokeColor('#18181B');
    }
  }, [activePage?.id]);

  // Keyboard shortcuts (`⌘Z`, `⇧⌘Z`, `P`, `E`, `V`, `T`, `R`, `L`, `[` / `]`)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v' && clipboardObjects.length > 0 && activePage) {
        e.preventDefault();
        const { nextPage } = pasteObjectsOntoPage(activePage, clipboardObjects);
        onCommitDocument(updatePageInDocument(activeDocument, activePage.id, () => nextPage));
        return;
      }
      if (e.key === 'p' || e.key === 'P') setActiveTool('pen');
      if (e.key === 'h' || e.key === 'H') setActiveTool('highlighter');
      if (e.key === 'e' || e.key === 'E') {
        setPreviousDrawingTool(activeTool === 'eraser' ? 'pen' : activeTool);
        setActiveTool('eraser');
      }
      if (e.key === 'v' || e.key === 'V') setActiveTool('lasso');
      if (e.key === 't' || e.key === 'T') setActiveTool('text');
      if (e.key === 'l' || e.key === 'L') setActiveTool('laser');
      if (e.key === '[') {
        jumpToPage(Math.max(0, activeDocument.activePageIndex - 1));
      }
      if (e.key === ']') {
        jumpToPage(Math.min(activeDocument.pages.length - 1, activeDocument.activePageIndex + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDocument, activePage, activeTool, clipboardObjects, onUndo, onRedo, onCommitDocument]);

  // Render Synchronized Zoom Window Canvas whenever activePage or zoomBox changes
  useEffect(() => {
    if (!zoomWindowOpen || !activePage) return;
    const zCanvas = zoomCanvasRef.current;
    if (!zCanvas) return;
    const mag = 2.6;
    const w = Math.round(zoomBox.width * mag);
    const h = Math.round(zoomBox.height * mag);
    zCanvas.width = w;
    zCanvas.height = h;
    const ctx = zCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(mag, mag);
    ctx.translate(-zoomBox.x, -zoomBox.y);
    renderPaperBackgroundToCanvas(ctx, activePage.width, activePage.height, activePage.background);
    for (const s of activePage.strokes) {
      renderInkStrokeToCanvas(ctx, s);
    }
    ctx.restore();

    // Auto-advance blue guide zone on right 22%
    const advW = w * 0.22;
    ctx.fillStyle = 'rgba(37, 99, 235, 0.09)';
    ctx.fillRect(w - advW, 0, advW, h);
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
    ctx.beginPath();
    ctx.moveTo(w - advW, 0);
    ctx.lineTo(w - advW, h);
    ctx.stroke();
  }, [zoomWindowOpen, activePage, zoomBox]);

  const jumpToPage = (index: number) => {
    const clamped = Math.max(0, Math.min(activeDocument.pages.length - 1, index));
    if (clamped === activeDocument.activePageIndex) return;
    onCommitDocument({
      ...activeDocument,
      activePageIndex: clamped,
    });
  };

  const handleAddPageAfter = (index: number) => {
    const refPage = activeDocument.pages[index] ?? activeDocument.pages[0];
    const newPg = createPage({
      sizeId: refPage?.sizeId ?? settings.defaultPaperSize,
      orientation: refPage?.orientation ?? 'portrait',
      templateId:
        refPage?.background.type === 'template'
          ? refPage.background.templateId
          : settings.defaultTemplate,
      paperColor: refPage?.background.paperColor ?? settings.defaultPaperColor,
    });
    onCommitDocument(insertPageInDocument(activeDocument, newPg, index + 1));
  };

  const handleInsertImageFile = async (file: File) => {
    if (!activePage) return;
    const buf = await file.arrayBuffer();
    const asset = await storage.storeBinaryAsset(buf, file.type || 'image/png', file.name);
    const dataUrl = `data:${asset.mimeType};base64,${asset.dataBase64}`;

    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      const t = setTimeout(() => resolve({ w: 320, h: 240 }), 250);
      img.onload = () => {
        clearTimeout(t);
        resolve({ w: img.naturalWidth || 320, h: img.naturalHeight || 240 });
      };
      img.onerror = () => {
        clearTimeout(t);
        resolve({ w: 320, h: 240 });
      };
      img.src = dataUrl;
    });

    const maxW = Math.min(360, activePage.width * 0.6);
    const ratio = dims.h / Math.max(1, dims.w);
    const targetW = Math.min(dims.w, maxW);
    const targetH = Math.round(targetW * ratio);
    const now = Date.now();
    const imgObj: ImageObject = {
      id: createId('img'),
      kind: 'image',
      assetId: asset.id,
      dataUrl,
      layerId: activeLayerId,
      zIndex: getNextZIndex(activePage),
      x: Math.round((activePage.width - targetW) / 2),
      y: 120,
      width: targetW,
      height: targetH,
      rotation: 0,
      opacity: 1,
      naturalWidth: dims.w,
      naturalHeight: dims.h,
      createdAt: now,
      updatedAt: now,
    };

    onCommitDocument(
      updatePageInDocument(activeDocument, activePage.id, (p) => ({
        ...p,
        images: [...p.images, imgObj],
      }))
    );
    setActiveTool('lasso');
  };

  const handleInsertSticker = (spec: {
    id: string;
    label: string;
    category: string;
    color: string;
    svgMarkup?: string;
    dataUrl?: string;
  }) => {
    if (!activePage) return;
    const now = Date.now();
    const stk: StickerObject = {
      id: createId('el'),
      kind: 'sticker',
      stickerId: spec.id,
      category: spec.category,
      label: spec.label,
      svgMarkup: spec.svgMarkup,
      dataUrl: spec.dataUrl,
      color: spec.color,
      layerId: activeLayerId,
      zIndex: getNextZIndex(activePage),
      x: Math.round(activePage.width / 2 - 72),
      y: 140,
      width: 144,
      height: 46,
      rotation: 0,
      createdAt: now,
      updatedAt: now,
    };
    onCommitDocument(
      updatePageInDocument(activeDocument, activePage.id, (p) => ({
        ...p,
        stickers: [...p.stickers, stk],
      }))
    );
    setOpenPopover(null);
  };

  const inDocSearchResults = React.useMemo(() => {
    const q = inDocQuery.trim().toLowerCase();
    if (!q) return [];
    const matches: { pageIndex: number; source: string; snippet: string }[] = [];
    activeDocument.pages.forEach((p, idx) => {
      const tbText = p.textBoxes.map((t) => t.text).join(' ');
      if (tbText.toLowerCase().includes(q)) {
        matches.push({ pageIndex: idx, source: 'Typed Text', snippet: tbText.slice(0, 90) });
      }
      if (p.ocrText && p.ocrText.toLowerCase().includes(q)) {
        matches.push({ pageIndex: idx, source: 'Handwriting OCR', snippet: p.ocrText.slice(0, 90) });
      }
      if (p.pdfText && p.pdfText.toLowerCase().includes(q)) {
        matches.push({ pageIndex: idx, source: 'PDF Text', snippet: p.pdfText.slice(0, 90) });
      }
    });
    return matches;
  }, [activeDocument.pages, inDocQuery]);

  if (!activePage) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* BAR 1: Compact Multi-Document Tabs & Global Workspace Bar (36px) */}
      {!zenMode && (
        <header
          style={{
            height: 38,
            minHeight: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            background: 'var(--iv-bg-sidebar)',
            borderBottom: '1px solid var(--iv-border)',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1, overflowX: 'auto' }}>
            <button
              type="button"
              className="iv-btn iv-btn-ghost"
              style={{ height: 28, padding: '0 8px', fontWeight: 600 }}
              onClick={onBackToLibrary}
              data-testid="back-to-library-btn"
            >
              <ArrowLeft size={15} />
              Library
            </button>

            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              data-active={sidebarOpen}
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle Pages, Outlines & Layers Sidebar"
              data-testid="toggle-workspace-sidebar"
            >
              <PanelLeft size={15} />
            </button>

            <div style={{ width: 1, height: 18, background: 'var(--iv-border)', margin: '0 4px' }} />

            {/* Multi-Document Tabs */}
            {openDocuments.map((tabDoc) => {
              const isCurrent = tabDoc.id === activeDocument.id;
              return (
                <div
                  key={tabDoc.id}
                  onClick={() => onSelectTab(tabDoc.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 28,
                    padding: '0 8px 0 10px',
                    borderRadius: 5,
                    background: isCurrent ? 'var(--iv-bg-surface)' : 'transparent',
                    border: isCurrent ? '1px solid var(--iv-border)' : '1px solid transparent',
                    fontSize: 12,
                    fontWeight: isCurrent ? 600 : 500,
                    cursor: 'pointer',
                    maxWidth: 190,
                    flexShrink: 0,
                  }}
                >
                  {isCurrent && isRecordingAudio && (
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#EF4444',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tabDoc.title}
                  </span>
                  <button
                    type="button"
                    aria-label={`Close tab ${tabDoc.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tabDoc.id);
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 2,
                      cursor: 'pointer',
                      color: 'var(--iv-text-muted)',
                      display: 'inline-flex',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right Document Utility Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span
              style={{
                fontSize: 11,
                color: 'var(--iv-text-muted)',
                marginRight: 4,
              }}
              className="iv-hide-portrait"
            >
              {saveStatusLabel}
            </span>

            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              data-active={openPopover === 'in-doc-search'}
              title="Search within document"
              onClick={() => setOpenPopover(openPopover === 'in-doc-search' ? null : 'in-doc-search')}
            >
              <Search size={15} />
            </button>

            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              data-active={audioDrawerOpen || isRecordingAudio}
              title="Audio Notes & Handwriting Timestamp Replay"
              onClick={onToggleAudioDrawer}
              data-testid="toggle-audio-btn"
            >
              <Mic size={15} color={isRecordingAudio ? '#EF4444' : 'currentColor'} />
            </button>

            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              title="Study Tools & Spaced Repetition"
              onClick={onOpenStudyDrawer}
              data-testid="toggle-study-btn"
            >
              <GraduationCap size={15} />
            </button>

            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              title="Bookmark current page"
              onClick={() =>
                onCommitDocument(togglePageBookmark(activeDocument, activePage.id))
              }
              data-testid="bookmark-page-btn"
            >
              <Bookmark
                size={15}
                color={activePage.bookmarked ? 'var(--iv-amber)' : 'currentColor'}
                fill={activePage.bookmarked ? 'var(--iv-amber)' : 'none'}
              />
            </button>

            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              data-active={readOnly}
              title={readOnly ? 'Switch to Edit Mode' : 'Read / Study Mode (tap Tape or Audio ink safely)'}
              onClick={() => setReadOnly((v) => !v)}
            >
              <Eye size={15} />
            </button>

            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              title="Version History Snapshots"
              onClick={onOpenVersionHistory}
              data-testid="version-history-btn"
            >
              <History size={15} />
            </button>

            <button
              type="button"
              className="iv-btn"
              style={{ height: 27, padding: '0 9px', fontSize: 12 }}
              onClick={onOpenExportModal}
              data-testid="workspace-export-btn"
            >
              <Download size={13} />
              Export
            </button>

            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              title="Enter Zen Focus Mode"
              onClick={() => setZenMode(true)}
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </header>
      )}

      {/* BAR 2: Unified Precision Instrument Dock (44px — hidden in Read-Only or Zen Mode) */}
      {!zenMode && !readOnly && (
        <div
          style={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 12px',
            background: 'var(--iv-bg-surface)',
            borderBottom: '1px solid var(--iv-border)',
            gap: 8,
            overflowX: 'auto',
            position: 'relative',
          }}
        >
          {/* Undo / Redo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <button
              type="button"
              className="iv-icon-btn"
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo (Ctrl/Cmd+Z)"
              data-testid="undo-btn"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              className="iv-icon-btn"
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo (Ctrl/Cmd+Shift+Z)"
              data-testid="redo-btn"
            >
              <Redo2 size={16} />
            </button>
          </div>

          {/* Customisable Primary Ink & Editing Instruments */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 2.5, flexShrink: 0 }}
            data-testid="workspace-instrument-strip"
          >
            {toolbarOrder
              .filter((slotId) => !hiddenToolbarSlots.has(slotId))
              .map((slotId) => {
                if (slotId === 'pen') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'pen'}
                      data-testid="tool-pen"
                      title="Pen Instrument (tap again for Fountain/Ballpoint/Brush/Fineliner)"
                      onClick={() => {
                        if (activeTool === 'pen') {
                          setOpenPopover(openPopover === 'pen' ? null : 'pen');
                        } else {
                          setActiveTool('pen');
                          setOpenPopover(null);
                        }
                      }}
                    >
                      <PenTool size={16} />
                    </button>
                  );
                }
                if (slotId === 'pencil') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'pencil'}
                      data-testid="tool-pencil"
                      title="Graphite Pencil (tilt-sensitive shading)"
                      onClick={() => {
                        setActiveTool('pencil');
                        setOpenPopover(null);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  );
                }
                if (slotId === 'highlighter') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'highlighter'}
                      data-testid="tool-highlighter"
                      title="Underlay Highlighter"
                      onClick={() => {
                        setActiveTool('highlighter');
                        if (strokeWidth < 12) setStrokeWidth(18);
                        setOpenPopover(null);
                      }}
                    >
                      <Highlighter size={16} />
                    </button>
                  );
                }
                if (slotId === 'underline') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'underline'}
                      data-testid="tool-underline"
                      title="Straight-Line PDF & Note Underline Tool"
                      onClick={() => {
                        setActiveTool('underline');
                        if (strokeWidth > 4) setStrokeWidth(2.2);
                        setOpenPopover(null);
                      }}
                    >
                      <Underline size={16} />
                    </button>
                  );
                }
                if (slotId === 'eraser') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'eraser'}
                      data-testid="tool-eraser"
                      title="Stroke & Vector-Splitting Pixel Eraser (tap again for filters)"
                      onClick={() => {
                        if (activeTool === 'eraser') {
                          setOpenPopover(openPopover === 'eraser' ? null : 'eraser');
                        } else {
                          setPreviousDrawingTool(activeTool);
                          setActiveTool('eraser');
                          setOpenPopover(null);
                        }
                      }}
                    >
                      <Eraser size={16} />
                    </button>
                  );
                }
                if (slotId === 'lasso') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'lasso'}
                      data-testid="tool-lasso"
                      title="Lasso Selection (tap again for Freehand / Rectangle & filters)"
                      onClick={() => {
                        if (activeTool === 'lasso') {
                          setOpenPopover(openPopover === 'lasso' ? null : 'lasso');
                        } else {
                          setActiveTool('lasso');
                          setOpenPopover(null);
                        }
                      }}
                    >
                      <Lasso size={16} />
                    </button>
                  );
                }
                if (slotId === 'shape') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'shape'}
                      data-testid="tool-shape"
                      title="Geometric Shapes (Line, Arrow, Rectangle, Ellipse, Triangle, Diamond)"
                      onClick={() => {
                        if (activeTool === 'shape') {
                          setOpenPopover(openPopover === 'shape' ? null : 'shape');
                        } else {
                          setActiveTool('shape');
                          setOpenPopover('shape');
                        }
                      }}
                    >
                      <Shapes size={16} />
                    </button>
                  );
                }
                if (slotId === 'connector') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'connector'}
                      data-testid="tool-connector"
                      title="Diagram Connector"
                      onClick={() => {
                        setActiveTool('connector');
                        setOpenPopover(null);
                      }}
                    >
                      <Spline size={16} />
                    </button>
                  );
                }
                if (slotId === 'text') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'text'}
                      data-testid="tool-text"
                      title="Movable Rich Text Box"
                      onClick={() => {
                        setActiveTool('text');
                        setOpenPopover(null);
                      }}
                    >
                      <Type size={16} />
                    </button>
                  );
                }
                if (slotId === 'image') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      title="Insert Image onto Page"
                      onClick={() => imageUploadRef.current?.click()}
                    >
                      <ImageIcon size={16} />
                    </button>
                  );
                }
                if (slotId === 'sticker') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={openPopover === 'sticker'}
                      title="Stickers & Saved Elements"
                      onClick={() => setOpenPopover(openPopover === 'sticker' ? null : 'sticker')}
                    >
                      <Sticker size={16} />
                    </button>
                  );
                }
                if (slotId === 'ruler') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={ruler.visible}
                      data-testid="tool-ruler"
                      title="Toggle Graduated Snap Ruler"
                      onClick={() => setRuler((r) => ({ ...r, visible: !r.visible }))}
                    >
                      <Ruler size={16} />
                    </button>
                  );
                }
                if (slotId === 'tape') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={activeTool === 'tape'}
                      data-testid="tool-tape"
                      title="Active Recall Tape Tool (draw to mask, tap to reveal)"
                      onClick={() => setActiveTool('tape')}
                    >
                      <SquareDashedBottomCode size={16} />
                    </button>
                  );
                }
                if (slotId === 'zoom-window') {
                  return (
                    <button
                      key={slotId}
                      type="button"
                      className="iv-icon-btn"
                      data-active={zoomWindowOpen}
                      data-testid="tool-zoom-window"
                      title="Magnified Writing Zoom Window"
                      onClick={() => setZoomWindowOpen((v) => !v)}
                    >
                      <ZoomIn size={16} />
                    </button>
                  );
                }
                return (
                  <button
                    key={slotId}
                    type="button"
                    className="iv-icon-btn"
                    data-active={activeTool === 'laser'}
                    data-testid="tool-laser"
                    title="Presentation Laser Pointer"
                    onClick={() => setActiveTool('laser')}
                  >
                    <Radio size={16} />
                  </button>
                );
              })}
          </div>

          {/* Right Quick Width Slots, Ink Colour Swatches, Paper & Customise Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {settings.quickWidths.map((w) => {
                const isSelected = Math.abs(strokeWidth - w) < 0.25;
                return (
                  <button
                    key={w}
                    type="button"
                    title={`Stroke width ${w}px`}
                    onClick={() => setStrokeWidth(w)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      border: isSelected ? '1.5px solid var(--iv-accent)' : '1px solid transparent',
                      background: isSelected ? 'var(--iv-accent-soft)' : 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <span
                      style={{
                        width: Math.min(14, Math.max(2, w * 1.4)),
                        height: Math.min(14, Math.max(2, w * 1.4)),
                        borderRadius: '50%',
                        background: 'var(--iv-text-primary)',
                      }}
                    />
                  </button>
                );
              })}
            </div>

            <div style={{ width: 1, height: 18, background: 'var(--iv-border)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {settings.quickColors.map((hex) => {
                const selected = strokeColor.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    title={`Ink colour ${hex}`}
                    onClick={() => setStrokeColor(hex)}
                    style={{
                      width: 19,
                      height: 19,
                      borderRadius: '50%',
                      background: hex,
                      border: selected
                        ? '2.5px solid var(--iv-accent)'
                        : '1px solid rgba(120,120,128,0.45)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                );
              })}
              <input
                type="color"
                aria-label="Custom ink color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                style={{
                  width: 22,
                  height: 22,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              />
            </div>

            <button
              type="button"
              className="iv-btn iv-btn-subtle"
              style={{ height: 26, padding: '0 8px', fontSize: 11.5 }}
              onClick={() => setOpenPopover(openPopover === 'template' ? null : 'template')}
              title="Change current page paper template or colour"
            >
              Paper
            </button>

            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              data-active={openPopover === 'customise-toolbar'}
              onClick={() =>
                setOpenPopover(openPopover === 'customise-toolbar' ? null : 'customise-toolbar')
              }
              title="Customise Toolbar Arrangement"
              aria-label="Customise Toolbar"
              data-testid="customise-toolbar-btn"
            >
              <SlidersHorizontal size={14.5} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Tool Configuration Popovers */}
      {openPopover && !zenMode && (
        <div
          style={{
            position: 'absolute',
            top: 86,
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: 320,
            maxWidth: 430,
            background: 'var(--iv-bg-elevated)',
            border: '1px solid var(--iv-border)',
            borderRadius: 'var(--iv-radius-lg)',
            boxShadow: 'var(--iv-shadow-lg)',
            padding: 15,
            zIndex: 60,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 650, fontSize: 13 }}>
              {openPopover === 'pen' && 'Pen Instrument & Stylus Dynamics'}
              {openPopover === 'eraser' && 'Eraser Mode & Object Filters'}
              {openPopover === 'lasso' && 'Lasso Selection Settings'}
              {openPopover === 'shape' && 'Geometric Shapes & Connectors'}
              {openPopover === 'sticker' && 'Stickers & Reusable Elements'}
              {openPopover === 'template' && 'Current Page Paper & Dimensions'}
              {openPopover === 'in-doc-search' && 'Search Within Document'}
              {openPopover === 'customise-toolbar' && 'Customise Instrument Bar'}
            </span>
            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 24, height: 24 }}
              onClick={() => setOpenPopover(null)}
            >
              <X size={14} />
            </button>
          </div>

          {openPopover === 'customise-toolbar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11.5, color: 'var(--iv-text-secondary)' }}>
                Reorder tools or hide instruments you rarely use. Changes save automatically.
              </div>
              <div
                style={{
                  maxHeight: 270,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  paddingRight: 2,
                }}
              >
                {toolbarOrder.map((slotId, idx) => {
                  const isHidden = hiddenToolbarSlots.has(slotId);
                  const isEssential = slotId === 'pen' || slotId === 'eraser';
                  return (
                    <div
                      key={slotId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: 6,
                        background: 'var(--iv-bg-subtle)',
                        opacity: isHidden ? 0.55 : 1,
                        fontSize: 12,
                      }}
                    >
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: isEssential ? 'default' : 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          disabled={isEssential}
                          onChange={() => {
                            const nextHidden = new Set(hiddenToolbarSlots);
                            if (nextHidden.has(slotId)) nextHidden.delete(slotId);
                            else nextHidden.add(slotId);
                            persistToolbarLayout(toolbarOrder, nextHidden);
                          }}
                        />
                        <span>{TOOLBAR_SLOT_LABELS[slotId]}</span>
                      </label>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          type="button"
                          className="iv-icon-btn"
                          style={{ width: 22, height: 22 }}
                          disabled={idx === 0}
                          aria-label={`Move ${TOOLBAR_SLOT_LABELS[slotId]} left`}
                          onClick={() => {
                            const next = [...toolbarOrder];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            persistToolbarLayout(next, hiddenToolbarSlots);
                          }}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="iv-icon-btn"
                          style={{ width: 22, height: 22 }}
                          disabled={idx === toolbarOrder.length - 1}
                          aria-label={`Move ${TOOLBAR_SLOT_LABELS[slotId]} right`}
                          onClick={() => {
                            const next = [...toolbarOrder];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            persistToolbarLayout(next, hiddenToolbarSlots);
                          }}
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                <button
                  type="button"
                  className="iv-btn iv-btn-ghost"
                  style={{ height: 27, fontSize: 11.5 }}
                  onClick={() => persistToolbarLayout(DEFAULT_TOOLBAR_SLOTS, new Set())}
                >
                  <RotateCcw size={12} />
                  Reset Default Order
                </button>
                <button
                  type="button"
                  className="iv-btn iv-btn-primary"
                  style={{ height: 27, fontSize: 11.5 }}
                  onClick={() => setOpenPopover(null)}
                >
                  <Check size={12} />
                  Done
                </button>
              </div>
            </div>
          )}

          {openPopover === 'pen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Live Dynamic Ink Stroke Preview Pad */}
              <div
                style={{
                  height: 48,
                  borderRadius: 7,
                  background: '#faf8f4',
                  border: '1px solid var(--iv-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <svg width="260" height="36" viewBox="0 0 260 36" fill="none">
                  <path
                    d="M16 25 C64 5, 108 32, 158 14 C194 2, 218 26, 246 11"
                    stroke={strokeColor}
                    strokeWidth={Math.min(18, Math.max(1.2, strokeWidth))}
                    strokeOpacity={strokeOpacity}
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="iv-segmented" style={{ width: '100%' }}>
                {(
                  [
                    { id: 'fountain', label: 'Fountain' },
                    { id: 'ballpoint', label: 'Ballpoint' },
                    { id: 'brush', label: 'Brush' },
                    { id: 'fineliner', label: 'Fineliner' },
                  ] as const
                ).map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    className="iv-segmented-item"
                    style={{ flex: 1, justifyContent: 'center' }}
                    data-active={activeInstrument === inst.id}
                    onClick={() => setActiveInstrument(inst.id)}
                  >
                    {inst.label}
                  </button>
                ))}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span>Stroke Smoothing</span>
                  <span>{Math.round(settings.penSmoothing * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.penSmoothing}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, penSmoothing: Number(e.target.value) })
                  }
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span>Pressure Sensitivity</span>
                  <span>{Math.round(settings.pressureSensitivity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.pressureSensitivity}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, pressureSensitivity: Number(e.target.value) })
                  }
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span>Nib Tip Sharpness</span>
                  <span>{Math.round(settings.tipSharpness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.tipSharpness}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, tipSharpness: Number(e.target.value) })
                  }
                  style={{ width: '100%' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span>Draw &amp; Hold Shape Recognition</span>
                <input
                  type="checkbox"
                  checked={settings.drawAndHoldShapes}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, drawAndHoldShapes: e.target.checked })
                  }
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span>Stylus-Only Drawing (Palm Rejection)</span>
                <input
                  type="checkbox"
                  checked={settings.stylusOnlyDrawing}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, stylusOnlyDrawing: e.target.checked })
                  }
                />
              </label>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span>Apple Pencil Double-Tap</span>
                <select
                  className="iv-select"
                  style={{ height: 25, fontSize: 11.5 }}
                  aria-label="Apple Pencil Double-Tap Action"
                  value={settings.pencilDoubleTapAction ?? 'switch-eraser'}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      pencilDoubleTapAction: e.target.value as
                        | 'switch-eraser'
                        | 'switch-previous'
                        | 'toggle-ruler'
                        | 'ignore',
                    })
                  }
                >
                  <option value="switch-eraser">Switch Current &amp; Eraser</option>
                  <option value="switch-previous">Switch Previous Tool</option>
                  <option value="toggle-ruler">Show / Hide Ruler</option>
                  <option value="ignore">Off</option>
                </select>
              </div>

              {/* Saved Pen Presets */}
              <div style={{ borderTop: '1px solid var(--iv-border)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--iv-text-secondary)', marginBottom: 6 }}>
                  SAVED INSTRUMENT PRESETS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {settings.penPresets.map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      className="iv-btn"
                      style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                      onClick={() => {
                        setActiveInstrument(pr.instrument);
                        setStrokeColor(pr.color);
                        setStrokeWidth(pr.width);
                        setStrokeOpacity(pr.opacity);
                        if (pr.instrument === 'highlighter') setActiveTool('highlighter');
                        else if (pr.instrument === 'pencil') setActiveTool('pencil');
                        else setActiveTool('pen');
                        setOpenPopover(null);
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: pr.color,
                        }}
                      />
                      {pr.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="iv-btn iv-btn-primary"
                    style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                    onClick={() => {
                      const nextPreset = {
                        id: createId('prs'),
                        name: `${activeInstrument} ${strokeWidth}px`,
                        instrument: activeInstrument,
                        color: strokeColor,
                        width: strokeWidth,
                        opacity: strokeOpacity,
                        smoothing: settings.penSmoothing,
                        pressureSensitivity: settings.pressureSensitivity,
                        tipSharpness: settings.tipSharpness,
                      };
                      onUpdateSettings({
                        ...settings,
                        penPresets: [...settings.penPresets, nextPreset],
                      });
                    }}
                  >
                    + Save Current
                  </button>
                </div>
              </div>
            </div>
          )}

          {openPopover === 'eraser' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="iv-segmented" style={{ width: '100%' }}>
                <button
                  type="button"
                  className="iv-segmented-item"
                  style={{ flex: 1, justifyContent: 'center' }}
                  data-active={eraserMode === 'stroke'}
                  onClick={() => setEraserMode('stroke')}
                >
                  Stroke Eraser
                </button>
                <button
                  type="button"
                  className="iv-segmented-item"
                  style={{ flex: 1, justifyContent: 'center' }}
                  data-active={eraserMode === 'pixel'}
                  onClick={() => setEraserMode('pixel')}
                >
                  Pixel Split Eraser
                </button>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span>Eraser Radius</span>
                  <span>{eraserRadius}px</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={48}
                  value={eraserRadius}
                  onChange={(e) => setEraserRadius(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--iv-text-secondary)' }}>
                ERASER FILTER (TURN OFF TO PROTECT)
              </div>
              {(
                [
                  { key: 'pen', label: 'Pen Strokes' },
                  { key: 'pencil', label: 'Pencil Shading' },
                  { key: 'highlighter', label: 'Highlighter Only' },
                  { key: 'shapes', label: 'Shapes' },
                  { key: 'tape', label: 'Study Tape' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={eraserFilter[item.key]}
                    onChange={(e) =>
                      setEraserFilter({ ...eraserFilter, [item.key]: e.target.checked })
                    }
                  />
                </label>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--iv-border)' }}>
                <button
                  type="button"
                  className="iv-btn iv-btn-danger"
                  style={{ height: 28, fontSize: 12 }}
                  onClick={() => {
                    onCommitDocument(
                      updatePageInDocument(activeDocument, activePage.id, (p) => ({
                        ...p,
                        strokes: p.strokes.filter((s) => s.locked),
                        shapes: p.shapes.filter((s) => s.locked),
                        tapes: p.tapes.filter((t) => t.locked),
                      }))
                    );
                    setOpenPopover(null);
                  }}
                >
                  Clear Unlocked Ink
                </button>
              </div>
            </div>
          )}

          {openPopover === 'lasso' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="iv-segmented" style={{ width: '100%' }}>
                <button
                  type="button"
                  className="iv-segmented-item"
                  style={{ flex: 1, justifyContent: 'center' }}
                  data-active={lassoMode === 'freehand'}
                  onClick={() => setLassoMode('freehand')}
                >
                  Freehand Loop
                </button>
                <button
                  type="button"
                  className="iv-segmented-item"
                  style={{ flex: 1, justifyContent: 'center' }}
                  data-active={lassoMode === 'rectangle'}
                  onClick={() => setLassoMode('rectangle')}
                >
                  Rectangular Marquee
                </button>
              </div>

              {(
                [
                  { key: 'strokes', label: 'Handwriting & Highlights' },
                  { key: 'shapes', label: 'Shapes & Connectors' },
                  { key: 'textBoxes', label: 'Text Boxes' },
                  { key: 'images', label: 'Images' },
                  { key: 'stickers', label: 'Stickers' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={lassoFilter[item.key]}
                    onChange={(e) =>
                      setLassoFilter({ ...lassoFilter, [item.key]: e.target.checked })
                    }
                  />
                </label>
              ))}
            </div>
          )}

          {openPopover === 'shape' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {(
                  [
                    { id: 'line', label: 'Line' },
                    { id: 'arrow', label: 'Arrow' },
                    { id: 'rectangle', label: 'Rectangle' },
                    { id: 'ellipse', label: 'Ellipse' },
                    { id: 'triangle', label: 'Triangle' },
                    { id: 'diamond', label: 'Diamond' },
                  ] as const
                ).map((sh) => (
                  <button
                    key={sh.id}
                    type="button"
                    className="iv-btn"
                    style={{
                      borderColor: shapeKind === sh.id ? 'var(--iv-accent)' : undefined,
                      background: shapeKind === sh.id ? 'var(--iv-accent-soft)' : undefined,
                    }}
                    onClick={() => {
                      setShapeKind(sh.id);
                      setActiveTool('shape');
                      setOpenPopover(null);
                    }}
                  >
                    {sh.label}
                  </button>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--iv-border)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>DIAGRAM CONNECTOR ROUTING</div>
                <div className="iv-segmented" style={{ width: '100%' }}>
                  {(['straight', 'elbow', 'curved'] as const).map((rt) => (
                    <button
                      key={rt}
                      type="button"
                      className="iv-segmented-item"
                      style={{ flex: 1, justifyContent: 'center' }}
                      data-active={connectorRouting === rt}
                      onClick={() => {
                        setConnectorRouting(rt);
                        setActiveTool('connector');
                        setOpenPopover(null);
                      }}
                    >
                      {rt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {openPopover === 'sticker' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {BUILTIN_STICKERS.map((stk) => (
                  <button
                    key={stk.id}
                    type="button"
                    className="iv-btn"
                    style={{ height: 36, justifyContent: 'flex-start' }}
                    onClick={() => handleInsertSticker(stk)}
                  >
                    <Sparkles size={13} color={stk.color} />
                    {stk.label}
                  </button>
                ))}
                {customStickers.map((cs) => (
                  <button
                    key={cs.id}
                    type="button"
                    className="iv-btn"
                    style={{ height: 36, justifyContent: 'flex-start' }}
                    onClick={() =>
                      handleInsertSticker({
                        id: cs.id,
                        label: cs.label,
                        category: cs.collection,
                        color: '#2563EB',
                        svgMarkup: cs.svgMarkup,
                        dataUrl: cs.previewDataUrl,
                      })
                    }
                  >
                    <Sparkles size={13} color="var(--iv-accent)" />
                    {cs.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {openPopover === 'template' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>PAGE TEMPLATE</div>
                <select
                  className="iv-select"
                  style={{ width: '100%' }}
                  value={activePage.background.templateId}
                  onChange={(e) => {
                    const tpl = e.target.value as TemplateId;
                    onCommitDocument(
                      updatePageInDocument(activeDocument, activePage.id, (p) => ({
                        ...p,
                        background: {
                          ...p.background,
                          type: 'template',
                          templateId: tpl,
                        },
                      }))
                    );
                  }}
                >
                  {PAPER_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>PAPER COLOUR</div>
                <select
                  className="iv-select"
                  style={{ width: '100%' }}
                  value={activePage.background.paperColor}
                  onChange={(e) => {
                    const col = e.target.value as PaperColorId;
                    onCommitDocument(
                      updatePageInDocument(activeDocument, activePage.id, (p) => ({
                        ...p,
                        background: {
                          ...p.background,
                          paperColor: col,
                        },
                      }))
                    );
                  }}
                >
                  {Object.values(PAPER_COLORS).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
                <button
                  type="button"
                  className="iv-btn"
                  style={{ flex: 1, fontSize: 11.5 }}
                  onClick={() => {
                    onCommitDocument(
                      updatePageInDocument(activeDocument, activePage.id, (p) => ({
                        ...p,
                        tapes: p.tapes.map((t) => ({ ...t, revealed: true })),
                      }))
                    );
                  }}
                >
                  Reveal All Tape
                </button>
                <button
                  type="button"
                  className="iv-btn"
                  style={{ flex: 1, fontSize: 11.5 }}
                  onClick={() => {
                    onCommitDocument(
                      updatePageInDocument(activeDocument, activePage.id, (p) => ({
                        ...p,
                        tapes: p.tapes.map((t) => ({ ...t, revealed: false })),
                      }))
                    );
                  }}
                >
                  Mask All Tape
                </button>
              </div>

              <button
                type="button"
                className="iv-btn iv-btn-primary"
                style={{ width: '100%', fontSize: 12 }}
                onClick={() => {
                  onExtractPageHighlightsToStudySet();
                  setOpenPopover(null);
                }}
              >
                <GraduationCap size={14} />
                Extract Highlights &amp; Tape to Study Set
              </button>
            </div>
          )}

          {openPopover === 'in-doc-search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="search"
                className="iv-input"
                placeholder="Find word in this notebook..."
                value={inDocQuery}
                onChange={(e) => setInDocQuery(e.target.value)}
                autoFocus
              />
              {inDocQuery.trim() && (
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {inDocSearchResults.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--iv-text-muted)' }}>No matches in this document.</div>
                  ) : (
                    inDocSearchResults.map((m, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="iv-btn iv-btn-ghost"
                        style={{ justifyContent: 'space-between', height: 'auto', padding: '6px 8px' }}
                        onClick={() => jumpToPage(m.pageIndex)}
                      >
                        <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.snippet}
                        </span>
                        <span className="iv-badge">
                          p.{m.pageIndex + 1} · {m.source}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleInsertImageFile(file);
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={pdfMergeRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onMergePdfFile(file);
          e.currentTarget.value = '';
        }}
      />

      {!zenMode && audioBarSlot}

      {/* MAIN BODY: Sidebar + Canvas Viewport */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <WorkspaceSidebar
          open={sidebarOpen && !zenMode}
          doc={activeDocument}
          activeTab={sidebarTab}
          activeLayerId={activeLayerId}
          onTabChange={setSidebarTab}
          onSelectActiveLayer={setActiveLayerId}
          onClose={() => setSidebarOpen(false)}
          onJumpToPage={jumpToPage}
          onAddPageAfter={handleAddPageAfter}
          onDuplicatePage={(idx) => onCommitDocument(duplicatePageInDocument(activeDocument, idx))}
          onRotatePage={(pid) => onCommitDocument(rotatePageInDocument(activeDocument, pid, 90))}
          onDeletePage={(pid) => onCommitDocument(deletePagesFromDocument(activeDocument, [pid]))}
          onReorderPage={(from, to) => onCommitDocument(reorderPageInDocument(activeDocument, from, to))}
          onToggleBookmark={(pid) => onCommitDocument(togglePageBookmark(activeDocument, pid))}
          onUpdateOutline={(outline) =>
            onCommitDocument(touchDocument({ ...activeDocument, outline }))
          }
          onUpdatePageLayers={(pid, layers) =>
            onCommitDocument(updatePageInDocument(activeDocument, pid, (p) => ({ ...p, layers })))
          }
          onMergePdfClick={() => pdfMergeRef.current?.click()}
          onSplitSelectedPages={onSplitPagesToNewNotebook}
        />

        {/* Scrollable Writing Well */}
        <div
          ref={writingWellRef}
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'var(--iv-bg-canvas-well)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: zenMode ? '16px 12px 60px' : '24px 20px 80px',
            gap: 24,
          }}
          onClick={() => setOpenPopover(null)}
        >
          {continuousScroll ? (
            /* Virtualized Windowed Multi-Page Scroll (mounts active window +/- 3 pages at high-res so 500-page notebooks stay instant!) */
            activeDocument.pages.map((pg, idx) => {
              const withinWindow = Math.abs(idx - activeDocument.activePageIndex) <= 3;
              if (!withinWindow) {
                return (
                  <div
                    key={pg.id}
                    onClick={() => jumpToPage(idx)}
                    style={{
                      width: pg.width * zoom,
                      height: pg.height * zoom,
                      background: 'var(--iv-bg-surface)',
                      border: '1px solid var(--iv-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--iv-text-muted)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Page {idx + 1} — Click to focus
                  </div>
                );
              }
              return (
                <div key={pg.id} onPointerDown={() => idx !== activeDocument.activePageIndex && jumpToPage(idx)}>
                  <PageCanvasStage
                    page={pg}
                    allPages={activeDocument.pages}
                    pageIndex={idx}
                    zoom={zoom}
                    readOnly={readOnly}
                    activeTool={activeTool}
                    activeInstrument={activeInstrument}
                    strokeColor={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    shapeKind={shapeKind}
                    connectorRouting={connectorRouting}
                    eraserMode={eraserMode}
                    eraserRadius={eraserRadius}
                    eraserFilter={eraserFilter}
                    lassoMode={lassoMode}
                    lassoFilter={lassoFilter}
                    activeLayerId={pg.layers[0]?.id ?? activeLayerId}
                    tapeColor={tapeColor}
                    tapeWidth={tapeWidth}
                    ruler={idx === activeDocument.activePageIndex ? ruler : { ...ruler, visible: false }}
                    onRulerChange={setRuler}
                    zoomWindowOpen={false}
                    zoomBox={zoomBox}
                    onZoomBoxChange={setZoomBox}
                    settings={settings}
                    storage={storage}
                    activeRecordingSessionId={activeRecordingSessionId}
                    getRecordingOffsetMs={getRecordingOffsetMs}
                    activePlaybackSessionId={activePlaybackSessionId}
                    playbackPositionMs={playbackPositionMs}
                    onSeekAudioToMs={onSeekAudioToMs}
                    clipboardObjects={clipboardObjects}
                    onCopySelection={setClipboardObjects}
                    onPasteAt={() => {}}
                    onCommitPageChange={(nextPg) =>
                      onCommitDocument(updatePageInDocument(activeDocument, pg.id, () => nextPg))
                    }
                    onMoveSelectionToPage={(targetPid, objIds) =>
                      onCommitDocument(moveObjectsBetweenPages(activeDocument, pg.id, targetPid, objIds))
                    }
                    onConvertSelectionToText={(objs, b) => onConvertSelectionToText(pg, objs, b)}
                    onExtractSelectionToFlashcard={(objs, url) => onExtractSelectionToFlashcard(pg, objs, url)}
                    onSaveSelectionAsSticker={(_objs, url) => onSaveCustomSticker('Saved Note Element', url)}
                    onAutoDeselectEraser={() => setActiveTool(previousDrawingTool)}
                    searchHighlightQuery={inDocQuery}
                    onZoomChange={setZoom}
                    onTwoFingerPan={(dx, dy) => {
                      if (writingWellRef.current) {
                        writingWellRef.current.scrollLeft -= dx;
                        writingWellRef.current.scrollTop -= dy;
                      }
                    }}
                    onTwoFingerTapUndo={onUndo}
                    onThreeFingerTapRedo={onRedo}
                    onPageSwipe={(dir) => {
                      if (dir === 'next') {
                        jumpToPage(Math.min(activeDocument.pages.length - 1, activeDocument.activePageIndex + 1));
                      } else {
                        jumpToPage(Math.max(0, activeDocument.activePageIndex - 1));
                      }
                    }}
                  />
                </div>
              );
            })
          ) : (
            <PageCanvasStage
              page={activePage}
              allPages={activeDocument.pages}
              pageIndex={activeDocument.activePageIndex}
              zoom={zoom}
              readOnly={readOnly}
              activeTool={activeTool}
              activeInstrument={activeInstrument}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              strokeOpacity={strokeOpacity}
              shapeKind={shapeKind}
              connectorRouting={connectorRouting}
              eraserMode={eraserMode}
              eraserRadius={eraserRadius}
              eraserFilter={eraserFilter}
              lassoMode={lassoMode}
              lassoFilter={lassoFilter}
              activeLayerId={activeLayerId}
              tapeColor={tapeColor}
              tapeWidth={tapeWidth}
              ruler={ruler}
              onRulerChange={setRuler}
              zoomWindowOpen={zoomWindowOpen}
              zoomBox={zoomBox}
              onZoomBoxChange={setZoomBox}
              settings={settings}
              storage={storage}
              activeRecordingSessionId={activeRecordingSessionId}
              getRecordingOffsetMs={getRecordingOffsetMs}
              activePlaybackSessionId={activePlaybackSessionId}
              playbackPositionMs={playbackPositionMs}
              onSeekAudioToMs={onSeekAudioToMs}
              clipboardObjects={clipboardObjects}
              onCopySelection={setClipboardObjects}
              onPasteAt={() => {}}
              onCommitPageChange={(nextPg) =>
                onCommitDocument(updatePageInDocument(activeDocument, activePage.id, () => nextPg))
              }
              onMoveSelectionToPage={(targetPid, objIds) =>
                onCommitDocument(moveObjectsBetweenPages(activeDocument, activePage.id, targetPid, objIds))
              }
              onConvertSelectionToText={(objs, b) => onConvertSelectionToText(activePage, objs, b)}
              onExtractSelectionToFlashcard={(objs, url) => onExtractSelectionToFlashcard(activePage, objs, url)}
              onSaveSelectionAsSticker={(_objs, url) => onSaveCustomSticker('Saved Note Element', url)}
              onAutoDeselectEraser={() => setActiveTool(previousDrawingTool)}
              searchHighlightQuery={inDocQuery}
              onZoomChange={setZoom}
              onTwoFingerPan={(dx, dy) => {
                if (writingWellRef.current) {
                  writingWellRef.current.scrollLeft -= dx;
                  writingWellRef.current.scrollTop -= dy;
                }
              }}
              onTwoFingerTapUndo={onUndo}
              onThreeFingerTapRedo={onRedo}
              onPageSwipe={(dir) => {
                if (dir === 'next') {
                  jumpToPage(Math.min(activeDocument.pages.length - 1, activeDocument.activePageIndex + 1));
                } else {
                  jumpToPage(Math.max(0, activeDocument.activePageIndex - 1));
                }
              }}
            />
          )}
        </div>

        {/* Floating Zen Exit Pill */}
        {zenMode && (
          <button
            type="button"
            className="iv-btn iv-glass-dock"
            onClick={() => setZenMode(false)}
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              zIndex: 45,
              borderRadius: 999,
            }}
          >
            <Minimize2 size={14} />
            Exit Focus
          </button>
        )}

        {/* Compact Floating Bottom-Right Page & Zoom Pill */}
        <div
          className="iv-glass-dock"
          style={{
            position: 'absolute',
            right: 16,
            bottom: zoomWindowOpen ? 248 : 16,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 999,
            zIndex: 30,
          }}
        >
          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 24, height: 24 }}
            disabled={activeDocument.activePageIndex === 0}
            onClick={() => jumpToPage(activeDocument.activePageIndex - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', padding: '0 4px' }}>
            {activeDocument.activePageIndex + 1} / {activeDocument.pages.length}
          </span>
          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 24, height: 24 }}
            disabled={activeDocument.activePageIndex >= activeDocument.pages.length - 1}
            onClick={() => jumpToPage(activeDocument.activePageIndex + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 24, height: 24 }}
            title="Append new page"
            onClick={() => handleAddPageAfter(activeDocument.activePageIndex)}
            data-testid="hud-add-page-btn"
          >
            <Plus size={14} />
          </button>

          <div style={{ width: 1, height: 14, background: 'var(--iv-border)', margin: '0 2px' }} />

          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 24, height: 24 }}
            onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.15).toFixed(2))))}
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="iv-btn iv-btn-ghost"
            style={{ height: 22, padding: '0 5px', fontSize: 11 }}
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 24, height: 24 }}
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </button>

          <button
            type="button"
            className="iv-btn iv-btn-ghost"
            style={{ height: 22, padding: '0 6px', fontSize: 10.5 }}
            onClick={() => setContinuousScroll((v) => !v)}
            title="Toggle Single Page vs Continuous Virtualized Scroll"
          >
            {continuousScroll ? 'Scroll' : 'Single'}
          </button>
        </div>
      </div>

      {/* DOCKED MAGNIFIED ZOOM WRITING WINDOW */}
      {zoomWindowOpen && (
        <div
          data-testid="zoom-writing-window"
          style={{
            height: 234,
            borderTop: '2px solid var(--iv-accent)',
            background: 'var(--iv-bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 40,
          }}
        >
          <div
            style={{
              height: 32,
              padding: '0 12px',
              borderBottom: '1px solid var(--iv-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--iv-accent)' }}>
              Magnified Writing Lens (2.6×) — Auto-Advance Active
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="iv-btn"
                style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                onClick={() =>
                  setZoomBox((b) => ({ ...b, x: Math.max(24, b.x - 140) }))
                }
              >
                <ChevronLeft size={13} /> Step Left
              </button>
              <button
                type="button"
                className="iv-btn"
                style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                onClick={() =>
                  setZoomBox((b) => ({
                    ...b,
                    x: Math.min(activePage.width - b.width - 16, b.x + 140),
                  }))
                }
              >
                Step Right <ChevronRight size={13} />
              </button>
              <button
                type="button"
                className="iv-btn"
                style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                onClick={() =>
                  setZoomBox((b) => ({
                    ...b,
                    x: 80,
                    y: Math.min(activePage.height - b.height - 20, b.y + (activePage.background.lineSpacing || 28)),
                  }))
                }
              >
                <CornerDownLeft size={13} /> Next Line
              </button>
              <button
                type="button"
                className="iv-icon-btn"
                style={{ width: 24, height: 24 }}
                onClick={() => setZoomWindowOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--iv-bg-canvas-well)', overflow: 'auto' }}>
            <canvas
              ref={zoomCanvasRef}
              className="iv-ink-stage"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                zoomDrawingRef.current = true;
                const rect = e.currentTarget.getBoundingClientRect();
                const mag = 2.6;
                zoomPointsRef.current = [
                  {
                    x: zoomBox.x + (e.clientX - rect.left) / mag,
                    y: zoomBox.y + (e.clientY - rect.top) / mag,
                    p: e.pressure > 0 ? e.pressure : 0.5,
                    t: 0,
                  },
                ];
              }}
              onPointerMove={(e) => {
                if (!zoomDrawingRef.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const mag = 2.6;
                const pt = {
                  x: zoomBox.x + (e.clientX - rect.left) / mag,
                  y: zoomBox.y + (e.clientY - rect.top) / mag,
                  p: e.pressure > 0 ? e.pressure : 0.5,
                  t: zoomPointsRef.current.length * 8,
                };
                zoomPointsRef.current.push(pt);
              }}
              onPointerUp={(e) => {
                if (!zoomDrawingRef.current) return;
                zoomDrawingRef.current = false;
                const pts = zoomPointsRef.current;
                zoomPointsRef.current = [];
                if (pts.length < 2) return;
                const now = Date.now();
                const newStroke: InkStroke = {
                  id: createId('stk'),
                  kind: 'stroke',
                  layerId: activeLayerId,
                  zIndex: getNextZIndex(activePage),
                  instrument: activeInstrument,
                  color: strokeColor,
                  width: Math.max(1, strokeWidth * 0.72),
                  opacity: strokeOpacity,
                  smoothing: settings.penSmoothing,
                  pressureSensitivity: settings.pressureSensitivity,
                  tipSharpness: settings.tipSharpness,
                  points: pts,
                  createdAt: now,
                  updatedAt: now,
                };
                onCommitDocument(
                  updatePageInDocument(activeDocument, activePage.id, (p) => ({
                    ...p,
                    strokes: [...p.strokes, newStroke],
                  }))
                );

                // Auto-advance if stroke ended in the right 22% zone!
                const rect = e.currentTarget.getBoundingClientRect();
                if (e.clientX - rect.left >= rect.width * 0.78) {
                  setZoomBox((b) => {
                    const nextX = b.x + b.width * 0.65;
                    if (nextX + b.width > activePage.width - 16) {
                      return {
                        ...b,
                        x: 80,
                        y: Math.min(activePage.height - b.height - 20, b.y + (activePage.background.lineSpacing || 28)),
                      };
                    }
                    return { ...b, x: nextX };
                  });
                }
              }}
              style={{
                background: '#fff',
                boxShadow: 'var(--iv-shadow-sm)',
                cursor: 'crosshair',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
