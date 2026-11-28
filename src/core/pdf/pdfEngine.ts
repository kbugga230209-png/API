import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {
  createId,
  createNotebook,
  createPage,
  touchDocument,
} from '../model/documentModel';
import { PAPER_COLORS } from '../model/templates';
import {
  InkVaultDocument,
  InkVaultPage,
  OutlineNode,
} from '../model/types';
import { base64ToUint8, uint8ToBase64 } from '../storage/cryptoVault';
import { InkVaultStorageEngine } from '../storage/storageEngine';

// Configure pdfjs worker safely for Vite browser runtime, iPadOS custom WKURLSchemeHandler (`inkvault://`), and Vitest Node/jsdom
let pdfWorkerConfigured = false;
let pdfWorkerInitPromise: Promise<void> | null = null;

async function ensurePdfWorkerConfigured(): Promise<void> {
  if (pdfWorkerConfigured) {
    if (pdfWorkerInitPromise) await pdfWorkerInitPromise;
    return;
  }
  pdfWorkerConfigured = true;

  pdfWorkerInitPromise = (async () => {
    try {
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        const rawWorkerUrl = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

        // WebKit restricts `new Worker('inkvault://...')` directly on custom URL schemes;
        // wrapping the bundled worker script in a same-origin Blob URL unlocks full Worker acceleration on iOS!
        if (window.location?.protocol === 'inkvault:' && typeof fetch === 'function') {
          const res = await fetch(rawWorkerUrl);
          if (res.ok) {
            const scriptText = await res.text();
            const blob = new Blob([scriptText], { type: 'text/javascript' });
            pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
            return;
          }
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = rawWorkerUrl;
      }
    } catch {
      // Fallback to fake worker in test / restricted environments
    }
  })();

  await pdfWorkerInitPromise;
}

