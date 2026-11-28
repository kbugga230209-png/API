import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import {
  registerIOSLifecyclePersistenceGuards,
  verifyBackupArchiveIntegrity,
} from '../src/core/ios/iosFileAndLifecycleBridge';
import { IPadGestureRecognizer } from '../src/core/ios/ipadGestureEngine';
import {
  altitudeAzimuthToTiltDegrees,
  deserializePencilKitToInkStrokes,
  dispatchNativeIOSEvent,
  serializeInkStrokesToPencilKit,
  tiltDegreesToAltitudeAzimuth,
  WebToNativeCommand,
} from '../src/core/ios/pencilKitBridge';
import { createNotebook } from '../src/core/model/documentModel';
import { InkStroke } from '../src/core/model/types';
import { defaultTesseractRecognizer } from '../src/core/ocr/ocrAndSearchEngine';
import { exportDocumentToPdfBytes } from '../src/core/pdf/pdfEngine';
import { resolveWindowFormFactor } from '../src/core/platform/platformAdapter';
import {
  exportFullLibraryBackupZip,
  exportSingleNotebookArchive,
} from '../src/core/storage/backupAndSync';
import { uint8ToBase64 } from '../src/core/storage/cryptoVault';
import { InkVaultStorageEngine } from '../src/core/storage/storageEngine';

