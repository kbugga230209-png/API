import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpToLine,
  Copy,
  FileType,
  GraduationCap,
  Group,
  Lock,
  Sparkles,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-react';
import {
  AlignmentGuide,
  applyPixelEraser,
  applyStrokeEraser,
  computeAlignmentGuides,
  doesCircleHitStroke,
  findObjectOnPage,
  getCombinedBounds,
  getObjectBounds,
  getSelectedObjectsOnPage,
  projectPointOntoRulerIfNear,
  recognizeShapeFromPoints,
  renderConnectorToCanvas,
  renderInkStrokeToCanvas,
  renderShapeToCanvas,
  renderTapeToCanvas,
  RulerState,
  selectObjectsWithLasso,
  smoothInkPoints,
  transformPageObjects,
} from '../../core/ink/inkEngine';
import { renderPaperBackgroundToCanvas } from '../../core/ink/templateRenderer';
import { createId, getNextZIndex } from '../../core/model/documentModel';
import {
  ActiveTool,
  AppSettings,
  ConnectorObject,
  EditablePageObject,
  EraserFilter,
  EraserMode,
  InkPoint,
  InkStroke,
  InkVaultPage,
  LassoFilter,
  LassoMode,
  PenInstrument,
  ShapeKind,
  ShapeObject,
  TapeObject,
  TextBoxObject,
} from '../../core/model/types';
import { getRenderedPdfPageCanvas } from '../../core/pdf/pdfEngine';
import { InkVaultStorageEngine } from '../../core/storage/storageEngine';
import { IPadGestureRecognizer } from '../../core/ios/ipadGestureEngine';
import { subscribeToNativeIOSEvents } from '../../core/ios/pencilKitBridge';

interface LaserTrailPoint {
  x: number;
  y: number;
  createdAt: number;
}

export interface PageCanvasStageProps {
  page: InkVaultPage;
  allPages: InkVaultPage[];
  pageIndex: number;
  zoom: number;
  readOnly: boolean;
  activeTool: ActiveTool;
  activeInstrument: PenInstrument;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  shapeKind: ShapeKind;
  connectorRouting: 'straight' | 'elbow' | 'curved';
  eraserMode: EraserMode;
  eraserRadius: number;
  eraserFilter: EraserFilter;
  lassoMode: LassoMode;
  lassoFilter: LassoFilter;
  activeLayerId: string;
  tapeColor: string;
  tapeWidth: number;
  ruler: RulerState;
  onRulerChange: (next: RulerState) => void;
  zoomWindowOpen: boolean;
  zoomBox: { x: number; y: number; width: number; height: number };
  onZoomBoxChange: (box: { x: number; y: number; width: number; height: number }) => void;
  settings: AppSettings;
  storage: InkVaultStorageEngine;
  /** Audio sync props */
  activeRecordingSessionId?: string | null;
  getRecordingOffsetMs?: () => number;
  activePlaybackSessionId?: string | null;
  playbackPositionMs?: number;
  onSeekAudioToMs?: (sessionId: string, offsetMs: number) => void;
  /** Clipboard & cross-page callbacks */
  clipboardObjects: EditablePageObject[];
  onCopySelection: (objs: EditablePageObject[]) => void;
  onPasteAt: (x?: number, y?: number) => void;
  onCommitPageChange: (nextPage: InkVaultPage) => void;
  onMoveSelectionToPage: (targetPageId: string, objectIds: string[]) => void;
  onConvertSelectionToText: (selectedObjects: EditablePageObject[], bounds: { x: number; y: number; w: number; h: number }) => void;
  onExtractSelectionToFlashcard: (selectedObjects: EditablePageObject[], snapshotDataUrl: string) => void;
  onSaveSelectionAsSticker: (selectedObjects: EditablePageObject[], snapshotDataUrl: string) => void;
  onAutoDeselectEraser?: () => void;
  searchHighlightQuery?: string;
  /** iPadOS Multi-Touch Gesture Callbacks */
  onZoomChange?: (nextZoom: number) => void;
  onTwoFingerPan?: (deltaX: number, deltaY: number) => void;
  onTwoFingerTapUndo?: () => void;
  onThreeFingerTapRedo?: () => void;
  onPageSwipe?: (direction: 'next' | 'prev') => void;
}

type DragHandleType =
  | 'move'
  | 'rotate'
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

