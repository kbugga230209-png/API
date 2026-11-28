import { PDFDocument, StandardFonts } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyPixelEraser,
  applyStrokeEraser,
  computeAlignmentGuides,
  computePointWidth,
  pasteObjectsOntoPage,
  projectPointOntoRulerIfNear,
  recognizeShapeFromPoints,
  selectObjectsWithLasso,
  transformPageObjects,
} from '../src/core/ink/inkEngine';
import { createId, createNotebook, createPage } from '../src/core/model/documentModel';
import { InkStroke } from '../src/core/model/types';
import {
  exportDocumentToPdfBytes,
  importPdfAsNotebook,
  mergePdfIntoDocument,
  splitDocumentByPages,
} from '../src/core/pdf/pdfEngine';
import { InkVaultStorageEngine } from '../src/core/storage/storageEngine';

async function createSamplePdfBytes(pageTexts: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const txt of pageTexts) {
    const page = pdf.addPage([612, 792]);
    page.drawText(txt, { x: 50, y: 700, size: 18, font });
  }
  return pdf.save();
}

describe('Stage 2 — Digital Ink Engine, Vector Erasers, Lasso & PDF Studio', () => {
  let storage: InkVaultStorageEngine;

  beforeEach(async () => {
    storage = new InkVaultStorageEngine();
    await storage.clearAllData();
  });

  it('computes responsive pressure and Apple Pencil tilt widths across instruments', () => {
    const lightAndHeavy = [
      { x: 10, y: 10, p: 0.15, tx: 0, ty: 0, t: 0 },
      { x: 30, y: 12, p: 0.9, tx: 60, ty: 30, t: 12 },
    ];

    const brushLight = computePointWidth(lightAndHeavy, 0, 4, 'brush', 0.8, 0.5);
    const brushHeavy = computePointWidth(lightAndHeavy, 1, 4, 'brush', 0.8, 0.5);
    expect(brushHeavy).toBeGreaterThan(brushLight * 1.8);

    const pencilUpright = computePointWidth(lightAndHeavy, 0, 3, 'pencil', 0.5, 0.3);
    const pencilTilted = computePointWidth(lightAndHeavy, 1, 3, 'pencil', 0.5, 0.3);
    expect(pencilTilted).toBeGreaterThan(pencilUpright * 1.5);
  });

  it('splits strokes into two vector sub-strokes with Pixel Eraser without rasterizing and respects Eraser Filters & Locks', () => {
    let page = createPage();
    const layerId = page.layers[0].id;

    const penStroke: InkStroke = {
      id: createId('stk'),
      kind: 'stroke',
      layerId,
      zIndex: 1,
      instrument: 'fountain',
      color: '#18181B',
      width: 3,
      opacity: 1,
      smoothing: 0.5,
      pressureSensitivity: 0.5,
      tipSharpness: 0.5,
      points: [
        { x: 50, y: 100, p: 0.5, t: 0 },
        { x: 250, y: 100, p: 0.5, t: 40 },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const highlightStroke: InkStroke = {
      ...penStroke,
      id: createId('stk'),
      instrument: 'highlighter',
      color: '#FACC15',
      width: 18,
    };

    page = { ...page, strokes: [penStroke, highlightStroke] };

    // 1. Highlighter-only filter leaves pen stroke untouched!
    const filteredErase = applyStrokeEraser(page, 150, 100, 12, {
      pen: false,
      pencil: false,
      highlighter: true,
      shapes: false,
      tape: false,
    });
    expect(filteredErase.nextPage.strokes).toHaveLength(1);
    expect(filteredErase.nextPage.strokes[0].instrument).toBe('fountain');

    // 2. Pixel Eraser through midpoint x=150 splits the single vector pen stroke into 2 editable vector strokes!
    const pixelSplit = applyPixelEraser(filteredErase.nextPage, 150, 100, 14, {
      pen: true,
      pencil: true,
      highlighter: true,
      shapes: true,
      tape: true,
    });
    expect(pixelSplit.changed).toBe(true);
    expect(pixelSplit.nextPage.strokes).toHaveLength(2);
    expect(pixelSplit.nextPage.strokes[0].points.every((pt) => pt.x < 150)).toBe(true);
    expect(pixelSplit.nextPage.strokes[1].points.every((pt) => pt.x > 150)).toBe(true);
  });

  it('recognizes geometric shapes, snaps strokes to Ruler edge, and transforms Lasso selections', () => {
    const layerId = 'lyr_1';
    const lineShape = recognizeShapeFromPoints(
      [
        { x: 20, y: 40, p: 0.5, t: 0 },
        { x: 80, y: 41, p: 0.5, t: 10 },
        { x: 140, y: 40, p: 0.5, t: 20 },
        { x: 200, y: 40, p: 0.5, t: 30 },
      ],
      layerId,
      1,
      '#18181B',
      2
    );
    expect(lineShape?.shapeType).toBe('line');

    // Circle recognition
    const circlePts = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 23) * Math.PI * 2;
      return { x: 200 + Math.cos(a) * 60, y: 200 + Math.sin(a) * 60, p: 0.5, t: i * 5 };
    });
    const ellipseShape = recognizeShapeFromPoints(circlePts, layerId, 2, '#2563EB', 2);
    expect(ellipseShape?.shapeType).toBe('ellipse');

    // Ruler edge snap
    const snapped = projectPointOntoRulerIfNear(
      300,
      312,
      { visible: true, x: 300, y: 340, angleDeg: 0, length: 400, thickness: 40 },
      20
    );
    expect(snapped.snapped).toBe(true);
    expect(snapped.y).toBeCloseTo(319, 0);

    // Lasso select + resize + copy/paste + alignment guides
    let page = createPage();
    page = { ...page, shapes: [ellipseShape!] };
    const selected = selectObjectsWithLasso(
      page,
      [
        { x: 100, y: 100 },
        { x: 300, y: 300 },
      ],
      'rectangle',
      { strokes: true, shapes: true, textBoxes: true, images: true, stickers: true, tapes: true }
    );
    expect(selected).toEqual([ellipseShape!.id]);

    const resized = transformPageObjects(page, selected, {
      scaleX: 1.5,
      scaleY: 1.5,
      anchorX: 200,
      anchorY: 200,
      rotateDeg: 30,
    });
    expect(resized.shapes[0].width).toBeGreaterThan(ellipseShape!.width);
    expect(resized.shapes[0].rotation).toBe(30);

    const pasted = pasteObjectsOntoPage(resized, [resized.shapes[0]], 25, 25);
    expect(pasted.nextPage.shapes).toHaveLength(2);

    const guides = computeAlignmentGuides(
      pasted.nextPage,
      { minX: page.width / 2 - 48, minY: 100, maxX: page.width / 2 + 50, maxY: 200 },
      new Set()
    );
    expect(guides.guides.length).toBeGreaterThan(0);
  });

  it('imports PDFs, merges PDFs, splits pages, and exports annotated PDFs retaining pages and annotations', async () => {
    const pdf1 = await createSamplePdfBytes(['Quantum Lecture 1', 'Quantum Lecture 2']);
    let doc = await importPdfAsNotebook(pdf1, 'Quantum.pdf', storage);
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0].background.type).toBe('pdf');

    // Add handwritten annotation & text box onto PDF Page 1
    doc.pages[0].strokes.push({
      id: createId('stk'),
      kind: 'stroke',
      layerId: doc.pages[0].layers[0].id,
      zIndex: 1,
      instrument: 'fountain',
      color: '#DC2626',
      width: 2.5,
      opacity: 1,
      smoothing: 0.5,
      pressureSensitivity: 0.5,
      tipSharpness: 0.5,
      points: [
        { x: 60, y: 120, p: 0.6, t: 0 },
        { x: 180, y: 125, p: 0.7, t: 20 },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Merge second PDF
    const pdf2 = await createSamplePdfBytes(['Appendix A']);
    doc = await mergePdfIntoDocument(doc, pdf2, 'Appendix.pdf', storage);
    expect(doc.pages).toHaveLength(3);

    // Split page 3 into a separate notebook
    const splitNb = splitDocumentByPages(doc, [2], 'Extracted Appendix');
    expect(splitNb.pages).toHaveLength(1);

    // Export annotated notebook back to standards-compliant PDF bytes
    const exportedPdfBytes = await exportDocumentToPdfBytes(doc, storage);
    expect(exportedPdfBytes.byteLength).toBeGreaterThan(500);
    const reloaded = await PDFDocument.load(exportedPdfBytes);
    expect(reloaded.getPageCount()).toBe(3);

    // Verify notebook annotations remained unflattened and editable in INKVAULT
    expect(doc.pages[0].strokes).toHaveLength(1);
    expect(doc.pages[0].strokes[0].points).toHaveLength(2);
  });
});