describe('Stage 6 — iOS & iPadOS Native Bridge, PencilKit Round-Trip, Gestures & Lifecycle Safety', () => {
  let storage: InkVaultStorageEngine;

  beforeEach(async () => {
    storage = new InkVaultStorageEngine();
    await storage.clearAllData();
  });

  it('converts Apple Pencil altitude/azimuth and round-trips INKVAULT strokes through PencilKit DTO losslessly', () => {
    const { altitude, azimuth } = tiltDegreesToAltitudeAzimuth(28, -19);
    const recoveredTilt = altitudeAzimuthToTiltDegrees(altitude, azimuth);
    expect(recoveredTilt.tx).toBeCloseTo(28, 1);
    expect(recoveredTilt.ty).toBeCloseTo(-19, 1);

    const originalStroke: InkStroke = {
      id: 'stk_apple_pencil_1',
      kind: 'stroke',
      layerId: 'layer_annotations',
      zIndex: 7,
      instrument: 'fountain',
      color: '#1D4ED8',
      width: 3.2,
      opacity: 0.95,
      smoothing: 0.6,
      pressureSensitivity: 0.7,
      tipSharpness: 0.5,
      audioSessionId: 'aud_lecture_1',
      audioOffsetMs: 14250,
      points: [
        { x: 110, y: 180, p: 0.35, tx: 22, ty: -14, t: 0 },
        { x: 148, y: 192, p: 0.72, tx: 24, ty: -15, t: 16 },
        { x: 196, y: 185, p: 0.58, tx: 20, ty: -12, t: 33 },
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000100,
    };

    const pkPayload = serializeInkStrokesToPencilKit('doc_1', 'page_1', [originalStroke]);
    expect(pkPayload.strokes).toHaveLength(1);
    expect(pkPayload.strokes[0].inkType).toBe('fountainPen');

    const roundTripped = deserializePencilKitToInkStrokes(pkPayload, 'default');
    expect(roundTripped).toHaveLength(1);
    expect(roundTripped[0].id).toBe('stk_apple_pencil_1');
    expect(roundTripped[0].instrument).toBe('fountain');
    expect(roundTripped[0].layerId).toBe('layer_annotations');
    expect(roundTripped[0].zIndex).toBe(7);
    expect(roundTripped[0].audioSessionId).toBe('aud_lecture_1');
    expect(roundTripped[0].audioOffsetMs).toBe(14250);
    expect(roundTripped[0].points).toHaveLength(3);
    expect(roundTripped[0].points[1].p).toBeCloseTo(0.72, 2);
    expect(roundTripped[0].points[1].tx).toBeCloseTo(24, 1);
    expect(roundTripped[0].points[1].ty).toBeCloseTo(-15, 1);
  });

  it('recognizes 2-finger pinch/pan, 2-finger Undo, 3-finger Redo, and rejects palm touches while Apple Pencil writes', () => {
    const onPinchAndPan = vi.fn();
    const onTwoFingerTapUndo = vi.fn();
    const onThreeFingerTapRedo = vi.fn();
    const onPageSwipe = vi.fn();

    const recognizer = new IPadGestureRecognizer({
      onPinchAndPan,
      onTwoFingerTapUndo,
      onThreeFingerTapRedo,
      onPageSwipe,
    });

    // 1. Two-finger quick tap -> Undo
    recognizer.onPointerDown({ pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 300, timestampMs: 100 }, 1);
    recognizer.onPointerDown({ pointerId: 2, pointerType: 'touch', clientX: 280, clientY: 305, timestampMs: 115 }, 1);
    recognizer.onPointerUpOrCancel({ pointerId: 1, pointerType: 'touch', clientX: 202, clientY: 301, timestampMs: 210 });
    recognizer.onPointerUpOrCancel({ pointerId: 2, pointerType: 'touch', clientX: 281, clientY: 304, timestampMs: 220 });
    expect(onTwoFingerTapUndo).toHaveBeenCalledTimes(1);

    // 2. Three-finger quick tap -> Redo
    recognizer.onPointerDown({ pointerId: 3, pointerType: 'touch', clientX: 200, clientY: 300, timestampMs: 400 }, 1);
    recognizer.onPointerDown({ pointerId: 4, pointerType: 'touch', clientX: 250, clientY: 300, timestampMs: 410 }, 1);
    recognizer.onPointerDown({ pointerId: 5, pointerType: 'touch', clientX: 300, clientY: 300, timestampMs: 420 }, 1);
    recognizer.onPointerUpOrCancel({ pointerId: 3, pointerType: 'touch', clientX: 200, clientY: 300, timestampMs: 520 });
    recognizer.onPointerUpOrCancel({ pointerId: 4, pointerType: 'touch', clientX: 250, clientY: 300, timestampMs: 525 });
    recognizer.onPointerUpOrCancel({ pointerId: 5, pointerType: 'touch', clientX: 300, clientY: 300, timestampMs: 530 });
    expect(onThreeFingerTapRedo).toHaveBeenCalledTimes(1);

    // 3. Two-finger pinch-to-zoom (100px span -> 200px span => 2.0x zoom)
    recognizer.onPointerDown({ pointerId: 10, pointerType: 'touch', clientX: 200, clientY: 300, timestampMs: 700 }, 1);
    recognizer.onPointerDown({ pointerId: 11, pointerType: 'touch', clientX: 300, clientY: 300, timestampMs: 710 }, 1);
    recognizer.onPointerMove({ pointerId: 10, pointerType: 'touch', clientX: 150, clientY: 300, timestampMs: 760 });
    recognizer.onPointerMove({ pointerId: 11, pointerType: 'touch', clientX: 350, clientY: 300, timestampMs: 765 });
    expect(onPinchAndPan).toHaveBeenCalled();
    expect(onPinchAndPan.mock.calls.at(-1)?.[0].targetZoom).toBeCloseTo(2.0, 1);
    recognizer.onPointerUpOrCancel({ pointerId: 10, pointerType: 'touch', clientX: 150, clientY: 300, timestampMs: 800 });
    recognizer.onPointerUpOrCancel({ pointerId: 11, pointerType: 'touch', clientX: 350, clientY: 300, timestampMs: 805 });

    // 4. Palm Rejection: Active Apple Pencil blocks accidental 2-finger palm tap Undo!
    onTwoFingerTapUndo.mockClear();
    recognizer.onPointerDown({ pointerId: 99, pointerType: 'pen', clientX: 400, clientY: 400, timestampMs: 1000 }, 1);
    recognizer.onPointerDown({ pointerId: 20, pointerType: 'touch', clientX: 520, clientY: 540, timestampMs: 1020 }, 1);
    recognizer.onPointerDown({ pointerId: 21, pointerType: 'touch', clientX: 560, clientY: 550, timestampMs: 1030 }, 1);
    recognizer.onPointerUpOrCancel({ pointerId: 20, pointerType: 'touch', clientX: 520, clientY: 540, timestampMs: 1100 });
    recognizer.onPointerUpOrCancel({ pointerId: 21, pointerType: 'touch', clientX: 560, clientY: 550, timestampMs: 1110 });
    recognizer.onPointerUpOrCancel({ pointerId: 99, pointerType: 'pen', clientX: 450, clientY: 420, timestampMs: 1200 });
    expect(onTwoFingerTapUndo).not.toHaveBeenCalled();
  });

  it('resolves iPadOS Split View, Slide Over, Stage Manager, and iPhone form factors accurately', () => {
    expect(resolveWindowFormFactor(390, 'iOS')).toBe('iphone-compact');
    expect(resolveWindowFormFactor(375, 'iPadOS')).toBe('ipad-slide-over');
    expect(resolveWindowFormFactor(640, 'iPadOS')).toBe('ipad-split-view');
    expect(resolveWindowFormFactor(1024, 'iPadOS')).toBe('ipad-stage-regular');
  });

  it('flushes pending autosaves immediately on iOS didEnterBackground lifecycle transition and verifies backup archive integrity', async () => {
    const nb = createNotebook({ title: 'iPad Lifecycle Safety Test' });
    // Schedule a slow 10-second debounce so it would NOT have saved yet without lifecycle flush
    storage.scheduleAutosave(nb, 10_000);

    let flushedReason = '';
    const cleanup = registerIOSLifecyclePersistenceGuards({
      storage,
      getActiveDocument: () => nb,
      onLifecycleFlush: (r) => {
        flushedReason = r;
      },
    });

    dispatchNativeIOSEvent({
      type: 'appLifecycleState',
      state: 'didEnterBackground',
    });

    await waitFor(async () => {
      const persisted = await storage.getDocument(nb.id);
      expect(persisted?.title).toBe('iPad Lifecycle Safety Test');
      expect(flushedReason).toBe('ios-didEnterBackground');
    });
    cleanup();

    // Verify valid full backup & single notebook archive pass integrity checks
    const { bytes: validBackupBytes } = await exportFullLibraryBackupZip(storage);
    const fullAudit = await verifyBackupArchiveIntegrity(validBackupBytes);
    expect(fullAudit.valid).toBe(true);
    expect(fullAudit.format).toBe('inkvault-full-library-backup');
    expect(fullAudit.documentCount).toBe(1);

    const singleArchiveBytes = await exportSingleNotebookArchive(nb, storage);
    const singleAudit = await verifyBackupArchiveIntegrity(singleArchiveBytes);
    expect(singleAudit.valid).toBe(true);
    expect(singleAudit.format).toBe('inkvault-notebook-archive');

    // Verify corrupted archive is rejected cleanly before restore
    const corruptedBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
    const badAudit = await verifyBackupArchiveIntegrity(corruptedBytes);
    expect(badAudit.valid).toBe(false);
  });

  it('handles Apple Pencil double-tap tool switching, native PKCanvasView stroke commits, and incoming Files/AirDrop PDF import in <App />', async () => {
    render(<App storage={storage} />);

    // Open a Quick Note workspace
    const quickNoteBtn = await screen.findByTestId('quick-note-btn');
    fireEvent.click(quickNoteBtn);

    const penBtn = await screen.findByTestId('tool-pen');
    const eraserBtn = screen.getByTestId('tool-eraser');
    expect(penBtn).toHaveAttribute('data-active', 'true');

    // 1. Simulate Apple Pencil 2nd Gen / Pro hardware Double-Tap -> switches Pen to Eraser, then back to Pen!
    act(() => {
      dispatchNativeIOSEvent({
        type: 'pencilDoubleTap',
        preferredAction: 'switchEraser',
      });
    });
    await waitFor(() => {
      expect(eraserBtn).toHaveAttribute('data-active', 'true');
    });

    act(() => {
      dispatchNativeIOSEvent({
        type: 'pencilDoubleTap',
        preferredAction: 'switchEraser',
      });
    });
    await waitFor(() => {
      expect(penBtn).toHaveAttribute('data-active', 'true');
    });

    // 2. Simulate Native PKCanvasView stroke commit and verify it saves into INKVAULT's portable document!
    const docsBefore = await storage.listDocuments();
    const activeDoc = docsBefore[0];
    const activePage = activeDoc.pages[0];

    act(() => {
      dispatchNativeIOSEvent({
        type: 'nativeDrawingDidCommit',
        payload: {
          schema: 'inkvault-pencilkit-bridge-v1',
          documentId: activeDoc.id,
          pageId: activePage.id,
          strokes: [
            {
              id: 'pk_native_stroke_1',
              inkType: 'fountainPen',
              colorHex: '#18181B',
              opacity: 1,
              baseWidth: 2.6,
              points: [
                {
                  x: 80,
                  y: 120,
                  timeOffset: 0,
                  sizeWidth: 2.6,
                  sizeHeight: 2.6,
                  opacity: 1,
                  force: 0.6,
                  azimuth: 0,
                  altitude: Math.PI / 2,
                },
                {
                  x: 190,
                  y: 132,
                  timeOffset: 0.02,
                  sizeWidth: 2.8,
                  sizeHeight: 2.8,
                  opacity: 1,
                  force: 0.75,
                  azimuth: 0,
                  altitude: Math.PI / 2,
                },
              ],
            },
          ],
        },
      });
    });

    await storage.flushPendingSaves();
    const updatedDoc = await storage.getDocument(activeDoc.id);
    expect(updatedDoc?.pages[0].strokes).toHaveLength(1);
    expect(updatedDoc?.pages[0].strokes[0].id).toBe('pk_native_stroke_1');

    // 3. Simulate AirDrop / Files App `onOpenURL` incoming PDF import
    const sampleSourceNb = createNotebook({ title: 'Source PDF Sample' });
    const samplePdfBytes = await exportDocumentToPdfBytes(sampleSourceNb, storage, {
      includeBackground: true,
      includeAnnotations: true,
      includeTapeMasks: false,
      embedEditableMetadata: false,
    });

    await act(async () => {
      dispatchNativeIOSEvent({
        type: 'nativeDocumentImported',
        fileName: 'AirDropped_Lecture_Slides.pdf',
        mimeType: 'application/pdf',
        base64Data: uint8ToBase64(samplePdfBytes),
      });
    });

    await waitFor(async () => {
      const allDocs = await storage.listDocuments();
      expect(allDocs.some((d) => d.title.includes('AirDropped_Lecture_Slides'))).toBe(true);
    });
  });

  it('routes OCR through offline native Apple Vision framework when running inside native iPadOS shell', async () => {
    const sentCommands: WebToNativeCommand[] = [];
    const prevWebkit = window.webkit;
    window.webkit = {
      messageHandlers: {
        inkvaultNative: {
          postMessage: (msg) => {
            sentCommands.push(msg);
            if (msg.command === 'recognizeTextVision') {
              setTimeout(() => {
                dispatchNativeIOSEvent({
                  type: 'visionOcrResult',
                  requestId: msg.requestId,
                  text: 'Offline Neural Engine Handwriting Result',
                });
              }, 5);
            }
          },
        },
      },
    };

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 40;
      const text = await defaultTesseractRecognizer(canvas);
      expect(text).toBe('Offline Neural Engine Handwriting Result');
      expect(sentCommands.some((c) => c.command === 'recognizeTextVision')).toBe(true);
    } finally {
      window.webkit = prevWebkit;
    }
  });
});
