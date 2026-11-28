import {
  isRunningInNativeIOSShell,
  postCommandToNativeIOS,
  subscribeToNativeIOSEvents,
} from '../ios/pencilKitBridge';
import { renderInkStrokeToCanvas } from '../ink/inkEngine';
import { ImageObject, InkStroke, InkVaultDocument, InkVaultPage } from '../model/types';

export type OcrRecognizerFn = (canvas: HTMLCanvasElement) => Promise<string>;

let cachedTesseractWorkerPromise: Promise<{
  recognize: (image: HTMLCanvasElement | string) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
}> | null = null;

/**
 * Default local OCR recognizer:
 * - On iPadOS / iOS native shell: executes 100% offline Apple `Vision.framework` (`VNRecognizeTextRequest`)
 *   on the Neural Engine with zero external downloads.
 * - On Web / Desktop: runs Tesseract.js inside a background Web Worker.
 */
export const defaultTesseractRecognizer: OcrRecognizerFn = async (
  canvas: HTMLCanvasElement
): Promise<string> => {
  if (isRunningInNativeIOSShell()) {
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1] || '';
    if (base64) {
      const requestId = `vocr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const nativeText = await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => {
          unsub();
          resolve(null);
        }, 4000);
        const unsub = subscribeToNativeIOSEvents((evt) => {
          if (evt.type === 'visionOcrResult' && evt.requestId === requestId) {
            clearTimeout(timer);
            unsub();
            resolve(evt.text);
          }
        });
        const posted = postCommandToNativeIOS({
          command: 'recognizeTextVision',
          requestId,
          imageBase64: base64,
        });
        if (!posted) {
          clearTimeout(timer);
          unsub();
          resolve(null);
        }
      });
      if (nativeText !== null) {
        return nativeText.trim();
      }
    }
  }

  const Tesseract = await import('tesseract.js');
  if (!cachedTesseractWorkerPromise) {
    cachedTesseractWorkerPromise = Tesseract.createWorker('eng');
  }
  const worker = await cachedTesseractWorkerPromise;
  const result = await worker.recognize(canvas);
  return (result.data.text || '').trim();
};

/**
 * Renders an embedded ImageObject onto an offscreen canvas for asynchronous Image Text Recognition.
 */
export async function renderImageObjectForOcr(
  imageObj: ImageObject
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const w = Math.max(64, Math.round(imageObj.naturalWidth || imageObj.width || 320));
  const h = Math.max(64, Math.round(imageObj.naturalHeight || imageObj.height || 240));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    if (imageObj.dataUrl && typeof Image !== 'undefined') {
      await new Promise<void>((resolve) => {
        const el = new Image();
        const timeout = setTimeout(() => resolve(), 150);
        el.onload = () => {
          clearTimeout(timeout);
          try {
            ctx.drawImage(el, 0, 0, w, h);
          } catch {
            // Safe fallback in headless environments
          }
          resolve();
        };
        el.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };
        el.src = imageObj.dataUrl!;
      });
    }
  }
  return canvas;
}

/**
 * Renders a page's handwriting strokes onto an offscreen high-contrast canvas
 * suitable for local OCR indexing without touching the live writing canvas.
 */
export function renderPageForOcr(page: InkVaultPage, strokesSubset?: InkStroke[]): HTMLCanvasElement {
  const strokes = strokesSubset ?? page.strokes.filter((s) => s.instrument !== 'highlighter');
  const canvas = document.createElement('canvas');

  if (strokesSubset && strokesSubset.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of strokesSubset) {
      const pad = s.width * 2 + 12;
      for (const pt of s.points) {
        minX = Math.min(minX, pt.x - pad);
        minY = Math.min(minY, pt.y - pad);
        maxX = Math.max(maxX, pt.x + pad);
        maxY = Math.max(maxY, pt.y + pad);
      }
    }
    const w = Math.max(120, Math.ceil(maxX - minX));
    const h = Math.max(60, Math.ceil(maxY - minY));
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.translate(-minX, -minY);
      for (const s of strokesSubset) {
        renderInkStrokeToCanvas(ctx, { ...s, color: '#000000', opacity: 1 });
      }
    }
    return canvas;
  }

  canvas.width = page.width;
  canvas.height = page.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, page.width, page.height);
    for (const s of strokes) {
      renderInkStrokeToCanvas(ctx, { ...s, color: '#000000', opacity: 1 });
    }
  }
  return canvas;
}

export interface OcrQueueJob {
  documentId: string;
  pageId: string;
  pageSnapshot: InkVaultPage;
}

export interface OcrRecognitionUpdate {
  documentId: string;
  pageId: string;
  handwritingOcrText: string;
  imageOcrById: Record<string, string>;
}

/**
 * Non-blocking asynchronous background OCR scheduler for BOTH vector handwriting AND embedded images.
 * Yields between tasks via `setTimeout(..., 10)` so stylus input stays 60–120fps.
 */
export class AsyncOcrQueue {
  private queue: OcrQueueJob[] = [];
  private processing = false;
  private recognizer: OcrRecognizerFn;
  private onPageRecognized: (
    documentId: string,
    pageId: string,
    ocrText: string,
    imageOcrById?: Record<string, string>
  ) => void;

  constructor(
    onPageRecognized: (
      documentId: string,
      pageId: string,
      ocrText: string,
      imageOcrById?: Record<string, string>
    ) => void,
    recognizer: OcrRecognizerFn = defaultTesseractRecognizer
  ) {
    this.onPageRecognized = onPageRecognized;
    this.recognizer = recognizer;
  }

  enqueuePage(documentId: string, page: InkVaultPage): void {
    const hasStrokes = page.strokes.some((s) => s.instrument !== 'highlighter');
    const hasImages = page.images.length > 0;
    if (!hasStrokes && !hasImages) return;

    this.queue = this.queue.filter(
      (j) => !(j.documentId === documentId && j.pageId === page.id)
    );
    this.queue.push({
      documentId,
      pageId: page.id,
      pageSnapshot: structuredClone(page),
    });
    void this.pump();
  }

  async recognizeSelectedStrokes(page: InkVaultPage, strokes: InkStroke[]): Promise<string> {
    if (strokes.length === 0) return '';
    const canvas = renderPageForOcr(page, strokes);
    return this.recognizer(canvas);
  }

  getPendingCount(): number {
    return this.queue.length + (this.processing ? 1 : 0);
  }

  private async pump(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        await new Promise((resolve) => setTimeout(resolve, 10));
        try {
          let handwritingText = job.pageSnapshot.ocrText ?? '';
          if (job.pageSnapshot.strokes.some((s) => s.instrument !== 'highlighter')) {
            const strokeCanvas = renderPageForOcr(job.pageSnapshot);
            handwritingText = await this.recognizer(strokeCanvas);
          }

          const imageOcrById: Record<string, string> = {};
          for (const img of job.pageSnapshot.images) {
            if (img.ocrText !== undefined) {
              imageOcrById[img.id] = img.ocrText;
            } else {
              const imgCanvas = await renderImageObjectForOcr(img);
              imageOcrById[img.id] = await this.recognizer(imgCanvas);
            }
          }

          this.onPageRecognized(
            job.documentId,
            job.pageId,
            handwritingText,
            imageOcrById
          );
        } catch {
          // Never crash or block writing if OCR fails on an unusual stroke/image
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

// --- Universal Search Engine (Titles, Typed Text, Handwriting OCR, Image OCR, PDF Text, Outlines) ---

export type SearchMatchSource =
  | 'title'
  | 'typed'
  | 'handwriting-ocr'
  | 'image-ocr'
  | 'pdf'
  | 'outline';

export interface SearchFilterOptions {
  sources?: SearchMatchSource[];
  folderId?: string | null;
  bookmarkedOnly?: boolean;
  documentId?: string;
}

export interface UniversalSearchResult {
  id: string;
  documentId: string;
  documentTitle: string;
  pageId: string;
  pageIndex: number;
  source: SearchMatchSource;
  snippet: string;
  matchStart: number;
  matchLength: number;
  bookmarked: boolean;
}

function buildSnippet(fullText: string, queryLower: string): {
  snippet: string;
  matchStart: number;
  matchLength: number;
} | null {
  const idx = fullText.toLowerCase().indexOf(queryLower);
  if (idx === -1) return null;
  const start = Math.max(0, idx - 36);
  const end = Math.min(fullText.length, idx + queryLower.length + 54);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < fullText.length ? '…' : '';
  const snippet = `${prefix}${fullText.slice(start, end).replace(/\s+/g, ' ')}${suffix}`;
  const matchIdxInSnippet = snippet.toLowerCase().indexOf(queryLower);
  return {
    snippet,
    matchStart: Math.max(0, matchIdxInSnippet),
    matchLength: queryLower.length,
  };
}

/**
 * Searches across titles, typed text boxes, recognized handwriting OCR, embedded image OCR, PDF text, and outlines
 * with instant contextual previews and direct page navigation coordinates.
 */
export function searchAcrossLibrary(
  documents: InkVaultDocument[],
  rawQuery: string,
  filters: SearchFilterOptions = {}
): UniversalSearchResult[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const allowedSources =
    filters.sources && filters.sources.length > 0 ? new Set(filters.sources) : null;
  const results: UniversalSearchResult[] = [];

  for (const doc of documents) {
    if (doc.trashedAt !== null) continue;
    if (filters.documentId && doc.id !== filters.documentId) continue;
    if (filters.folderId !== undefined && filters.folderId !== null && doc.folderId !== filters.folderId) {
      continue;
    }

    if (!allowedSources || allowedSources.has('title')) {
      const titleHit = buildSnippet(doc.title, q);
      if (titleHit && (!filters.bookmarkedOnly || doc.pages[0]?.bookmarked)) {
        results.push({
          id: `${doc.id}_title`,
          documentId: doc.id,
          documentTitle: doc.title,
          pageId: doc.pages[0]?.id ?? '',
          pageIndex: 0,
          source: 'title',
          snippet: titleHit.snippet,
          matchStart: titleHit.matchStart,
          matchLength: titleHit.matchLength,
          bookmarked: Boolean(doc.pages[0]?.bookmarked),
        });
      }
    }

    if (doc.isEncrypted && doc.pages.length === 0) continue;

    if (!allowedSources || allowedSources.has('outline')) {
      for (const node of doc.outline) {
        const outHit = buildSnippet(node.title, q);
        if (outHit) {
          const pIdx = Math.max(0, doc.pages.findIndex((p) => p.id === node.pageId));
          const page = doc.pages[pIdx];
          if (filters.bookmarkedOnly && !page?.bookmarked) continue;
          results.push({
            id: `${doc.id}_out_${node.id}`,
            documentId: doc.id,
            documentTitle: doc.title,
            pageId: node.pageId,
            pageIndex: pIdx,
            source: 'outline',
            snippet: outHit.snippet,
            matchStart: outHit.matchStart,
            matchLength: outHit.matchLength,
            bookmarked: Boolean(page?.bookmarked),
          });
        }
      }
    }

    doc.pages.forEach((page, pIdx) => {
      if (filters.bookmarkedOnly && !page.bookmarked) return;

      if (!allowedSources || allowedSources.has('typed')) {
        const combinedTyped = page.textBoxes.map((t) => t.text).join(' · ');
        if (combinedTyped) {
          const hit = buildSnippet(combinedTyped, q);
          if (hit) {
            results.push({
              id: `${doc.id}_p${pIdx}_typed`,
              documentId: doc.id,
              documentTitle: doc.title,
              pageId: page.id,
              pageIndex: pIdx,
              source: 'typed',
              snippet: hit.snippet,
              matchStart: hit.matchStart,
              matchLength: hit.matchLength,
              bookmarked: page.bookmarked,
            });
          }
        }
      }

      if ((!allowedSources || allowedSources.has('handwriting-ocr')) && page.ocrText) {
        const hit = buildSnippet(page.ocrText, q);
        if (hit) {
          results.push({
            id: `${doc.id}_p${pIdx}_ocr`,
            documentId: doc.id,
            documentTitle: doc.title,
            pageId: page.id,
            pageIndex: pIdx,
            source: 'handwriting-ocr',
            snippet: hit.snippet,
            matchStart: hit.matchStart,
            matchLength: hit.matchLength,
            bookmarked: page.bookmarked,
          });
        }
      }

      if (!allowedSources || allowedSources.has('image-ocr')) {
        const combinedImgOcr = page.images
          .map((im) => im.ocrText || '')
          .filter(Boolean)
          .join(' · ');
        if (combinedImgOcr) {
          const hit = buildSnippet(combinedImgOcr, q);
          if (hit) {
            results.push({
              id: `${doc.id}_p${pIdx}_img_ocr`,
              documentId: doc.id,
              documentTitle: doc.title,
              pageId: page.id,
              pageIndex: pIdx,
              source: 'image-ocr',
              snippet: hit.snippet,
              matchStart: hit.matchStart,
              matchLength: hit.matchLength,
              bookmarked: page.bookmarked,
            });
          }
        }
      }

      if ((!allowedSources || allowedSources.has('pdf')) && page.pdfText) {
        const hit = buildSnippet(page.pdfText, q);
        if (hit) {
          results.push({
            id: `${doc.id}_p${pIdx}_pdf`,
            documentId: doc.id,
            documentTitle: doc.title,
            pageId: page.id,
            pageIndex: pIdx,
            source: 'pdf',
            snippet: hit.snippet,
            matchStart: hit.matchStart,
            matchLength: hit.matchLength,
            bookmarked: page.bookmarked,
          });
        }
      }
    });
  }

  return results;
}