async function openPdfJsDoc(bytes: Uint8Array) {
  await ensurePdfWorkerConfigured();
  const copy = new Uint8Array(bytes);
  const task = pdfjsLib.getDocument({
    data: copy,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  return task.promise;
}

export interface ParsedPdfImportResult {
  assetId: string;
  pages: InkVaultPage[];
  outline: OutlineNode[];
  pageCount: number;
  hasEmbeddedText: boolean;
}

/**
 * Parses a real PDF file via `pdfjs-dist` (falling back gracefully to `pdf-lib` page dimension inspection
 * if a headless environment lacks OffscreenCanvas/Worker APIs), extracts embedded text & outlines,
 * and constructs editable INKVAULT pages.
 */
export async function parsePdfIntoPages(
  pdfBytes: Uint8Array,
  fileName: string,
  storage: InkVaultStorageEngine
): Promise<ParsedPdfImportResult> {
  const asset = await storage.storeBinaryAsset(pdfBytes, 'application/pdf', fileName);
  const pages: InkVaultPage[] = [];
  const outline: OutlineNode[] = [];
  let hasEmbeddedText = false;

  try {
    const pdfDoc = await openPdfJsDoc(pdfBytes);
    const numPages = pdfDoc.numPages;

    for (let i = 1; i <= numPages; i++) {
      const pdfPage = await pdfDoc.getPage(i);
      const viewport = pdfPage.getViewport({ scale: 1.25 });
      let extractedText = '';
      try {
        const textContent = await pdfPage.getTextContent();
        extractedText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (extractedText.length > 0) hasEmbeddedText = true;
      } catch {
        // Ignore text extraction error on malformed font stream
      }

      const w = Math.round(viewport.width) || 794;
      const h = Math.round(viewport.height) || 1123;
      const page = createPage({
        sizeId: w > h ? 'wide-slide' : 'a4',
        orientation: w > h ? 'landscape' : 'portrait',
        width: w,
        height: h,
        backgroundOverride: {
          type: 'pdf',
          pdfAssetId: asset.id,
          pdfPageNumber: i,
          templateId: 'blank',
          paperColor: 'white',
        },
      });
      page.pdfText = extractedText;
      pages.push(page);
    }

    // Extract native PDF outlines if present
    try {
      const rawOutline = await pdfDoc.getOutline();
      if (rawOutline && rawOutline.length > 0) {
        for (const item of rawOutline) {
          let targetPageIdx = 0;
          try {
            if (item.dest) {
              const dest =
                typeof item.dest === 'string' ? await pdfDoc.getDestination(item.dest) : item.dest;
              if (Array.isArray(dest) && dest[0]) {
                targetPageIdx = await pdfDoc.getPageIndex(dest[0]);
              }
            }
          } catch {
            targetPageIdx = 0;
          }
          const matchedPage = pages[targetPageIdx] ?? pages[0];
          if (matchedPage) {
            outline.push({
              id: createId('out'),
              title: item.title || `Section ${outline.length + 1}`,
              pageId: matchedPage.id,
              level: 0,
            });
          }
        }
      }
    } catch {
      // Ignore outline extraction failure
    }
  } catch {
    // Fallback to pdf-lib structural inspection in minimal JS environments
    const libDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const libPages = libDoc.getPages();
    libPages.forEach((lp, idx) => {
      const { width, height } = lp.getSize();
      const w = Math.round(width * 1.25) || 794;
      const h = Math.round(height * 1.25) || 1123;
      const page = createPage({
        sizeId: w > h ? 'wide-slide' : 'a4',
        orientation: w > h ? 'landscape' : 'portrait',
        width: w,
        height: h,
        backgroundOverride: {
          type: 'pdf',
          pdfAssetId: asset.id,
          pdfPageNumber: idx + 1,
          templateId: 'blank',
          paperColor: 'white',
        },
      });
      pages.push(page);
    });
  }

  return {
    assetId: asset.id,
    pages,
    outline,
    pageCount: pages.length,
    hasEmbeddedText,
  };
}

/**
 * Creates a full editable InkVaultDocument from an imported PDF file.
 */
export async function importPdfAsNotebook(
  pdfBytes: Uint8Array,
  fileName: string,
  storage: InkVaultStorageEngine,
  folderId: string | null = null
): Promise<InkVaultDocument> {
  const parsed = await parsePdfIntoPages(pdfBytes, fileName, storage);
  const cleanTitle = fileName.replace(/\.pdf$/i, '') || 'Imported PDF';
  const doc = createNotebook({
    title: cleanTitle,
    folderId,
    cover: {
      enabled: false,
      style: 'architectural-spine',
      color: '#1F232B',
      accentColor: '#2563EB',
    },
  });
  return {
    ...doc,
    pages: parsed.pages.length > 0 ? parsed.pages : doc.pages,
    outline: parsed.outline,
  };
}

/**
 * Merges another PDF into an existing InkVaultDocument at `insertIndex` (defaults to end of document).
 */
export async function mergePdfIntoDocument(
  doc: InkVaultDocument,
  pdfBytes: Uint8Array,
  fileName: string,
  storage: InkVaultStorageEngine,
  insertIndex?: number
): Promise<InkVaultDocument> {
  const parsed = await parsePdfIntoPages(pdfBytes, fileName, storage);
  const idx =
    insertIndex === undefined
      ? doc.pages.length
      : Math.max(0, Math.min(doc.pages.length, insertIndex));
  const pages = [...doc.pages.slice(0, idx), ...parsed.pages, ...doc.pages.slice(idx)];
  return touchDocument({
    ...doc,
    pages,
    outline: [...doc.outline, ...parsed.outline],
    activePageIndex: idx,
  });
}

/**
 * Splits selected page indices out of a document into a brand-new standalone InkVaultDocument.
 */
export function splitDocumentByPages(
  sourceDoc: InkVaultDocument,
  pageIndices: number[],
  newTitle?: string
): InkVaultDocument {
  const validIndices = pageIndices
    .filter((i) => i >= 0 && i < sourceDoc.pages.length)
    .sort((a, b) => a - b);
  const chosenPages = validIndices.map((idx) => structuredClone(sourceDoc.pages[idx]));
  const splitDoc = createNotebook({
    title: newTitle || `${sourceDoc.title} (Split)`,
    folderId: sourceDoc.folderId,
    cover: structuredClone(sourceDoc.cover),
  });
  return {
    ...splitDoc,
    pages: chosenPages.length > 0 ? chosenPages : splitDoc.pages,
  };
}

// LRU Cache of rendered PDF page bitmaps (`assetId:pageNum:w:h`) so 60fps stylus drawing never re-renders PDFs!
const pdfBitmapCache = new Map<string, HTMLCanvasElement>();
const MAX_PDF_BITMAP_CACHE = 28;

export async function getRenderedPdfPageCanvas(
  storage: InkVaultStorageEngine,
  pdfAssetId: string,
  pdfPageNumber: number,
  targetWidth: number,
  targetHeight: number
): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null;
  const key = `${pdfAssetId}:${pdfPageNumber}:${Math.round(targetWidth)}:${Math.round(targetHeight)}`;
  const cached = pdfBitmapCache.get(key);
  if (cached) return cached;

  const asset = await storage.getAsset(pdfAssetId);
  if (!asset) return null;

  try {
    const bytes = base64ToUint8(asset.dataBase64);
    const pdfDoc = await openPdfJsDoc(bytes);
    const pageNum = Math.max(1, Math.min(pdfDoc.numPages, pdfPageNumber));
    const page = await pdfDoc.getPage(pageNum);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = targetWidth / Math.max(1, baseVp.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    if (pdfBitmapCache.size >= MAX_PDF_BITMAP_CACHE) {
      const oldestKey = pdfBitmapCache.keys().next().value;
      if (oldestKey) pdfBitmapCache.delete(oldestKey);
    }
    pdfBitmapCache.set(key, canvas);
    return canvas;
  } catch {
    return null;
  }
}

export interface PdfExportOptions {
  includeBackground: boolean;
  includeAnnotations: boolean;
  includeTapeMasks: boolean;
  embedEditableMetadata: boolean;
  pageIndices?: number[];
}

function hexToRgbNormalized(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) / 255,
      g: parseInt(clean[1] + clean[1], 16) / 255,
      b: parseInt(clean[2] + clean[2], 16) / 255,
    };
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return { r: 0.1, g: 0.1, b: 0.12 };
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

/**
 * Exports an InkVaultDocument (all pages or a selected range) to a real, standards-compliant PDF
 * using `pdf-lib`, preserving original imported PDF vector pages, paper rulings, vector ink strokes,
 * translucent highlights, shapes, connectors, text boxes, images, page rotation, and optional
 * embedded INKVAULT editable metadata.
 */
export async function exportDocumentToPdfBytes(
  doc: InkVaultDocument,
  storage: InkVaultStorageEngine,
  options: PdfExportOptions = {
    includeBackground: true,
    includeAnnotations: true,
    includeTapeMasks: false,
    embedEditableMetadata: true,
  }
): Promise<Uint8Array> {
  const outPdf = await PDFDocument.create();
  outPdf.setTitle(doc.title);
  outPdf.setCreator('INKVAULT Digital Notebook Engine');
  outPdf.setProducer('INKVAULT Portable Schema v1.0.0');

  const fontRegular = await outPdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await outPdf.embedFont(StandardFonts.HelveticaBold);

  const sourcePdfCache = new Map<string, PDFDocument>();
  const indices =
    options.pageIndices && options.pageIndices.length > 0
      ? options.pageIndices
      : doc.pages.map((_, idx) => idx);

  for (const pageIdx of indices) {
    const page = doc.pages[pageIdx];
    if (!page) continue;

    let pdfPage;
    let scaleX = 1;
    let scaleY = 1;

    if (
      options.includeBackground &&
      page.background.type === 'pdf' &&
      page.background.pdfAssetId &&
      page.background.pdfPageNumber
    ) {
      let srcPdf = sourcePdfCache.get(page.background.pdfAssetId);
      if (!srcPdf) {
        const asset = await storage.getAsset(page.background.pdfAssetId);
        if (asset) {
          srcPdf = await PDFDocument.load(base64ToUint8(asset.dataBase64), {
            ignoreEncryption: true,
          });
          sourcePdfCache.set(page.background.pdfAssetId, srcPdf);
        }
      }
      if (srcPdf && page.background.pdfPageNumber <= srcPdf.getPageCount()) {
        const [copied] = await outPdf.copyPages(srcPdf, [page.background.pdfPageNumber - 1]);
        pdfPage = outPdf.addPage(copied);
        const { width: pw, height: ph } = pdfPage.getSize();
        scaleX = pw / page.width;
        scaleY = ph / page.height;
      }
    }

    if (!pdfPage) {
      pdfPage = outPdf.addPage([page.width, page.height]);
      if (options.includeBackground) {
        const palette = PAPER_COLORS[page.background.paperColor] ?? PAPER_COLORS.white;
        const bgC = hexToRgbNormalized(palette.backgroundHex);
        pdfPage.drawRectangle({
          x: 0,
          y: 0,
          width: page.width,
          height: page.height,
          color: rgb(bgC.r, bgC.g, bgC.b),
        });

        const lineC = hexToRgbNormalized(palette.lineHex);
        const step = Math.max(16, page.background.lineSpacing || 28);
        if (
          page.background.templateId === 'ruled-narrow' ||
          page.background.templateId === 'ruled-wide' ||
          page.background.templateId === 'cornell'
        ) {
          for (let y = 68; y < page.height - 28; y += step) {
            const py = page.height - y;
            pdfPage.drawLine({
              start: { x: 0, y: py },
              end: { x: page.width, y: py },
              thickness: 0.75,
              color: rgb(lineC.r, lineC.g, lineC.b),
            });
          }
        } else if (page.background.templateId === 'grid') {
          for (let x = step; x < page.width; x += step) {
            pdfPage.drawLine({
              start: { x, y: 0 },
              end: { x, y: page.height },
              thickness: 0.65,
              color: rgb(lineC.r, lineC.g, lineC.b),
            });
          }
          for (let y = step; y < page.height; y += step) {
            const py = page.height - y;
            pdfPage.drawLine({
              start: { x: 0, y: py },
              end: { x: page.width, y: py },
              thickness: 0.65,
              color: rgb(lineC.r, lineC.g, lineC.b),
            });
          }
        }
      }
    }

    const pdfH = pdfPage.getHeight();
    const toPdfX = (x: number) => x * scaleX;
    const toPdfY = (y: number) => pdfH - y * scaleY;

    if (page.rotation !== 0) {
      pdfPage.setRotation(degrees((pdfPage.getRotation().angle + page.rotation) % 360));
    }

    if (options.includeAnnotations) {
      const visibleLayerIds = new Set(page.layers.filter((l) => l.visible).map((l) => l.id));

      // 1. Embedded Images
      for (const imgObj of page.images) {
        if (!visibleLayerIds.has(imgObj.layerId)) continue;
        try {
          const asset = await storage.getAsset(imgObj.assetId);
          if (!asset) continue;
          const imgBytes = base64ToUint8(asset.dataBase64);
          const embedded = asset.mimeType.includes('png')
            ? await outPdf.embedPng(imgBytes)
            : await outPdf.embedJpg(imgBytes);
          pdfPage.drawImage(embedded, {
            x: toPdfX(imgObj.x),
            y: toPdfY(imgObj.y + imgObj.height),
            width: imgObj.width * scaleX,
            height: imgObj.height * scaleY,
            opacity: imgObj.opacity,
          });
        } catch {
          // Continue if image format unsupported by pdf-lib
        }
      }

      // 2. Highlighter underlay pass first, then Pen / Pencil strokes
      const orderedStrokes = [
        ...page.strokes.filter((s) => s.instrument === 'highlighter'),
        ...page.strokes.filter((s) => s.instrument !== 'highlighter'),
      ];

      for (const stroke of orderedStrokes) {
        if (!visibleLayerIds.has(stroke.layerId) || stroke.points.length === 0) continue;
        const c = hexToRgbNormalized(stroke.color);
        const strokeAlpha =
          stroke.instrument === 'highlighter' ? Math.min(0.4, stroke.opacity) : stroke.opacity;

        if (stroke.points.length === 1) {
          pdfPage.drawCircle({
            x: toPdfX(stroke.points[0].x),
            y: toPdfY(stroke.points[0].y),
            size: Math.max(0.75, stroke.width * 0.5 * scaleX),
            color: rgb(c.r, c.g, c.b),
            opacity: strokeAlpha,
          });
          continue;
        }

        for (let i = 1; i < stroke.points.length; i++) {
          const p0 = stroke.points[i - 1];
          const p1 = stroke.points[i];
          pdfPage.drawLine({
            start: { x: toPdfX(p0.x), y: toPdfY(p0.y) },
            end: { x: toPdfX(p1.x), y: toPdfY(p1.y) },
            thickness: Math.max(0.5, stroke.width * scaleX),
            color: rgb(c.r, c.g, c.b),
            opacity: strokeAlpha,
          });
        }
      }

      // 3. Geometric Shapes & Connectors
      for (const shape of page.shapes) {
        if (!visibleLayerIds.has(shape.layerId)) continue;
        const sc = hexToRgbNormalized(shape.strokeColor);
        if (shape.shapeType === 'line' || shape.shapeType === 'arrow') {
          pdfPage.drawLine({
            start: { x: toPdfX(shape.x1 ?? shape.x), y: toPdfY(shape.y1 ?? shape.y) },
            end: {
              x: toPdfX(shape.x2 ?? shape.x + shape.width),
              y: toPdfY(shape.y2 ?? shape.y + shape.height),
            },
            thickness: shape.strokeWidth * scaleX,
            color: rgb(sc.r, sc.g, sc.b),
          });
        } else if (shape.shapeType === 'ellipse') {
          pdfPage.drawEllipse({
            x: toPdfX(shape.x + shape.width / 2),
            y: toPdfY(shape.y + shape.height / 2),
            xScale: (shape.width / 2) * scaleX,
            yScale: (shape.height / 2) * scaleY,
            borderWidth: shape.strokeWidth * scaleX,
            borderColor: rgb(sc.r, sc.g, sc.b),
          });
        } else {
          pdfPage.drawRectangle({
            x: toPdfX(shape.x),
            y: toPdfY(shape.y + shape.height),
            width: shape.width * scaleX,
            height: shape.height * scaleY,
            borderWidth: shape.strokeWidth * scaleX,
            borderColor: rgb(sc.r, sc.g, sc.b),
          });
        }
      }

      for (const conn of page.connectors) {
        if (!visibleLayerIds.has(conn.layerId)) continue;
        const cc = hexToRgbNormalized(conn.strokeColor);
        pdfPage.drawLine({
          start: { x: toPdfX(conn.x1), y: toPdfY(conn.y1) },
          end: { x: toPdfX(conn.x2), y: toPdfY(conn.y2) },
          thickness: conn.strokeWidth * scaleX,
          color: rgb(cc.r, cc.g, cc.b),
        });
      }

      // 4. Text Boxes
      for (const tb of page.textBoxes) {
        if (!visibleLayerIds.has(tb.layerId) || !tb.text.trim()) continue;
        const tc = hexToRgbNormalized(tb.color);
        const font = tb.fontWeight !== 'normal' ? fontBold : fontRegular;
        const lines = tb.text.split('\n');
        const fontSize = Math.max(8, tb.fontSize * scaleY);
        lines.forEach((line, lIdx) => {
          pdfPage.drawText(line, {
            x: toPdfX(tb.x + 6),
            y: toPdfY(tb.y + 6 + (lIdx + 1) * fontSize * (tb.lineHeight || 1.3)),
            size: fontSize,
            font,
            color: rgb(tc.r, tc.g, tc.b),
          });
        });
      }

      // 5. Optional Tape Masks
      if (options.includeTapeMasks) {
        for (const tp of page.tapes) {
          if (tp.revealed) continue;
          const tc = hexToRgbNormalized(tp.color);
          pdfPage.drawLine({
            start: { x: toPdfX(tp.x1), y: toPdfY(tp.y1) },
            end: { x: toPdfX(tp.x2), y: toPdfY(tp.y2) },
            thickness: tp.width * scaleY,
            color: rgb(tc.r, tc.g, tc.b),
            opacity: 0.95,
          });
        }
      }
    }
  }

  // Embed portable INKVAULT JSON metadata inside PDF catalog if requested
  if (options.embedEditableMetadata) {
    const jsonBase64 = uint8ToBase64(new TextEncoder().encode(JSON.stringify(doc)));
    await outPdf.attach(jsonBase64, 'inkvault-editable-model.json', {
      mimeType: 'application/json',
      description: 'INKVAULT Lossless Editable Document Schema v1.0.0',
    });
  }

  return outPdf.save();
}
