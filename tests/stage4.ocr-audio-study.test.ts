import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAudioSessionBlobUrl,
  listSyncedStrokesForAudioSession,
} from '../src/core/audio/audioEngine';
import { createId, createNotebook, createPage } from '../src/core/model/documentModel';
import { AsyncOcrQueue, searchAcrossLibrary } from '../src/core/ocr/ocrAndSearchEngine';
import { InkVaultStorageEngine } from '../src/core/storage/storageEngine';
import {
  createStudySetFromExtractedHighlights,
  extractHighlightsAndAnnotationsFromDocument,
  reviewFlashcardSM2,
} from '../src/core/study/studyEngine';

describe('Stage 4 — Async OCR, Universal Search, Audio Sync & SM-2 Study Tools', () => {
  let storage: InkVaultStorageEngine;

  beforeEach(async () => {
    storage = new InkVaultStorageEngine();
    await storage.clearAllData();
  });

  it('indexes handwritten pages asynchronously without blocking foreground writing and converts selected strokes to text', async () => {
    const doc = createNotebook({ title: 'Neuroscience Lecture' });
    doc.pages[0].strokes.push({
      id: createId('stk'),
      kind: 'stroke',
      layerId: doc.pages[0].layers[0].id,
      zIndex: 1,
      instrument: 'fountain',
      color: '#18181B',
      width: 2.5,
      opacity: 1,
      smoothing: 0.5,
      pressureSensitivity: 0.5,
      tipSharpness: 0.5,
      points: [
        { x: 40, y: 60, p: 0.5, t: 0 },
        { x: 180, y: 62, p: 0.6, t: 20 },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    doc.pages[0].images.push({
      id: 'img_slide_1',
      kind: 'image',
      assetId: 'ast_1',
      layerId: doc.pages[0].layers[0].id,
      zIndex: 2,
      x: 50,
      y: 120,
      width: 220,
      height: 140,
      rotation: 0,
      opacity: 1,
      naturalWidth: 220,
      naturalHeight: 140,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    let recognizedPayload: {
      docId: string;
      pageId: string;
      text: string;
      imageOcrById?: Record<string, string>;
    } | null = null;
    const queue = new AsyncOcrQueue(
      (docId, pageId, text, imageOcrById) => {
        recognizedPayload = { docId, pageId, text, imageOcrById };
      },
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'Synaptic plasticity and long-term potentiation';
      }
    );

    queue.enqueuePage(doc.id, doc.pages[0]);

    // Foreground writing is NOT blocked while OCR runs asynchronously in the background!
    doc.pages[0].strokes.push({
      ...doc.pages[0].strokes[0],
      id: createId('stk'),
    });
    expect(doc.pages[0].strokes).toHaveLength(2);

    await new Promise((r) => setTimeout(r, 90));
    expect(recognizedPayload).toEqual({
      docId: doc.id,
      pageId: doc.pages[0].id,
      text: 'Synaptic plasticity and long-term potentiation',
      imageOcrById: {
        img_slide_1: 'Synaptic plasticity and long-term potentiation',
      },
    });

    // Convert selection to text
    const converted = await queue.recognizeSelectedStrokes(doc.pages[0], [doc.pages[0].strokes[0]]);
    expect(converted).toContain('Synaptic plasticity');
  });

  it('searches across titles, typed text, handwriting OCR, PDF text, and outlines with filters', () => {
    const doc = createNotebook({ title: 'Thermodynamics & Entropy' });
    const p2 = createPage();
    p2.bookmarked = true;
    p2.ocrText = 'Carnot heat engine efficiency depends on reservoir temperatures';
    const p3 = createPage();
    p3.pdfText = 'Boltzmann statistical definition S = k ln W';
    p3.textBoxes.push({
      id: createId('txt'),
      kind: 'textbox',
      layerId: p3.layers[0].id,
      zIndex: 1,
      x: 50,
      y: 50,
      width: 240,
      height: 50,
      rotation: 0,
      text: 'Second law of thermodynamics summary',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
      align: 'left',
      color: '#18181B',
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      lineHeight: 1.4,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    p3.images.push({
      id: createId('img'),
      kind: 'image',
      assetId: 'ast_diagram',
      layerId: p3.layers[0].id,
      zIndex: 2,
      x: 80,
      y: 160,
      width: 200,
      height: 150,
      rotation: 0,
      opacity: 1,
      naturalWidth: 200,
      naturalHeight: 150,
      ocrText: 'Whiteboard Maxwell relations diagram',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    doc.pages = [doc.pages[0], p2, p3];
    doc.outline.push({
      id: createId('out'),
      title: 'Chapter 4: Carnot Cycle Proof',
      pageId: p2.id,
      level: 0,
    });

    const carnotHits = searchAcrossLibrary([doc], 'carnot');
    expect(carnotHits.map((h) => h.source).sort()).toEqual(['handwriting-ocr', 'outline']);
    expect(carnotHits[0].pageIndex).toBe(1);

    const imgOcrOnly = searchAcrossLibrary([doc], 'maxwell relations', {
      sources: ['image-ocr'],
    });
    expect(imgOcrOnly).toHaveLength(1);
    expect(imgOcrOnly[0].pageIndex).toBe(2);

    const pdfOnly = searchAcrossLibrary([doc], 'boltzmann', { sources: ['pdf'] });
    expect(pdfOnly).toHaveLength(1);
    expect(pdfOnly[0].pageIndex).toBe(2);

    const bookmarkedFilter = searchAcrossLibrary([doc], 'thermodynamics', {
      bookmarkedOnly: true,
    });
    // p3 has "Second law of thermodynamics" but is NOT bookmarked, so 0 hits when bookmarkedOnly=true!
    expect(bookmarkedFilter).toHaveLength(0);
  });

  it('synchronises audio session assets with chronological stroke timestamps across pages', async () => {
    const audioAsset = await storage.storeBinaryAsset(
      new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
      'audio/webm',
      'seminar.webm'
    );
    const doc = createNotebook({ title: 'Seminar Notes' });
    const p2 = createPage();
    doc.pages.push(p2);

    const sessionId = createId('aud');
    doc.audioSessions.push({
      id: sessionId,
      title: 'Seminar Recording 1',
      assetId: audioAsset.id,
      mimeType: 'audio/webm',
      durationMs: 45_000,
      createdAt: Date.now(),
      pageIdAtStart: doc.pages[0].id,
    });

    // Add stroke at t=14.2s on page 2 and stroke at t=3.5s on page 1
    doc.pages[1].strokes.push({
      id: 'stk_late',
      kind: 'stroke',
      layerId: doc.pages[1].layers[0].id,
      zIndex: 1,
      instrument: 'fountain',
      color: '#18181B',
      width: 2,
      opacity: 1,
      smoothing: 0.5,
      pressureSensitivity: 0.5,
      tipSharpness: 0.5,
      audioSessionId: sessionId,
      audioOffsetMs: 14_200,
      points: [{ x: 20, y: 20, p: 0.5, t: 0 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    doc.pages[0].strokes.push({
      ...doc.pages[1].strokes[0],
      id: 'stk_early',
      audioOffsetMs: 3_500,
    });

    const synced = listSyncedStrokesForAudioSession(doc, sessionId);
    expect(synced.map((s) => s.strokeId)).toEqual(['stk_early', 'stk_late']);
    expect(synced[1].pageIndex).toBe(1);

    const loadedAudio = await getAudioSessionBlobUrl(doc.audioSessions[0], storage);
    expect(loadedAudio?.bytes.byteLength).toBe(4);
  });

  it('extracts highlights, bookmarks & Tape masks into Study Sets and schedules SM-2 spaced repetition intervals', () => {
    const doc = createNotebook({ title: 'Immunology' });
    const page = doc.pages[0];
    page.bookmarked = true;
    page.bookmarkLabel = 'Adaptive Immunity';
    page.textBoxes.push({
      id: createId('txt'),
      kind: 'textbox',
      layerId: page.layers[0].id,
      zIndex: 1,
      x: 100,
      y: 100,
      width: 300,
      height: 40,
      rotation: 0,
      text: 'T-cells mature in the thymus gland',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
      align: 'left',
      color: '#18181B',
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      lineHeight: 1.4,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    // Highlighter stroke overlapping that text box
    page.strokes.push({
      id: createId('stk'),
      kind: 'stroke',
      layerId: page.layers[0].id,
      zIndex: 2,
      instrument: 'highlighter',
      color: '#FACC15',
      width: 20,
      opacity: 0.35,
      smoothing: 0.5,
      pressureSensitivity: 0.2,
      tipSharpness: 0.2,
      points: [
        { x: 105, y: 118, p: 0.5, t: 0 },
        { x: 350, y: 118, p: 0.5, t: 20 },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    // Tape mask over the same region
    page.tapes.push({
      id: createId('tap'),
      kind: 'tape',
      layerId: page.layers[0].id,
      zIndex: 3,
      x1: 100,
      y1: 118,
      x2: 360,
      y2: 118,
      width: 32,
      color: '#CBD5E1',
      revealed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const extracted = extractHighlightsAndAnnotationsFromDocument(doc);
    expect(extracted).toHaveLength(3); // 1 bookmark + 1 highlight + 1 tape-mask
    expect(extracted.find((x) => x.kind === 'highlight')?.content).toContain('thymus gland');

    const studySet = createStudySetFromExtractedHighlights(doc, extracted);
    expect(studySet.cards).toHaveLength(3);

    // SM-2 spaced repetition progression
    const t0 = 1_700_000_000_000;
    let card = studySet.cards[0];
    card = reviewFlashcardSM2(card, 'good', t0);
    expect(card.intervalDays).toBe(1);
    expect(card.repetitions).toBe(1);

    card = reviewFlashcardSM2(card, 'good', t0 + 86_400_000);
    expect(card.intervalDays).toBe(6);
    expect(card.repetitions).toBe(2);

    card = reviewFlashcardSM2(card, 'easy', t0 + 7 * 86_400_000);
    expect(card.intervalDays).toBeGreaterThan(12);

    // Lapsing ('again') resets interval to 0 (10-minute short-term relearn) and increments lapses
    const lapsed = reviewFlashcardSM2(card, 'again', t0 + 20 * 86_400_000);
    expect(lapsed.intervalDays).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.easinessFactor).toBeGreaterThanOrEqual(1.3);
  });
});