export const PageCanvasStage: React.FC<PageCanvasStageProps> = ({
  page,
  allPages,
  zoom,
  readOnly,
  activeTool,
  activeInstrument,
  strokeColor,
  strokeWidth,
  strokeOpacity,
  shapeKind,
  connectorRouting,
  eraserMode,
  eraserRadius,
  eraserFilter,
  lassoMode,
  lassoFilter,
  activeLayerId,
  tapeColor,
  tapeWidth,
  ruler,
  onRulerChange,
  zoomWindowOpen,
  zoomBox,
  onZoomBoxChange,
  settings,
  storage,
  activeRecordingSessionId,
  getRecordingOffsetMs,
  activePlaybackSessionId,
  playbackPositionMs,
  onSeekAudioToMs,
  onCopySelection,
  onCommitPageChange,
  onMoveSelectionToPage,
  onConvertSelectionToText,
  onExtractSelectionToFlashcard,
  onSaveSelectionAsSticker,
  onAutoDeselectEraser,
  searchHighlightQuery,
  onZoomChange,
  onTwoFingerPan,
  onTwoFingerTapUndo,
  onThreeFingerTapRedo,
  onPageSwipe,
}) => {
  const dryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [pdfBgCanvas, setPdfBgCanvas] = useState<HTMLCanvasElement | null>(null);
  const [customBgImage, setCustomBgImage] = useState<HTMLImageElement | null>(null);
  const [imageTick, setImageTick] = useState(0);

  // Selection & Editing State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [movePageDropdownOpen, setMovePageDropdownOpen] = useState(false);

  // Live Pointer Interaction Refs
  const pointerDownRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const activePointerTypeRef = useRef<string>('mouse');
  const strokeStartWallRef = useRef<number>(0);
  const strokeAudioOffsetRef = useRef<number | undefined>(undefined);
  const inFlightPointsRef = useRef<InkPoint[]>([]);
  const predictedPointsRef = useRef<InkPoint[]>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snappedShapePreviewRef = useRef<ShapeObject | null>(null);
  const eraserWorkingPageRef = useRef<InkVaultPage | null>(null);
  const eraserCursorRef = useRef<{ x: number; y: number } | null>(null);
  const pencilHoverCursorRef = useRef<{ x: number; y: number; zOffset: number } | null>(null);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const dragSelectionRef = useRef<{
    handle: DragHandleType;
    startX: number;
    startY: number;
    basePage: InkVaultPage;
    initialBounds: { minX: number; minY: number; maxX: number; maxY: number };
  } | null>(null);
  const activeGuidesRef = useRef<AlignmentGuide[]>([]);
  const laserTrailRef = useRef<LaserTrailPoint[]>([]);
  const rulerDragRef = useRef<{
    mode: 'move' | 'rotate';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origAngle: number;
  } | null>(null);

  // Clear selection when switching pages
  useEffect(() => {
    setSelectedIds([]);
    setEditingTextId(null);
    setMovePageDropdownOpen(false);
  }, [page.id]);

  // Load PDF page raster cache when page is PDF-backed
  useEffect(() => {
    let cancelled = false;
    if (page.background.type === 'pdf' && page.background.pdfAssetId && page.background.pdfPageNumber) {
      getRenderedPdfPageCanvas(
        storage,
        page.background.pdfAssetId,
        page.background.pdfPageNumber,
        page.width * 1.5,
        page.height * 1.5
      ).then((canvas) => {
        if (!cancelled) setPdfBgCanvas(canvas);
      });
    } else {
      setPdfBgCanvas(null);
    }
    return () => {
      cancelled = true;
    };
  }, [page.background.type, page.background.pdfAssetId, page.background.pdfPageNumber, page.width, page.height, storage]);

  // Load Custom Image Paper Template when page is custom-image backed
  useEffect(() => {
    let cancelled = false;
    if (page.background.type === 'custom-image' && page.background.imageAssetId) {
      storage.getAsset(page.background.imageAssetId).then((rec) => {
        if (cancelled || !rec) return;
        const el = new Image();
        el.onload = () => {
          if (!cancelled) setCustomBgImage(el);
        };
        el.src = `data:${rec.mimeType};base64,${rec.dataBase64}`;
      });
    } else {
      setCustomBgImage(null);
    }
    return () => {
      cancelled = true;
    };
  }, [page.background.type, page.background.imageAssetId, storage]);

  // Preload image & SVG sticker elements into cache
  useEffect(() => {
    let mounted = true;
    const cache = imageElementCacheRef.current;

    for (const img of page.images) {
      if (cache.has(img.id)) continue;
      if (img.dataUrl) {
        const el = new Image();
        el.onload = () => {
          cache.set(img.id, el);
          if (mounted) setImageTick((t) => t + 1);
        };
        el.src = img.dataUrl;
      } else if (img.assetId) {
        storage.getAsset(img.assetId).then((rec) => {
          if (!rec || !mounted) return;
          const el = new Image();
          el.onload = () => {
            cache.set(img.id, el);
            if (mounted) setImageTick((t) => t + 1);
          };
          el.src = `data:${rec.mimeType};base64,${rec.dataBase64}`;
        });
      }
    }

    for (const stk of page.stickers) {
      if (cache.has(stk.id)) continue;
      if (stk.svgMarkup) {
        const el = new Image();
        el.onload = () => {
          cache.set(stk.id, el);
          if (mounted) setImageTick((t) => t + 1);
        };
        el.src = `data:image/svg+xml;utf8,${encodeURIComponent(stk.svgMarkup)}`;
      } else if (stk.dataUrl) {
        const el = new Image();
        el.onload = () => {
          cache.set(stk.id, el);
          if (mounted) setImageTick((t) => t + 1);
        };
        el.src = stk.dataUrl;
      } else if (stk.assetId) {
        storage.getAsset(stk.assetId).then((rec) => {
          if (!rec || !mounted) return;
          const el = new Image();
          el.onload = () => {
            cache.set(stk.id, el);
            if (mounted) setImageTick((t) => t + 1);
          };
          el.src = `data:${rec.mimeType};base64,${rec.dataBase64}`;
        });
      }
    }

    return () => {
      mounted = false;
    };
  }, [page.images, page.stickers, storage]);

  const effectiveLayerId = useMemo(() => {
    const found = page.layers.find((l) => l.id === activeLayerId && !l.locked && l.visible);
    if (found) return found.id;
    return page.layers.find((l) => !l.locked && l.visible)?.id ?? page.layers[0]?.id ?? 'default';
  }, [page.layers, activeLayerId]);

  const selectedObjects = useMemo(
    () => getSelectedObjectsOnPage(page, selectedIds),
    [page, selectedIds]
  );

  const selectionBounds = useMemo(
    () => getCombinedBounds(selectedObjects),
    [selectedObjects]
  );

  // --- DRY CANVAS RENDERING ---
  const renderDryCanvas = useCallback(
    (targetPage: InkVaultPage) => {
      const canvas = dryCanvasRef.current;
      if (!canvas) return;
      const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
      const targetW = Math.round(targetPage.width * zoom * dpr);
      const targetH = Math.round(targetPage.height * zoom * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
      ctx.clearRect(0, 0, targetPage.width, targetPage.height);

      // Apply page rotation around center if rotated
      if (targetPage.rotation !== 0) {
        ctx.translate(targetPage.width / 2, targetPage.height / 2);
        ctx.rotate((targetPage.rotation * Math.PI) / 180);
        ctx.translate(-targetPage.width / 2, -targetPage.height / 2);
      }

      // 1. Paper, Custom Image Template, or PDF Background
      renderPaperBackgroundToCanvas(ctx, targetPage.width, targetPage.height, targetPage.background);
      if (targetPage.background.type === 'custom-image' && customBgImage) {
        ctx.drawImage(customBgImage, 0, 0, targetPage.width, targetPage.height);
      }
      if (targetPage.background.type === 'pdf' && pdfBgCanvas) {
        ctx.drawImage(pdfBgCanvas, 0, 0, targetPage.width, targetPage.height);
      }

      const layerVisibility = new Map(targetPage.layers.map((l) => [l.id, l]));
      const isVisible = (layerId: string) => {
        const l = layerVisibility.get(layerId);
        return l ? l.visible : true;
      };

      // 2. Images & Stickers
      for (const img of targetPage.images) {
        if (!isVisible(img.layerId)) continue;
        const el = imageElementCacheRef.current.get(img.id);
        ctx.save();
        ctx.globalAlpha = img.opacity;
        ctx.translate(img.x + img.width / 2, img.y + img.height / 2);
        if (img.rotation) ctx.rotate((img.rotation * Math.PI) / 180);
        if (el) {
          ctx.drawImage(el, -img.width / 2, -img.height / 2, img.width, img.height);
        } else {
          ctx.fillStyle = 'rgba(148,163,184,0.18)';
          ctx.fillRect(-img.width / 2, -img.height / 2, img.width, img.height);
        }
        ctx.restore();
      }

      for (const stk of targetPage.stickers) {
        if (!isVisible(stk.layerId)) continue;
        const el = imageElementCacheRef.current.get(stk.id);
        ctx.save();
        ctx.translate(stk.x + stk.width / 2, stk.y + stk.height / 2);
        if (stk.rotation) ctx.rotate((stk.rotation * Math.PI) / 180);
        if (el) {
          ctx.drawImage(el, -stk.width / 2, -stk.height / 2, stk.width, stk.height);
        } else {
          ctx.fillStyle = 'rgba(37,99,235,0.1)';
          ctx.strokeStyle = stk.color || '#2563EB';
          ctx.lineWidth = 2;
          ctx.fillRect(-stk.width / 2, -stk.height / 2, stk.width, stk.height);
          ctx.strokeRect(-stk.width / 2, -stk.height / 2, stk.width, stk.height);
          ctx.fillStyle = stk.color || '#1E3A8A';
          ctx.font = '700 12px -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(stk.label, 0, 0);
        }
        ctx.restore();
      }

      // 3. Highlighter Underlay Pass
      for (const stroke of targetPage.strokes) {
        if (stroke.instrument !== 'highlighter' || !isVisible(stroke.layerId)) continue;
        renderInkStrokeToCanvas(ctx, stroke);
      }

      // 4. Pen & Pencil Vector Strokes (with Synchronised Audio Ink Replay!)
      for (const stroke of targetPage.strokes) {
        if (stroke.instrument === 'highlighter' || !isVisible(stroke.layerId)) continue;
        let opacityOverride: number | undefined;
        if (
          activePlaybackSessionId &&
          playbackPositionMs !== undefined &&
          stroke.audioSessionId === activePlaybackSessionId &&
          stroke.audioOffsetMs !== undefined
        ) {
          if (stroke.audioOffsetMs > playbackPositionMs) {
            opacityOverride = stroke.opacity * 0.24;
          }
        }
        renderInkStrokeToCanvas(ctx, stroke, opacityOverride);
      }

      // 5. Geometric Shapes & Connectors
      for (const shape of targetPage.shapes) {
        if (!isVisible(shape.layerId)) continue;
        renderShapeToCanvas(ctx, shape);
      }
      for (const conn of targetPage.connectors) {
        if (!isVisible(conn.layerId)) continue;
        renderConnectorToCanvas(ctx, conn, targetPage);
      }

      // 6. Text Boxes (rendered on canvas unless currently open in live textarea editor)
      for (const tb of targetPage.textBoxes) {
        if (!isVisible(tb.layerId) || tb.id === editingTextId) continue;
        ctx.save();
        ctx.translate(tb.x + tb.width / 2, tb.y + tb.height / 2);
        if (tb.rotation) ctx.rotate((tb.rotation * Math.PI) / 180);
        const hw = tb.width / 2;
        const hh = tb.height / 2;
        if (tb.backgroundColor && tb.backgroundColor !== 'transparent') {
          ctx.fillStyle = tb.backgroundColor;
          ctx.fillRect(-hw, -hh, tb.width, tb.height);
        }
        if (tb.borderColor && tb.borderColor !== 'transparent') {
          ctx.strokeStyle = tb.borderColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(-hw, -hh, tb.width, tb.height);
        }
        ctx.fillStyle = tb.color;
        ctx.font = `${tb.fontStyle === 'italic' ? 'italic ' : ''}${tb.fontWeight} ${tb.fontSize}px ${tb.fontFamily}`;
        ctx.textBaseline = 'top';
        const lines = tb.text.split('\n');
        const lh = tb.fontSize * (tb.lineHeight || 1.35);
        lines.forEach((line, idx) => {
          let tx = -hw + 6;
          if (tb.align === 'center') {
            ctx.textAlign = 'center';
            tx = 0;
          } else if (tb.align === 'right') {
            ctx.textAlign = 'right';
            tx = hw - 6;
          } else {
            ctx.textAlign = 'left';
          }
          const lineY = -hh + 6 + idx * lh;
          ctx.fillText(line, tx, lineY, Math.max(20, tb.width - 12));
          if (tb.underline && line.trim()) {
            const metricsW = Math.min(tb.width - 12, ctx.measureText(line).width);
            const startX =
              tb.align === 'center' ? -metricsW / 2 : tb.align === 'right' ? hw - 6 - metricsW : -hw + 6;
            ctx.beginPath();
            ctx.strokeStyle = tb.color;
            ctx.lineWidth = Math.max(1, tb.fontSize * 0.065);
            ctx.moveTo(startX, lineY + tb.fontSize + 2);
            ctx.lineTo(startX + metricsW, lineY + tb.fontSize + 2);
            ctx.stroke();
          }
        });
        ctx.restore();
      }

      // 7. Active Recall Tape Masks
      for (const tp of targetPage.tapes) {
        if (!isVisible(tp.layerId)) continue;
        renderTapeToCanvas(ctx, tp);
      }

      // 8. Search Highlight OCR Bounding Tokens
      if (searchHighlightQuery && searchHighlightQuery.trim() && targetPage.ocrTokens) {
        const q = searchHighlightQuery.trim().toLowerCase();
        ctx.save();
        ctx.fillStyle = 'rgba(250, 204, 21, 0.38)';
        ctx.strokeStyle = '#CA8A04';
        ctx.lineWidth = 1.5;
        for (const tok of targetPage.ocrTokens) {
          if (tok.text.toLowerCase().includes(q)) {
            const bw = tok.bbox.maxX - tok.bbox.minX;
            const bh = tok.bbox.maxY - tok.bbox.minY;
            ctx.fillRect(tok.bbox.minX - 2, tok.bbox.minY - 2, bw + 4, bh + 4);
            ctx.strokeRect(tok.bbox.minX - 2, tok.bbox.minY - 2, bw + 4, bh + 4);
          }
        }
        ctx.restore();
      }

      ctx.restore();
    },
    [zoom, pdfBgCanvas, customBgImage, editingTextId, activePlaybackSessionId, playbackPositionMs, searchHighlightQuery]
  );

  useEffect(() => {
    renderDryCanvas(page);
  }, [page, renderDryCanvas, imageTick]);

  // --- WET-INK & OVERLAY CANVAS RENDERING ---
  const renderWetOverlay = useCallback(() => {
    const canvas = wetCanvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const targetW = Math.round(page.width * zoom * dpr);
    const targetH = Math.round(page.height * zoom * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    // Request low-latency Apple Pencil / hardware scanout path where supported
    const ctx =
      (canvas.getContext('2d', { desynchronized: true }) as CanvasRenderingContext2D | null) ??
      canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    ctx.clearRect(0, 0, page.width, page.height);

    const pts = inFlightPointsRef.current;
    const ptsWithPredicted =
      predictedPointsRef.current.length > 0
        ? [...pts, ...predictedPointsRef.current]
        : pts;

    // 1. In-flight Pen / Pencil / Highlighter / Underline / Shape / Connector / Tape preview
    if (snappedShapePreviewRef.current) {
      renderShapeToCanvas(ctx, snappedShapePreviewRef.current);
    } else if (pts.length > 0) {
      if (
        activeTool === 'pen' ||
        activeTool === 'pencil' ||
        activeTool === 'highlighter' ||
        activeTool === 'underline'
      ) {
        const inst: PenInstrument =
          activeTool === 'highlighter'
            ? 'highlighter'
            : activeTool === 'pencil'
            ? 'pencil'
            : activeTool === 'underline'
            ? 'fineliner'
            : activeInstrument;
        const previewStroke: InkStroke = {
          id: 'preview',
          kind: 'stroke',
          layerId: effectiveLayerId,
          zIndex: 999999,
          instrument: inst,
          color: strokeColor,
          width: activeTool === 'underline' ? Math.max(1.5, Math.min(4.5, strokeWidth)) : strokeWidth,
          opacity: inst === 'highlighter' ? Math.min(0.4, strokeOpacity) : strokeOpacity,
          smoothing: settings.penSmoothing,
          pressureSensitivity: activeTool === 'underline' ? 0 : settings.pressureSensitivity,
          tipSharpness: settings.tipSharpness,
          points: activeTool === 'underline' ? pts : ptsWithPredicted,
          createdAt: 0,
          updatedAt: 0,
        };
        renderInkStrokeToCanvas(ctx, previewStroke);
      } else if (activeTool === 'shape' && pts.length >= 2) {
        const p0 = pts[0];
        const pLast = pts[pts.length - 1];
        const previewShape: ShapeObject = {
          id: 'shp_preview',
          kind: 'shape',
          shapeType: shapeKind,
          layerId: effectiveLayerId,
          zIndex: 999999,
          x: Math.min(p0.x, pLast.x),
          y: Math.min(p0.y, pLast.y),
          width: Math.abs(pLast.x - p0.x),
          height: Math.abs(pLast.y - p0.y),
          x1: p0.x,
          y1: p0.y,
          x2: pLast.x,
          y2: pLast.y,
          rotation: 0,
          strokeColor,
          fillColor: strokeColor,
          fillOpacity: 0.06,
          strokeWidth,
          createdAt: 0,
          updatedAt: 0,
        };
        renderShapeToCanvas(ctx, previewShape);
      } else if (activeTool === 'connector' && pts.length >= 2) {
        const p0 = pts[0];
        const pLast = pts[pts.length - 1];
        const previewConn: ConnectorObject = {
          id: 'con_preview',
          kind: 'connector',
          layerId: effectiveLayerId,
          zIndex: 999999,
          x1: p0.x,
          y1: p0.y,
          x2: pLast.x,
          y2: pLast.y,
          strokeColor,
          strokeWidth,
          routing: connectorRouting,
          arrowEnd: true,
          createdAt: 0,
          updatedAt: 0,
        };
        renderConnectorToCanvas(ctx, previewConn);
      } else if (activeTool === 'tape' && pts.length >= 2) {
        const p0 = pts[0];
        const pLast = pts[pts.length - 1];
        const previewTape: TapeObject = {
          id: 'tap_preview',
          kind: 'tape',
          layerId: effectiveLayerId,
          zIndex: 999999,
          x1: p0.x,
          y1: p0.y,
          x2: pLast.x,
          y2: pLast.y,
          width: tapeWidth,
          color: tapeColor,
          revealed: false,
          createdAt: 0,
          updatedAt: 0,
        };
        renderTapeToCanvas(ctx, previewTape);
      }
    }

    // 2. Eraser Cursor Ring
    if (activeTool === 'eraser' && eraserCursorRef.current) {
      ctx.save();
      ctx.strokeStyle = '#EF4444';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.lineWidth = 1.25 / zoom;
      ctx.beginPath();
      ctx.arc(eraserCursorRef.current.x, eraserCursorRef.current.y, eraserRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 2b. Apple Pencil Hover Nib Preview Ring (M2/M4 iPad Pro & iPad Air Hover)
    if (
      !pointerDownRef.current &&
      settings.pencilHoverPreview !== false &&
      activeTool !== 'eraser' &&
      pencilHoverCursorRef.current
    ) {
      const hv = pencilHoverCursorRef.current;
      const hoverRadius = Math.max(2.5 / zoom, strokeWidth / 2);
      ctx.save();
      ctx.globalAlpha = Math.max(0.28, 0.78 * (1 - hv.zOffset * 0.65));
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      ctx.lineWidth = 1.2 / zoom;
      ctx.beginPath();
      ctx.arc(hv.x, hv.y, hoverRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.22;
      ctx.fill();
      ctx.restore();
    }

    // 3. Active Lasso Path
    if (activeTool === 'lasso' && lassoPointsRef.current.length >= 2) {
      const lp = lassoPointsRef.current;
      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.06)';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([5 / zoom, 4 / zoom]);
      ctx.beginPath();
      if (lassoMode === 'rectangle') {
        const x = Math.min(lp[0].x, lp[lp.length - 1].x);
        const y = Math.min(lp[0].y, lp[lp.length - 1].y);
        const w = Math.abs(lp[lp.length - 1].x - lp[0].x);
        const h = Math.abs(lp[lp.length - 1].y - lp[0].y);
        ctx.rect(x, y, w, h);
      } else {
        ctx.moveTo(lp[0].x, lp[0].y);
        for (let i = 1; i < lp.length; i++) ctx.lineTo(lp[i].x, lp[i].y);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 4. Magnetic Alignment Snap Guides
    if (activeGuidesRef.current.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 3 / zoom]);
      for (const g of activeGuidesRef.current) {
        ctx.beginPath();
        if (g.orientation === 'vertical') {
          ctx.moveTo(g.position, 0);
          ctx.lineTo(g.position, page.height);
        } else {
          ctx.moveTo(0, g.position);
          ctx.lineTo(page.width, g.position);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Selection Bounding Box + 8 Resize Handles + Rotation Stem
    if (selectionBounds && selectedIds.length > 0) {
      const pad = 6;
      const bx = selectionBounds.minX - pad;
      const by = selectionBounds.minY - pad;
      const bw = selectionBounds.maxX - selectionBounds.minX + pad * 2;
      const bh = selectionBounds.maxY - selectionBounds.minY + pad * 2;

      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.4 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      // Rotation stem above top center
      const cx = bx + bw / 2;
      const rotY = by - 22 / zoom;
      ctx.beginPath();
      ctx.moveTo(cx, by);
      ctx.lineTo(cx, rotY);
      ctx.stroke();

      const handleR = 4.5 / zoom;
      const drawHandle = (hx: number, hy: number, accent = false) => {
        ctx.beginPath();
        ctx.fillStyle = accent ? '#2563EB' : '#FFFFFF';
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.6 / zoom;
        ctx.arc(hx, hy, handleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      };

      drawHandle(cx, rotY, true);
      drawHandle(bx, by);
      drawHandle(cx, by);
      drawHandle(bx + bw, by);
      drawHandle(bx + bw, by + bh / 2);
      drawHandle(bx + bw, by + bh);
      drawHandle(cx, by + bh);
      drawHandle(bx, by + bh);
      drawHandle(bx, by + bh / 2);
      ctx.restore();
    }

    // 6. Zoom Window Target Lens Box
    if (zoomWindowOpen) {
      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.05)';
      ctx.lineWidth = 1.6 / zoom;
      ctx.fillRect(zoomBox.x, zoomBox.y, zoomBox.width, zoomBox.height);
      ctx.strokeRect(zoomBox.x, zoomBox.y, zoomBox.width, zoomBox.height);
      // Right-hand auto-advance zone preview
      const advW = zoomBox.width * 0.22;
      ctx.fillStyle = 'rgba(37, 99, 235, 0.13)';
      ctx.fillRect(zoomBox.x + zoomBox.width - advW, zoomBox.y, advW, zoomBox.height);
      ctx.restore();
    }

    // 7. Fading Laser Pointer Trail
    if (laserTrailRef.current.length > 0) {
      const now = Date.now();
      laserTrailRef.current = laserTrailRef.current.filter((pt) => now - pt.createdAt < 1350);
      const trail = laserTrailRef.current;
      if (trail.length > 0) {
        ctx.save();
        for (let i = 1; i < trail.length; i++) {
          const age = (now - trail[i].createdAt) / 1350;
          ctx.globalAlpha = Math.max(0, 1 - age);
          ctx.strokeStyle = '#EF4444';
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 4.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.stroke();
        }
        const tip = trail[trail.length - 1];
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }, [
    page.width,
    page.height,
    zoom,
    activeTool,
    activeInstrument,
    effectiveLayerId,
    strokeColor,
    strokeWidth,
    strokeOpacity,
    shapeKind,
    connectorRouting,
    eraserRadius,
    lassoMode,
    tapeWidth,
    tapeColor,
    selectionBounds,
    selectedIds.length,
    zoomWindowOpen,
    zoomBox,
    settings.penSmoothing,
    settings.pressureSensitivity,
    settings.tipSharpness,
  ]);

  useEffect(() => {
    renderWetOverlay();
  }, [renderWetOverlay, selectionBounds]);

  // Animate Laser Pointer fade loop when active
  useEffect(() => {
    if (activeTool !== 'laser') return;
    let rafId = 0;
    const tick = () => {
      if (laserTrailRef.current.length > 0) {
        renderWetOverlay();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeTool, renderWetOverlay]);

  // Helper: convert client coordinates to logical page coordinates
  const toPagePoint = (clientX: number, clientY: number, pressure = 0.5, tiltX?: number, tiltY?: number): InkPoint => {
    const el = wetCanvasRef.current;
    if (!el) return { x: 0, y: 0, p: pressure, t: 0 };
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / zoom;
    const y = (clientY - rect.top) / zoom;
    return {
      x: Math.max(0, Math.min(page.width, x)),
      y: Math.max(0, Math.min(page.height, y)),
      p: pressure > 0 ? pressure : 0.5,
      tx: tiltX,
      ty: tiltY,
      t: Math.max(0, performance.now() - strokeStartWallRef.current),
    };
  };

  const hitTestSelectionHandle = (px: number, py: number): DragHandleType | null => {
    if (!selectionBounds || selectedIds.length === 0) return null;
    const pad = 6;
    const bx = selectionBounds.minX - pad;
    const by = selectionBounds.minY - pad;
    const bw = selectionBounds.maxX - selectionBounds.minX + pad * 2;
    const bh = selectionBounds.maxY - selectionBounds.minY + pad * 2;
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const rotY = by - 22 / zoom;
    const tol = 11 / zoom;

    const near = (hx: number, hy: number) => Math.hypot(px - hx, py - hy) <= tol;
    if (near(cx, rotY)) return 'rotate';
    if (near(bx, by)) return 'nw';
    if (near(cx, by)) return 'n';
    if (near(bx + bw, by)) return 'ne';
    if (near(bx + bw, cy)) return 'e';
    if (near(bx + bw, by + bh)) return 'se';
    if (near(cx, by + bh)) return 's';
    if (near(bx, by + bh)) return 'sw';
    if (near(bx, cy)) return 'w';

    if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
      return 'move';
    }
    return null;
  };

  // Conflict-free iPadOS Multi-Touch Gesture Recognizer (Pinch-Zoom, Pan, 2-Finger Undo, 3-Finger Redo, Long-Press)
  const gestureRecognizerRef = useRef<IPadGestureRecognizer | null>(null);
  if (!gestureRecognizerRef.current) {
    gestureRecognizerRef.current = new IPadGestureRecognizer({});
  }
  gestureRecognizerRef.current.updateCallbacks({
    onPinchAndPan: ({ targetZoom, panDeltaX, panDeltaY }) => {
      onZoomChange?.(targetZoom);
      onTwoFingerPan?.(panDeltaX, panDeltaY);
    },
    onTwoFingerTapUndo,
    onThreeFingerTapRedo,
    onPageSwipe,
    onLongPressContextMenu: ({ clientX, clientY }) => {
      const p = toPagePoint(clientX, clientY);
      const hitIds = selectObjectsWithLasso(
        page,
        [
          { x: p.x - 10, y: p.y - 10 },
          { x: p.x + 10, y: p.y + 10 },
        ],
        'rectangle',
        {
          strokes: true,
          shapes: true,
          textBoxes: true,
          images: true,
          stickers: true,
          tapes: true,
        }
      );
      if (hitIds.length > 0) {
        setSelectedIds([hitIds[hitIds.length - 1]]);
      }
    },
  });

  // Subscribe to Native Apple Pencil Hover telemetry when inside iOS/iPadOS shell
  useEffect(() => {
    return subscribeToNativeIOSEvents((evt) => {
      if (evt.type === 'pencilHover') {
        pencilHoverCursorRef.current = {
          x: evt.x,
          y: evt.y,
          zOffset: evt.zOffset,
        };
        if (!pointerDownRef.current) renderWetOverlay();
      }
    });
  }, [renderWetOverlay]);

  // --- POINTER HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const nowMs = performance.now();
    pencilHoverCursorRef.current = null;

    // Feed multi-touch / stylus sample into conflict-free iPadOS Gesture Engine
    gestureRecognizerRef.current?.onPointerDown(
      {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        clientX: e.clientX,
        clientY: e.clientY,
        timestampMs: nowMs,
      },
      zoom,
      readOnly || settings.stylusOnlyDrawing || activeTool === 'hand'
    );

    // If a second finger touches down right after a finger touch (< 95ms), cancel incipient 1-finger ink dot
    // and transition cleanly into 2-finger pinch/pan/undo gesture!
    if (
      e.pointerType === 'touch' &&
      (gestureRecognizerRef.current?.getActiveTouchCount() ?? 0) >= 2
    ) {
      if (pointerDownRef.current && activePointerTypeRef.current === 'touch') {
        pointerDownRef.current = false;
        activePointerIdRef.current = null;
        inFlightPointsRef.current = [];
        predictedPointsRef.current = [];
        lassoPointsRef.current = [];
        eraserWorkingPageRef.current = null;
        renderDryCanvas(page);
        renderWetOverlay();
      }
      return;
    }

    // Palm rejection: ignore finger touch drawing when Stylus-Only mode is enabled
    // OR while Apple Pencil is actively writing / within palm cooldown window
    if (
      e.pointerType === 'touch' &&
      (settings.stylusOnlyDrawing ||
        (settings.palmRejection && gestureRecognizerRef.current?.isStylusCurrentlyActive(nowMs)))
    ) {
      return;
    }

    const pt = toPagePoint(e.clientX, e.clientY, e.pressure, e.tiltX, e.tiltY);

    // 1. In Read/Study Mode (or tapping Tape in Tape mode): toggle Tape reveal OR jump to synced Audio timestamp!
    if (readOnly || activeTool === 'hand') {
      // Check tape strips first
      const tappedTape = [...page.tapes].reverse().find((tp) => {
        const minX = Math.min(tp.x1, tp.x2) - tp.width / 2;
        const maxX = Math.max(tp.x1, tp.x2) + tp.width / 2;
        const minY = Math.min(tp.y1, tp.y2) - tp.width / 2;
        const maxY = Math.max(tp.y1, tp.y2) + tp.width / 2;
        return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
      });
      if (tappedTape) {
        onCommitPageChange({
          ...page,
          tapes: page.tapes.map((tp) =>
            tp.id === tappedTape.id ? { ...tp, revealed: !tp.revealed, updatedAt: Date.now() } : tp
          ),
        });
        return;
      }

      // Check synced stroke for instant Audio Note Replay jump!
      if (onSeekAudioToMs) {
        const hitSyncedStroke = [...page.strokes]
          .reverse()
          .find(
            (s) =>
              s.audioSessionId &&
              s.audioOffsetMs !== undefined &&
              doesCircleHitStroke(pt.x, pt.y, 12, s)
          );
        if (hitSyncedStroke && hitSyncedStroke.audioSessionId && hitSyncedStroke.audioOffsetMs !== undefined) {
          onSeekAudioToMs(hitSyncedStroke.audioSessionId, hitSyncedStroke.audioOffsetMs);
        }
      }
      return;
    }

    // 2. Check if clicking an active selection handle/box when Lasso is active (or any selection exists)
    if (selectedIds.length > 0 && selectionBounds) {
      const handle = hitTestSelectionHandle(pt.x, pt.y);
      if (handle) {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointerDownRef.current = true;
        activePointerIdRef.current = e.pointerId;
        dragSelectionRef.current = {
          handle,
          startX: pt.x,
          startY: pt.y,
          basePage: page,
          initialBounds: selectionBounds,
        };
        return;
      } else if (activeTool === 'lasso') {
        setSelectedIds([]);
      }
    }

    // 3. Text Tool: click existing text box to edit OR create a new movable text box
    if (activeTool === 'text') {
      const hitText = [...page.textBoxes]
        .reverse()
        .find(
          (tb) =>
            !tb.locked &&
            pt.x >= tb.x &&
            pt.x <= tb.x + tb.width &&
            pt.y >= tb.y &&
            pt.y <= tb.y + tb.height
        );
      if (hitText) {
        setEditingTextId(hitText.id);
        setSelectedIds([hitText.id]);
        return;
      }

      const now = Date.now();
      const newTb: TextBoxObject = {
        id: createId('txt'),
        kind: 'textbox',
        layerId: effectiveLayerId,
        zIndex: getNextZIndex(page),
        x: Math.min(page.width - 230, Math.max(20, pt.x)),
        y: Math.min(page.height - 64, Math.max(20, pt.y - 12)),
        width: 240,
        height: 56,
        rotation: 0,
        text: '',
        fontFamily: 'Inter, -apple-system, sans-serif',
        fontSize: 16,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: strokeColor === '#F8FAFC' ? '#18181B' : strokeColor,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        align: 'left',
        lineHeight: 1.4,
        createdAt: now,
        updatedAt: now,
      };
      const nextPage: InkVaultPage = {
        ...page,
        textBoxes: [...page.textBoxes, newTb],
        updatedAt: now,
      };
      onCommitPageChange(nextPage);
      setEditingTextId(newTb.id);
      setSelectedIds([newTb.id]);
      return;
    }

    // 4. Tape Tool: tap an existing tape strip to toggle reveal/hide if not dragging
    if (activeTool === 'tape') {
      const tappedTape = [...page.tapes].reverse().find((tp) => {
        const minX = Math.min(tp.x1, tp.x2) - tp.width / 2;
        const maxX = Math.max(tp.x1, tp.x2) + tp.width / 2;
        const minY = Math.min(tp.y1, tp.y2) - tp.width / 2;
        const maxY = Math.max(tp.y1, tp.y2) + tp.width / 2;
        return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
      });
      if (tappedTape) {
        onCommitPageChange({
          ...page,
          tapes: page.tapes.map((tp) =>
            tp.id === tappedTape.id ? { ...tp, revealed: !tp.revealed, updatedAt: Date.now() } : tp
          ),
        });
        return;
      }
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDownRef.current = true;
    activePointerIdRef.current = e.pointerId;
    activePointerTypeRef.current = e.pointerType;
    strokeStartWallRef.current = performance.now();
    strokeAudioOffsetRef.current =
      activeRecordingSessionId && getRecordingOffsetMs ? getRecordingOffsetMs() : undefined;
    snappedShapePreviewRef.current = null;

    if (activeTool === 'eraser') {
      eraserCursorRef.current = { x: pt.x, y: pt.y };
      const res =
        eraserMode === 'pixel'
          ? applyPixelEraser(page, pt.x, pt.y, eraserRadius, eraserFilter)
          : applyStrokeEraser(page, pt.x, pt.y, eraserRadius, eraserFilter);
      eraserWorkingPageRef.current = res.nextPage;
      if (res.changed) renderDryCanvas(res.nextPage);
      renderWetOverlay();
      return;
    }

    if (activeTool === 'lasso') {
      lassoPointsRef.current = [{ x: pt.x, y: pt.y }];
      renderWetOverlay();
      return;
    }

    if (activeTool === 'laser') {
      laserTrailRef.current.push({ x: pt.x, y: pt.y, createdAt: Date.now() });
      renderWetOverlay();
      return;
    }

    // Pen / Highlighter / Pencil / Shape / Connector / Tape
    const projected = projectPointOntoRulerIfNear(pt.x, pt.y, ruler);
    inFlightPointsRef.current = [{ ...pt, x: projected.x, y: projected.y, t: 0 }];
    renderWetOverlay();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    gestureRecognizerRef.current?.onPointerMove({
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      clientX: e.clientX,
      clientY: e.clientY,
      timestampMs: performance.now(),
    });

    const rawPt = toPagePoint(e.clientX, e.clientY, e.pressure, e.tiltX, e.tiltY);

    if (!pointerDownRef.current) {
      if (activeTool === 'eraser') {
        eraserCursorRef.current = { x: rawPt.x, y: rawPt.y };
        renderWetOverlay();
        return;
      }
      if (e.pointerType === 'pen' && settings.pencilHoverPreview !== false) {
        pencilHoverCursorRef.current = { x: rawPt.x, y: rawPt.y, zOffset: 0.25 };
        renderWetOverlay();
        return;
      }
      return;
    }

    if (activePointerIdRef.current !== e.pointerId) return;

    // Transforming Lasso Selection
    if (dragSelectionRef.current) {
      const drag = dragSelectionRef.current;
      const ib = drag.initialBounds;
      const cx = (ib.minX + ib.maxX) / 2;
      const cy = (ib.minY + ib.maxY) / 2;
      const bw = Math.max(12, ib.maxX - ib.minX);
      const bh = Math.max(12, ib.maxY - ib.minY);

      let transformed = drag.basePage;
      if (drag.handle === 'move') {
        let dx = rawPt.x - drag.startX;
        let dy = rawPt.y - drag.startY;
        const candidateBounds = {
          minX: ib.minX + dx,
          minY: ib.minY + dy,
          maxX: ib.maxX + dx,
          maxY: ib.maxY + dy,
        };
        const snap = computeAlignmentGuides(
          drag.basePage,
          candidateBounds,
          new Set(selectedIds)
        );
        dx += snap.snapDx;
        dy += snap.snapDy;
        activeGuidesRef.current = snap.guides;
        transformed = transformPageObjects(drag.basePage, selectedIds, { dx, dy });
      } else if (drag.handle === 'rotate') {
        const a0 = Math.atan2(drag.startY - cy, drag.startX - cx);
        const a1 = Math.atan2(rawPt.y - cy, rawPt.x - cx);
        const rotateDeg = ((a1 - a0) * 180) / Math.PI;
        transformed = transformPageObjects(drag.basePage, selectedIds, {
          anchorX: cx,
          anchorY: cy,
          rotateDeg,
          keepStrokeWidth: settings.keepStrokeWidthOnResize,
        });
      } else {
        // Resize handles
        let scaleX = 1;
        let scaleY = 1;
        let anchorX = cx;
        let anchorY = cy;
        if (drag.handle.includes('e')) {
          anchorX = ib.minX;
          scaleX = Math.max(0.15, (rawPt.x - ib.minX) / bw);
        } else if (drag.handle.includes('w')) {
          anchorX = ib.maxX;
          scaleX = Math.max(0.15, (ib.maxX - rawPt.x) / bw);
        }
        if (drag.handle.includes('s')) {
          anchorY = ib.minY;
          scaleY = Math.max(0.15, (rawPt.y - ib.minY) / bh);
        } else if (drag.handle.includes('n')) {
          anchorY = ib.maxY;
          scaleY = Math.max(0.15, (ib.maxY - rawPt.y) / bh);
        }
        transformed = transformPageObjects(drag.basePage, selectedIds, {
          scaleX,
          scaleY,
          anchorX,
          anchorY,
          keepStrokeWidth: settings.keepStrokeWidthOnResize,
        });
      }

      eraserWorkingPageRef.current = transformed;
      renderDryCanvas(transformed);
      renderWetOverlay();
      return;
    }

    if (activeTool === 'eraser') {
      eraserCursorRef.current = { x: rawPt.x, y: rawPt.y };
      const base = eraserWorkingPageRef.current ?? page;
      const res =
        eraserMode === 'pixel'
          ? applyPixelEraser(base, rawPt.x, rawPt.y, eraserRadius, eraserFilter)
          : applyStrokeEraser(base, rawPt.x, rawPt.y, eraserRadius, eraserFilter);
      eraserWorkingPageRef.current = res.nextPage;
      if (res.changed) renderDryCanvas(res.nextPage);
      renderWetOverlay();
      return;
    }

    if (activeTool === 'lasso') {
      lassoPointsRef.current.push({ x: rawPt.x, y: rawPt.y });
      renderWetOverlay();
      return;
    }

    if (activeTool === 'laser') {
      laserTrailRef.current.push({ x: rawPt.x, y: rawPt.y, createdAt: Date.now() });
      renderWetOverlay();
      return;
    }

    // Collect high-frequency coalesced stylus events (120Hz/240Hz Apple Pencil ProMotion!)
    const nativeEvt = e.nativeEvent as PointerEvent;
    const coalesced =
      typeof nativeEvt.getCoalescedEvents === 'function'
        ? nativeEvt.getCoalescedEvents()
        : [nativeEvt];

    for (const ce of coalesced) {
      const sample = toPagePoint(ce.clientX, ce.clientY, ce.pressure, ce.tiltX, ce.tiltY);
      const projected = projectPointOntoRulerIfNear(sample.x, sample.y, ruler);
      const px = projected.x;
      const py = projected.y;
      const prev = inFlightPointsRef.current[inFlightPointsRef.current.length - 1];
      if (!prev || Math.hypot(px - prev.x, py - prev.y) >= 0.9) {
        inFlightPointsRef.current.push({ ...sample, x: px, y: py });
      }
    }

    // Transiently sample hardware stylus predicted points to cut ink-to-glass latency
    if (typeof nativeEvt.getPredictedEvents === 'function') {
      predictedPointsRef.current = nativeEvt
        .getPredictedEvents()
        .slice(0, 2)
        .map((pe) => toPagePoint(pe.clientX, pe.clientY, pe.pressure, pe.tiltX, pe.tiltY));
    } else {
      predictedPointsRef.current = [];
    }

    // Straight-line Highlighter or dedicated Straight Underline tool
    if (
      ((activeTool === 'highlighter' && settings.straightHighlighter) ||
        activeTool === 'underline') &&
      inFlightPointsRef.current.length >= 2
    ) {
      const first = inFlightPointsRef.current[0];
      const last = inFlightPointsRef.current[inFlightPointsRef.current.length - 1];
      const dx = Math.abs(last.x - first.x);
      const dy = Math.abs(last.y - first.y);
      const snappedLast =
        dx > 12 && dy < dx * 0.16 ? { ...last, y: first.y } : last;
      inFlightPointsRef.current = [first, snappedLast];
      predictedPointsRef.current = [];
    }

    // Draw-and-Hold automatic shape recognition timer for Pen
    if (activeTool === 'pen' && settings.drawAndHoldShapes && !ruler.visible) {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (!snappedShapePreviewRef.current && inFlightPointsRef.current.length >= 8) {
        holdTimerRef.current = setTimeout(() => {
          const recognized = recognizeShapeFromPoints(
            inFlightPointsRef.current,
            effectiveLayerId,
            getNextZIndex(page),
            strokeColor,
            strokeWidth
          );
          if (recognized) {
            snappedShapePreviewRef.current = recognized;
            renderWetOverlay();
          }
        }, 420);
      }
    }

    renderWetOverlay();
  };

  const finishPointerInteraction = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      gestureRecognizerRef.current?.onPointerUpOrCancel(
        {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          clientX: e.clientX,
          clientY: e.clientY,
          timestampMs: performance.now(),
        },
        (readOnly || settings.stylusOnlyDrawing || activeTool === 'hand') && zoom <= 1.05
      );
    }

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!pointerDownRef.current) return;
    if (e && activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
      return;
    }
    pointerDownRef.current = false;
    activePointerIdRef.current = null;
    activeGuidesRef.current = [];

    // 1. Commit Selection Transform
    if (dragSelectionRef.current) {
      dragSelectionRef.current = null;
      if (eraserWorkingPageRef.current && eraserWorkingPageRef.current !== page) {
        onCommitPageChange(eraserWorkingPageRef.current);
      }
      eraserWorkingPageRef.current = null;
      renderWetOverlay();
      return;
    }

    // 2. Commit Eraser Pass
    if (activeTool === 'eraser') {
      if (eraserWorkingPageRef.current && eraserWorkingPageRef.current !== page) {
        onCommitPageChange(eraserWorkingPageRef.current);
      }
      eraserWorkingPageRef.current = null;
      if (settings.eraserAutoDeselect && onAutoDeselectEraser) {
        onAutoDeselectEraser();
      }
      renderWetOverlay();
      return;
    }

    // 3. Complete Lasso Selection
    if (activeTool === 'lasso') {
      const poly = lassoPointsRef.current;
      lassoPointsRef.current = [];
      if (poly.length >= 3 || (lassoMode === 'rectangle' && poly.length >= 2)) {
        const matched = selectObjectsWithLasso(page, poly, lassoMode, lassoFilter);
        setSelectedIds(matched);
      }
      renderWetOverlay();
      return;
    }

    if (activeTool === 'laser') {
      inFlightPointsRef.current = [];
      return;
    }

    const rawPoints = inFlightPointsRef.current;
    inFlightPointsRef.current = [];
    predictedPointsRef.current = [];
    const now = Date.now();

    // 4. Commit Draw-and-Hold Snapped Shape
    if (snappedShapePreviewRef.current) {
      const snapped = snappedShapePreviewRef.current;
      snappedShapePreviewRef.current = null;
      onCommitPageChange({
        ...page,
        shapes: [...page.shapes, snapped],
        updatedAt: now,
      });
      renderWetOverlay();
      return;
    }

    if (rawPoints.length === 0) return;

    // 5. Dedicated Shape Tool
    if (activeTool === 'shape' && rawPoints.length >= 2) {
      const p0 = rawPoints[0];
      const pLast = rawPoints[rawPoints.length - 1];
      if (Math.hypot(pLast.x - p0.x, pLast.y - p0.y) >= 6) {
        const newShape: ShapeObject = {
          id: createId('shp'),
          kind: 'shape',
          shapeType: shapeKind,
          layerId: effectiveLayerId,
          zIndex: getNextZIndex(page),
          x: Math.min(p0.x, pLast.x),
          y: Math.min(p0.y, pLast.y),
          width: Math.max(8, Math.abs(pLast.x - p0.x)),
          height: Math.max(8, Math.abs(pLast.y - p0.y)),
          x1: p0.x,
          y1: p0.y,
          x2: pLast.x,
          y2: pLast.y,
          rotation: 0,
          strokeColor,
          fillColor: strokeColor,
          fillOpacity: 0.06,
          strokeWidth,
          createdAt: now,
          updatedAt: now,
        };
        onCommitPageChange({
          ...page,
          shapes: [...page.shapes, newShape],
          updatedAt: now,
        });
      }
      renderWetOverlay();
      return;
    }

    // 6. Dedicated Diagram Connector Tool
    if (activeTool === 'connector' && rawPoints.length >= 2) {
      const p0 = rawPoints[0];
      const pLast = rawPoints[rawPoints.length - 1];
      if (Math.hypot(pLast.x - p0.x, pLast.y - p0.y) >= 8) {
        // Bind endpoints to underlying shape/textbox if started/ended inside one!
        const hitAt = (px: number, py: number) =>
          [...page.shapes, ...page.textBoxes].find((o) => {
            const b = getObjectBounds(o);
            return px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY;
          });
        const fromObj = hitAt(p0.x, p0.y);
        const toObj = hitAt(pLast.x, pLast.y);
        const newConn: ConnectorObject = {
          id: createId('con'),
          kind: 'connector',
          fromObjectId: fromObj?.id,
          toObjectId: toObj && toObj.id !== fromObj?.id ? toObj.id : undefined,
          layerId: effectiveLayerId,
          zIndex: getNextZIndex(page),
          x1: p0.x,
          y1: p0.y,
          x2: pLast.x,
          y2: pLast.y,
          strokeColor,
          strokeWidth,
          routing: connectorRouting,
          arrowEnd: true,
          createdAt: now,
          updatedAt: now,
        };
        onCommitPageChange({
          ...page,
          connectors: [...page.connectors, newConn],
          updatedAt: now,
        });
      }
      renderWetOverlay();
      return;
    }

    // 7. Active Recall Tape Strip
    if (activeTool === 'tape' && rawPoints.length >= 2) {
      const p0 = rawPoints[0];
      const pLast = rawPoints[rawPoints.length - 1];
      if (Math.hypot(pLast.x - p0.x, pLast.y - p0.y) >= 8) {
        const newTape: TapeObject = {
          id: createId('tap'),
          kind: 'tape',
          layerId: effectiveLayerId,
          zIndex: getNextZIndex(page),
          x1: p0.x,
          y1: p0.y,
          x2: pLast.x,
          y2: pLast.y,
          width: tapeWidth,
          color: tapeColor,
          revealed: false,
          createdAt: now,
          updatedAt: now,
        };
        onCommitPageChange({
          ...page,
          tapes: [...page.tapes, newTape],
          updatedAt: now,
        });
      }
      renderWetOverlay();
      return;
    }

    // 8. Commit Digital Ink Stroke (Pen / Pencil / Highlighter / Underline)
    if (
      activeTool === 'pen' ||
      activeTool === 'pencil' ||
      activeTool === 'highlighter' ||
      activeTool === 'underline'
    ) {
      const inst: PenInstrument =
        activeTool === 'highlighter'
          ? 'highlighter'
          : activeTool === 'pencil'
          ? 'pencil'
          : activeTool === 'underline'
          ? 'fineliner'
          : activeInstrument;
      const smoothed =
        activeTool === 'underline'
          ? rawPoints
          : smoothInkPoints(rawPoints, settings.penSmoothing);
      const newStroke: InkStroke = {
        id: createId('stk'),
        kind: 'stroke',
        layerId: effectiveLayerId,
        zIndex: getNextZIndex(page),
        instrument: inst,
        color: strokeColor,
        width: activeTool === 'underline' ? Math.max(1.5, Math.min(4.5, strokeWidth)) : strokeWidth,
        opacity: inst === 'highlighter' ? Math.min(0.4, strokeOpacity) : strokeOpacity,
        smoothing: settings.penSmoothing,
        pressureSensitivity: activeTool === 'underline' ? 0 : settings.pressureSensitivity,
        tipSharpness: settings.tipSharpness,
        points: smoothed,
        audioSessionId: activeRecordingSessionId ?? undefined,
        audioOffsetMs: strokeAudioOffsetRef.current,
        createdAt: now,
        updatedAt: now,
      };
      onCommitPageChange({
        ...page,
        strokes: [...page.strokes, newStroke],
        updatedAt: now,
      });
      renderWetOverlay();
    }
  };

  // --- UNIVERSAL OBJECT MENU ACTIONS ---
  const deleteSelection = () => {
    const idSet = new Set(selectedIds);
    onCommitPageChange({
      ...page,
      strokes: page.strokes.filter((x) => !idSet.has(x.id) || x.locked),
      shapes: page.shapes.filter((x) => !idSet.has(x.id) || x.locked),
      connectors: page.connectors.filter((x) => !idSet.has(x.id) || x.locked),
      textBoxes: page.textBoxes.filter((x) => !idSet.has(x.id) || x.locked),
      images: page.images.filter((x) => !idSet.has(x.id) || x.locked),
      stickers: page.stickers.filter((x) => !idSet.has(x.id) || x.locked),
      tapes: page.tapes.filter((x) => !idSet.has(x.id) || x.locked),
      updatedAt: Date.now(),
    });
    setSelectedIds([]);
  };

  const recolorSelection = (newColor: string) => {
    const idSet = new Set(selectedIds);
    onCommitPageChange({
      ...page,
      strokes: page.strokes.map((s) => (idSet.has(s.id) && !s.locked ? { ...s, color: newColor } : s)),
      shapes: page.shapes.map((s) =>
        idSet.has(s.id) && !s.locked ? { ...s, strokeColor: newColor, fillColor: newColor } : s
      ),
      connectors: page.connectors.map((c) =>
        idSet.has(c.id) && !c.locked ? { ...c, strokeColor: newColor } : c
      ),
      textBoxes: page.textBoxes.map((t) =>
        idSet.has(t.id) && !t.locked ? { ...t, color: newColor } : t
      ),
      updatedAt: Date.now(),
    });
  };

  const toggleLockSelection = () => {
    const idSet = new Set(selectedIds);
    const anyUnlocked = selectedObjects.some((o) => !o.locked);
    const nextLock = anyUnlocked;
    const apply = <T extends EditablePageObject>(arr: T[]) =>
      arr.map((o) => (idSet.has(o.id) ? { ...o, locked: nextLock } : o));
    onCommitPageChange({
      ...page,
      strokes: apply(page.strokes),
      shapes: apply(page.shapes),
      connectors: apply(page.connectors),
      textBoxes: apply(page.textBoxes),
      images: apply(page.images),
      stickers: apply(page.stickers),
      tapes: apply(page.tapes),
      updatedAt: Date.now(),
    });
  };

  const toggleGroupSelection = () => {
    const idSet = new Set(selectedIds);
    const existingGroups = new Set(selectedObjects.map((o) => o.groupId).filter(Boolean));
    const shouldUngroup = existingGroups.size === 1 && selectedObjects.every((o) => Boolean(o.groupId));
    const nextGroupId = shouldUngroup ? undefined : createId('grp');
    const apply = <T extends EditablePageObject>(arr: T[]) =>
      arr.map((o) => (idSet.has(o.id) ? { ...o, groupId: nextGroupId } : o));
    onCommitPageChange({
      ...page,
      strokes: apply(page.strokes),
      shapes: apply(page.shapes),
      connectors: apply(page.connectors),
      textBoxes: apply(page.textBoxes),
      images: apply(page.images),
      stickers: apply(page.stickers),
      tapes: apply(page.tapes),
      updatedAt: Date.now(),
    });
  };

  const shiftZOrder = (direction: 'front' | 'back') => {
    const idSet = new Set(selectedIds);
    const maxZ = getNextZIndex(page);
    const apply = <T extends EditablePageObject>(arr: T[]) =>
      arr.map((o) =>
        idSet.has(o.id)
          ? { ...o, zIndex: direction === 'front' ? maxZ + o.zIndex : Math.min(-1, o.zIndex - maxZ) }
          : o
      );
    onCommitPageChange({
      ...page,
      strokes: apply(page.strokes),
      shapes: apply(page.shapes),
      connectors: apply(page.connectors),
      textBoxes: apply(page.textBoxes),
      images: apply(page.images),
      stickers: apply(page.stickers),
      tapes: apply(page.tapes),
      updatedAt: Date.now(),
    });
  };

  const captureSelectionSnapshotDataUrl = (): string => {
    if (!selectionBounds || !dryCanvasRef.current) return '';
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const scale = dpr * zoom;
    const sx = Math.max(0, Math.floor((selectionBounds.minX - 8) * scale));
    const sy = Math.max(0, Math.floor((selectionBounds.minY - 8) * scale));
    const sw = Math.max(16, Math.ceil((selectionBounds.maxX - selectionBounds.minX + 16) * scale));
    const sh = Math.max(16, Math.ceil((selectionBounds.maxY - selectionBounds.minY + 16) * scale));
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const octx = out.getContext('2d');
    if (octx) {
      octx.fillStyle = '#FFFFFF';
      octx.fillRect(0, 0, sw, sh);
      octx.drawImage(dryCanvasRef.current, sx, sy, sw, sh, 0, 0, sw, sh);
    }
    return out.toDataURL('image/png');
  };

  const editingTextBox = editingTextId
    ? page.textBoxes.find((tb) => tb.id === editingTextId)
    : undefined;

  return (
    <div
      className="iv-ink-stage"
      style={{
        position: 'relative',
        width: page.width * zoom,
        height: page.height * zoom,
        boxShadow: 'var(--iv-shadow-page)',
        borderRadius: 2,
        background: '#FFFFFF',
        flexShrink: 0,
      }}
    >
      {/* Committed Dry Layer Canvas */}
      <canvas
        ref={dryCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: page.width * zoom,
          height: page.height * zoom,
          pointerEvents: 'none',
        }}
      />

      {/* Active Wet-Ink & Selection Overlay Canvas */}
      <canvas
        ref={wetCanvasRef}
        data-testid="ink-stage-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={finishPointerInteraction}
        onPointerLeave={() => {
          eraserCursorRef.current = null;
          pencilHoverCursorRef.current = null;
          if (!pointerDownRef.current) renderWetOverlay();
        }}
        onDoubleClick={(e) => {
          const pt = toPagePoint(e.clientX, e.clientY);
          const hitTb = page.textBoxes.find(
            (tb) => pt.x >= tb.x && pt.x <= tb.x + tb.width && pt.y >= tb.y && pt.y <= tb.y + tb.height
          );
          if (hitTb && !hitTb.locked) {
            setEditingTextId(hitTb.id);
            setSelectedIds([hitTb.id]);
          }
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: page.width * zoom,
          height: page.height * zoom,
          cursor: readOnly
            ? 'default'
            : activeTool === 'text'
            ? 'text'
            : activeTool === 'lasso'
            ? 'crosshair'
            : activeTool === 'hand'
            ? 'grab'
            : 'crosshair',
        }}
      />

      {/* Live Inline Rich Text Box Editor */}
      {editingTextBox && (
        <div
          style={{
            position: 'absolute',
            left: editingTextBox.x * zoom,
            top: editingTextBox.y * zoom,
            width: Math.max(160, editingTextBox.width * zoom),
            minHeight: Math.max(44, editingTextBox.height * zoom),
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 6px',
              borderRadius: 5,
              background: 'var(--iv-bg-elevated)',
              border: '1px solid var(--iv-border)',
              boxShadow: 'var(--iv-shadow-sm)',
              fontSize: 11,
            }}
          >
            <select
              className="iv-select"
              style={{ height: 22, fontSize: 11, padding: '0 4px' }}
              value={editingTextBox.fontSize}
              onChange={(e) => {
                const sz = Number(e.target.value);
                onCommitPageChange({
                  ...page,
                  textBoxes: page.textBoxes.map((t) =>
                    t.id === editingTextBox.id ? { ...t, fontSize: sz } : t
                  ),
                });
              }}
            >
              {[12, 14, 16, 18, 22, 28, 36].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}px
                </option>
              ))}
            </select>
            <button
              type="button"
              className="iv-btn"
              style={{
                height: 22,
                padding: '0 6px',
                fontWeight: 700,
                background: editingTextBox.fontWeight === '700' ? 'var(--iv-accent-soft)' : undefined,
              }}
              onClick={() =>
                onCommitPageChange({
                  ...page,
                  textBoxes: page.textBoxes.map((t) =>
                    t.id === editingTextBox.id
                      ? { ...t, fontWeight: t.fontWeight === '700' ? 'normal' : '700' }
                      : t
                  ),
                })
              }
            >
              B
            </button>
            <button
              type="button"
              className="iv-btn"
              style={{
                height: 22,
                padding: '0 6px',
                fontStyle: 'italic',
                background: editingTextBox.fontStyle === 'italic' ? 'var(--iv-accent-soft)' : undefined,
              }}
              onClick={() =>
                onCommitPageChange({
                  ...page,
                  textBoxes: page.textBoxes.map((t) =>
                    t.id === editingTextBox.id
                      ? { ...t, fontStyle: t.fontStyle === 'italic' ? 'normal' : 'italic' }
                      : t
                  ),
                })
              }
            >
              I
            </button>
            <button
              type="button"
              className="iv-btn"
              style={{ height: 22, padding: '0 6px', fontSize: 10 }}
              title="Toggle sticky callout tint"
              onClick={() =>
                onCommitPageChange({
                  ...page,
                  textBoxes: page.textBoxes.map((t) =>
                    t.id === editingTextBox.id
                      ? {
                          ...t,
                          backgroundColor:
                            t.backgroundColor === 'transparent' ? '#FEF9C3' : 'transparent',
                          borderColor:
                            t.borderColor === 'transparent' ? '#FACC15' : 'transparent',
                        }
                      : t
                  ),
                })
              }
            >
              Note Fill
            </button>
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              style={{ height: 22, padding: '0 8px', fontSize: 10, marginLeft: 'auto' }}
              onClick={() => setEditingTextId(null)}
            >
              Done
            </button>
          </div>
          <textarea
            value={editingTextBox.text}
            placeholder="Type note..."
            autoFocus
            onChange={(e) => {
              const val = e.target.value;
              const lines = Math.max(2, val.split('\n').length + 1);
              const autoHeight = Math.max(
                editingTextBox.height,
                lines * editingTextBox.fontSize * 1.45 + 14
              );
              onCommitPageChange({
                ...page,
                textBoxes: page.textBoxes.map((t) =>
                  t.id === editingTextBox.id ? { ...t, text: val, height: autoHeight } : t
                ),
              });
            }}
            onBlur={() => {
              if (!editingTextBox.text.trim()) {
                onCommitPageChange({
                  ...page,
                  textBoxes: page.textBoxes.filter((t) => t.id !== editingTextBox.id),
                });
                setEditingTextId(null);
              }
            }}
            style={{
              width: '100%',
              minHeight: editingTextBox.height * zoom,
              padding: 6,
              border: '1.5px solid var(--iv-accent)',
              borderRadius: 4,
              background:
                editingTextBox.backgroundColor === 'transparent'
                  ? 'rgba(255,255,255,0.95)'
                  : editingTextBox.backgroundColor,
              color: editingTextBox.color,
              fontSize: editingTextBox.fontSize * zoom,
              fontWeight: editingTextBox.fontWeight,
              fontStyle: editingTextBox.fontStyle,
              lineHeight: editingTextBox.lineHeight || 1.4,
              resize: 'both',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Interactive Graduated Snap Ruler Overlay */}
      {ruler.visible && !readOnly && (
        <div
          data-testid="canvas-ruler"
          onWheel={(e) => {
            e.preventDefault();
            onRulerChange({
              ...ruler,
              angleDeg: Math.round(((ruler.angleDeg + (e.deltaY > 0 ? 2 : -2)) % 360 + 360) % 360),
            });
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            rulerDragRef.current = {
              mode: 'move',
              startX: e.clientX,
              startY: e.clientY,
              origX: ruler.x,
              origY: ruler.y,
              origAngle: ruler.angleDeg,
            };
          }}
          onPointerMove={(e) => {
            if (!rulerDragRef.current) return;
            e.stopPropagation();
            const d = rulerDragRef.current;
            if (d.mode === 'move') {
              onRulerChange({
                ...ruler,
                x: d.origX + (e.clientX - d.startX) / zoom,
                y: d.origY + (e.clientY - d.startY) / zoom,
              });
            } else {
              const cx = ruler.x * zoom;
              const cy = ruler.y * zoom;
              const rect = wetCanvasRef.current?.getBoundingClientRect();
              if (rect) {
                const ang =
                  (Math.atan2(e.clientY - (rect.top + cy), e.clientX - (rect.left + cx)) * 180) /
                  Math.PI;
                onRulerChange({
                  ...ruler,
                  angleDeg: Math.round(((ang % 360) + 360) % 360),
                });
              }
            }
          }}
          onPointerUp={() => {
            rulerDragRef.current = null;
          }}
          style={{
            position: 'absolute',
            left: (ruler.x - ruler.length / 2) * zoom,
            top: (ruler.y - ruler.thickness / 2) * zoom,
            width: ruler.length * zoom,
            height: ruler.thickness * zoom,
            transform: `rotate(${ruler.angleDeg}deg)`,
            transformOrigin: 'center center',
            background: 'rgba(248, 250, 252, 0.84)',
            backdropFilter: 'blur(4px)',
            border: '1.5px solid #475569',
            borderRadius: 4,
            boxShadow: '0 6px 18px rgba(15, 23, 42, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px',
            cursor: 'move',
            zIndex: 20,
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(51,65,85,0.45) 0, rgba(51,65,85,0.45) 1px, transparent 1px, transparent 12px)',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--iv-font-mono)',
              fontWeight: 700,
              color: '#1E293B',
              background: 'rgba(255,255,255,0.88)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {ruler.angleDeg}°
          </span>

          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 45, 90].map((deg) => (
              <button
                key={deg}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRulerChange({ ...ruler, angleDeg: deg });
                }}
                style={{
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#1E293B',
                  fontSize: 10,
                  borderRadius: 3,
                  padding: '1px 5px',
                  cursor: 'pointer',
                }}
              >
                {deg}°
              </button>
            ))}
          </div>

          <button
            type="button"
            title="Drag to rotate ruler"
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.currentTarget.parentElement as HTMLElement)?.setPointerCapture(e.pointerId);
              rulerDragRef.current = {
                mode: 'rotate',
                startX: e.clientX,
                startY: e.clientY,
                origX: ruler.x,
                origY: ruler.y,
                origAngle: ruler.angleDeg,
              };
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '1.5px solid #2563EB',
              background: '#EFF6FF',
              color: '#1D4ED8',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'grab',
            }}
          >
            ↻
          </button>
        </div>
      )}

      {/* Floating Universal Object Menu above Lasso Selection */}
      {selectionBounds && selectedIds.length > 0 && !editingTextId && !readOnly && (
        <div
          data-testid="universal-object-menu"
          style={{
            position: 'absolute',
            left: Math.max(8, Math.min(page.width * zoom - 340, selectionBounds.minX * zoom)),
            top: Math.max(8, selectionBounds.minY * zoom - 48),
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '4px 6px',
            borderRadius: 'var(--iv-radius-md)',
            background: 'var(--iv-bg-elevated)',
            border: '1px solid var(--iv-border)',
            boxShadow: 'var(--iv-shadow-md)',
            zIndex: 35,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 28, height: 28 }}
            title="Copy selection"
            onClick={() => onCopySelection(selectedObjects)}
          >
            <Copy size={14} />
          </button>

          {settings.quickColors.slice(0, 4).map((hex) => (
            <button
              key={hex}
              type="button"
              title={`Recolor ${hex}`}
              onClick={() => recolorSelection(hex)}
              style={{
                width: 15,
                height: 15,
                borderRadius: '50%',
                background: hex,
                border: '1px solid rgba(0,0,0,0.2)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}

          {selectedObjects.length >= 2 && (
            <button
              type="button"
              className="iv-icon-btn"
              style={{ width: 28, height: 28 }}
              title="Group / Ungroup objects"
              onClick={toggleGroupSelection}
            >
              {selectedObjects.every((o) => Boolean(o.groupId)) ? (
                <Ungroup size={14} />
              ) : (
                <Group size={14} />
              )}
            </button>
          )}

          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 28, height: 28 }}
            title={selectedObjects.some((o) => o.locked) ? 'Unlock objects' : 'Lock objects'}
            onClick={toggleLockSelection}
          >
            {selectedObjects.some((o) => o.locked) ? <Unlock size={14} /> : <Lock size={14} />}
          </button>

          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 28, height: 28 }}
            title="Bring to front"
            onClick={() => shiftZOrder('front')}
          >
            <ArrowUpToLine size={14} />
          </button>
          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 28, height: 28 }}
            title="Send to back"
            onClick={() => shiftZOrder('back')}
          >
            <ArrowDownToLine size={14} />
          </button>

          {allPages.length > 1 && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="iv-icon-btn"
                style={{ width: 28, height: 28 }}
                title="Move selection to another page"
                onClick={() => setMovePageDropdownOpen((v) => !v)}
              >
                <ArrowRightLeft size={14} />
              </button>
              {movePageDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 32,
                    left: 0,
                    minWidth: 136,
                    maxHeight: 180,
                    overflowY: 'auto',
                    background: 'var(--iv-bg-elevated)',
                    border: '1px solid var(--iv-border)',
                    borderRadius: 6,
                    boxShadow: 'var(--iv-shadow-md)',
                    padding: 4,
                    zIndex: 50,
                  }}
                >
                  {allPages.map((tp, idx) => {
                    if (tp.id === page.id) return null;
                    return (
                      <button
                        key={tp.id}
                        type="button"
                        className="iv-btn iv-btn-ghost"
                        style={{ width: '100%', justifyContent: 'flex-start', height: 26, fontSize: 12 }}
                        onClick={() => {
                          onMoveSelectionToPage(tp.id, selectedIds);
                          setSelectedIds([]);
                          setMovePageDropdownOpen(false);
                        }}
                      >
                        Move to Page {idx + 1}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="iv-btn iv-btn-ghost"
            style={{ height: 26, padding: '0 6px', fontSize: 11 }}
            title="Convert handwriting to editable text box"
            onClick={() => {
              onConvertSelectionToText(selectedObjects, {
                x: selectionBounds.minX,
                y: selectionBounds.minY,
                w: Math.max(120, selectionBounds.maxX - selectionBounds.minX),
                h: Math.max(44, selectionBounds.maxY - selectionBounds.minY),
              });
              setSelectedIds([]);
            }}
          >
            <FileType size={13} />
            To Text
          </button>

          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 28, height: 28 }}
            title="Extract selection to Flashcard"
            onClick={() =>
              onExtractSelectionToFlashcard(selectedObjects, captureSelectionSnapshotDataUrl())
            }
          >
            <GraduationCap size={14} />
          </button>

          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 28, height: 28 }}
            title="Save selection as reusable Sticker Element"
            onClick={() =>
              onSaveSelectionAsSticker(selectedObjects, captureSelectionSnapshotDataUrl())
            }
          >
            <Sparkles size={14} />
          </button>

          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 28, height: 28, color: 'var(--iv-danger)' }}
            title="Delete selection"
            onClick={deleteSelection}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
