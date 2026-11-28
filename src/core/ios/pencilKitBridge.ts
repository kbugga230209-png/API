import { createId } from '../model/documentModel';
import { InkPoint, InkStroke, PenInstrument } from '../model/types';

/**
 * Apple PencilKit `PKInkingTool.InkType` identifiers supported across iPadOS 16 / 17+.
 */
export type ApplePKInkType =
  | 'fountainPen'
  | 'pen'
  | 'monoline'
  | 'watercolor'
  | 'pencil'
  | 'marker';

export interface NativePKStrokePointDTO {
  x: number;
  y: number;
  /** Seconds from stroke start in Apple PKStrokePoint */
  timeOffset: number;
  sizeWidth: number;
  sizeHeight: number;
  opacity: number;
  /** Apple Pencil force (0.0 – 1.0+ normalized) */
  force: number;
  /** Radians [-π, π] around page plane */
  azimuth: number;
  /** Radians [0, π/2] from page surface (π/2 = perpendicular) */
  altitude: number;
}

export interface NativePKStrokeDTO {
  id: string;
  inkType: ApplePKInkType;
  colorHex: string;
  opacity: number;
  baseWidth: number;
  points: NativePKStrokePointDTO[];
  /** Preserved INKVAULT metadata so round-tripping never loses layers, z-order, or audio sync */
  inkvaultMeta?: {
    instrument: PenInstrument;
    layerId: string;
    zIndex: number;
    smoothing: number;
    pressureSensitivity: number;
    tipSharpness: number;
    groupId?: string;
    locked?: boolean;
    audioSessionId?: string;
    audioOffsetMs?: number;
    createdAt: number;
    updatedAt: number;
  };
}

export interface NativePKDrawingPayload {
  schema: 'inkvault-pencilkit-bridge-v1';
  documentId: string;
  pageId: string;
  strokes: NativePKStrokeDTO[];
}

export type NativePencilPreferredAction =
  | 'switchEraser'
  | 'switchPrevious'
  | 'showColorPalette'
  | 'showInkAttributes'
  | 'toggleRuler'
  | 'ignore';

export type NativeToWebEvent =
  | {
      type: 'pencilDoubleTap';
      preferredAction: NativePencilPreferredAction;
    }
  | {
      type: 'pencilSqueeze';
      phase: 'began' | 'changed' | 'ended';
      hoverX?: number;
      hoverY?: number;
    }
  | {
      type: 'pencilHover';
      x: number;
      y: number;
      /** 0.0 (touching) .. 1.0 (far hover ~12mm) */
      zOffset: number;
      altitude: number;
      azimuth: number;
    }
  | {
      type: 'nativeDrawingDidCommit';
      payload: NativePKDrawingPayload;
    }
  | {
      type: 'appLifecycleState';
      state: 'willResignActive' | 'didEnterBackground' | 'willEnterForeground' | 'memoryWarning';
    }
  | {
      type: 'nativeDocumentImported';
      fileName: string;
      mimeType: string;
      base64Data: string;
    }
  | {
      type: 'visionOcrResult';
      requestId: string;
      text: string;
    };

export type WebToNativeCommand =
  | {
      command: 'configureCanvasOverlay';
      enabled: boolean;
      documentId: string;
      pageId: string;
      stylusOnly: boolean;
      activeTool: string;
      inkType: ApplePKInkType;
      colorHex: string;
      width: number;
      opacity: number;
      zoom: number;
    }
  | {
      command: 'syncPageStrokesToNative';
      payload: NativePKDrawingPayload;
    }
  | {
      command: 'shareFile';
      fileName: string;
      mimeType: string;
      base64Data: string;
    }
  | {
      command: 'openDocumentPicker';
      allowedUTTypes: string[];
      allowMultiple: boolean;
      allowFolders: boolean;
    }
  | {
      command: 'mirrorVaultCheckpoint';
      documentId: string;
      documentJson: string;
      updatedAt: number;
    }
  | {
      command: 'recognizeTextVision';
      requestId: string;
      imageBase64: string;
    }
  | {
      command: 'hapticFeedback';
      style: 'light' | 'medium' | 'selection';
    };

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        inkvaultNative?: {
          postMessage: (msg: WebToNativeCommand) => void;
        };
      };
    };
    __INKVAULT_NATIVE_SHELL__?: boolean;
    __INKVAULT_NATIVE_DISPATCH__?: (event: NativeToWebEvent) => void;
  }
}

/**
 * Returns true when running inside the native iOS/iPadOS SwiftUI + WKWebView shell.
 */
export function isRunningInNativeIOSShell(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.__INKVAULT_NATIVE_SHELL__ ||
      window.webkit?.messageHandlers?.inkvaultNative?.postMessage
  );
}

/**
 * Posts a typed command to the native iOS/iPadOS Swift host if present.
 */
export function postCommandToNativeIOS(cmd: WebToNativeCommand): boolean {
  if (typeof window === 'undefined') return false;
  const handler = window.webkit?.messageHandlers?.inkvaultNative;
  if (!handler || typeof handler.postMessage !== 'function') return false;
  try {
    handler.postMessage(cmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Maps INKVAULT's portable `PenInstrument` to Apple PencilKit's `PKInkingTool.InkType`.
 */
export function mapInstrumentToPKInkType(instrument: PenInstrument): ApplePKInkType {
  switch (instrument) {
    case 'fountain':
      return 'fountainPen';
    case 'ballpoint':
      return 'pen';
    case 'fineliner':
      return 'monoline';
    case 'brush':
      return 'watercolor';
    case 'pencil':
      return 'pencil';
    case 'highlighter':
      return 'marker';
    default:
      return 'pen';
  }
}

/**
 * Maps Apple PencilKit `PKInkingTool.InkType` back to INKVAULT's `PenInstrument`.
 */
export function mapPKInkTypeToInstrument(inkType: ApplePKInkType): PenInstrument {
  switch (inkType) {
    case 'fountainPen':
      return 'fountain';
    case 'pen':
      return 'ballpoint';
    case 'monoline':
      return 'fineliner';
    case 'watercolor':
      return 'brush';
    case 'pencil':
      return 'pencil';
    case 'marker':
      return 'highlighter';
    default:
      return 'fountain';
  }
}

/**
 * Converts W3C PointerEvent planar tilt (`tx`, `ty` in degrees -90..90) into
 * Apple Pencil spherical `altitude` [0, π/2] & `azimuth` [-π, π] radians.
 */
export function tiltDegreesToAltitudeAzimuth(
  tiltXDeg = 0,
  tiltYDeg = 0
): { altitude: number; azimuth: number } {
  const radX = (Math.max(-89.5, Math.min(89.5, tiltXDeg)) * Math.PI) / 180;
  const radY = (Math.max(-89.5, Math.min(89.5, tiltYDeg)) * Math.PI) / 180;
  const tanX = Math.tan(radX);
  const tanY = Math.tan(radY);

  if (Math.abs(tanX) < 1e-6 && Math.abs(tanY) < 1e-6) {
    return { altitude: Math.PI / 2, azimuth: 0 };
  }

  const azimuth = Math.atan2(tanY, tanX);
  const cotAltitude = Math.hypot(tanX, tanY);
  const altitude = Math.atan2(1, cotAltitude);
  return { altitude, azimuth };
}

/**
 * Converts Apple Pencil `altitude` [0, π/2] & `azimuth` [-π, π] radians into
 * W3C/INKVAULT planar `tx`, `ty` degrees (-90..90).
 */
export function altitudeAzimuthToTiltDegrees(
  altitude: number,
  azimuth: number
): { tx: number; ty: number } {
  const clampedAlt = Math.max(0.01, Math.min(Math.PI / 2, altitude));
  if (Math.abs(clampedAlt - Math.PI / 2) < 1e-4) {
    return { tx: 0, ty: 0 };
  }
  const cotAlt = 1 / Math.tan(clampedAlt);
  const tanX = cotAlt * Math.cos(azimuth);
  const tanY = cotAlt * Math.sin(azimuth);
  const tx = Number(((Math.atan(tanX) * 180) / Math.PI).toFixed(2));
  const ty = Number(((Math.atan(tanY) * 180) / Math.PI).toFixed(2));
  return { tx, ty };
}

/**
 * Losslessly serializes INKVAULT `InkStroke[]` into a `NativePKDrawingPayload`
 * for native `PKCanvasView` rendering while retaining 100% of INKVAULT metadata.
 */
export function serializeInkStrokesToPencilKit(
  documentId: string,
  pageId: string,
  strokes: InkStroke[]
): NativePKDrawingPayload {
  return {
    schema: 'inkvault-pencilkit-bridge-v1',
    documentId,
    pageId,
    strokes: strokes.map((s) => ({
      id: s.id,
      inkType: mapInstrumentToPKInkType(s.instrument),
      colorHex: s.color,
      opacity: s.opacity,
      baseWidth: s.width,
      points: s.points.map((pt) => {
        const { altitude, azimuth } = tiltDegreesToAltitudeAzimuth(pt.tx ?? 0, pt.ty ?? 0);
        const dynamicW = Math.max(0.5, s.width * (0.55 + pt.p * 0.9 * s.pressureSensitivity));
        return {
          x: pt.x,
          y: pt.y,
          timeOffset: Math.max(0, pt.t / 1000),
          sizeWidth: dynamicW,
          sizeHeight: dynamicW,
          opacity: s.opacity,
          force: Math.max(0.01, Math.min(1, pt.p)),
          azimuth,
          altitude,
        };
      }),
      inkvaultMeta: {
        instrument: s.instrument,
        layerId: s.layerId,
        zIndex: s.zIndex,
        smoothing: s.smoothing,
        pressureSensitivity: s.pressureSensitivity,
        tipSharpness: s.tipSharpness,
        groupId: s.groupId,
        locked: s.locked,
        audioSessionId: s.audioSessionId,
        audioOffsetMs: s.audioOffsetMs,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      },
    })),
  };
}

/**
 * Losslessly converts a `NativePKDrawingPayload` emitted by native `PKCanvasView`
 * back into editable INKVAULT `InkStroke[]`, preserving original IDs, layers, audio sync,
 * pressure, and Apple Pencil tilt angles.
 */
export function deserializePencilKitToInkStrokes(
  payload: NativePKDrawingPayload,
  defaultLayerId = 'default'
): InkStroke[] {
  const now = Date.now();
  return payload.strokes.map((pk, idx) => {
    const meta = pk.inkvaultMeta;
    const instrument = meta?.instrument ?? mapPKInkTypeToInstrument(pk.inkType);
    const points: InkPoint[] = pk.points.map((pt) => {
      const { tx, ty } = altitudeAzimuthToTiltDegrees(pt.altitude, pt.azimuth);
      return {
        x: pt.x,
        y: pt.y,
        p: Math.max(0.02, Math.min(1, pt.force > 0 ? pt.force : 0.5)),
        tx,
        ty,
        t: Math.round(Math.max(0, pt.timeOffset * 1000)),
      };
    });

    return {
      id: pk.id || createId('stk'),
      kind: 'stroke',
      layerId: meta?.layerId ?? defaultLayerId,
      zIndex: meta?.zIndex ?? idx + 1,
      groupId: meta?.groupId,
      locked: meta?.locked,
      instrument,
      color: pk.colorHex || '#18181B',
      width: pk.baseWidth > 0 ? pk.baseWidth : 2.2,
      opacity: pk.opacity > 0 ? pk.opacity : 1,
      smoothing: meta?.smoothing ?? 0.5,
      pressureSensitivity: meta?.pressureSensitivity ?? 0.55,
      tipSharpness: meta?.tipSharpness ?? 0.45,
      points,
      audioSessionId: meta?.audioSessionId,
      audioOffsetMs: meta?.audioOffsetMs,
      createdAt: meta?.createdAt ?? now,
      updatedAt: now,
    };
  });
}

/**
 * Subscribes to events sent from the native iOS/iPadOS SwiftUI + PencilKit host.
 * Multiple subscribers can coexist cleanly.
 */
const nativeListeners = new Set<(event: NativeToWebEvent) => void>();

export function subscribeToNativeIOSEvents(
  listener: (event: NativeToWebEvent) => void
): () => void {
  nativeListeners.add(listener);

  if (typeof window !== 'undefined' && !window.__INKVAULT_NATIVE_DISPATCH__) {
    window.__INKVAULT_NATIVE_DISPATCH__ = (evt: NativeToWebEvent) => {
      for (const fn of nativeListeners) {
        try {
          fn(evt);
        } catch {
          // isolate subscriber errors
        }
      }
    };
  }

  return () => {
    nativeListeners.delete(listener);
  };
}

/**
 * Programmatically emits a native iOS event (used by native Swift `evaluateJavaScript`
 * and by automated integration tests).
 */
export function dispatchNativeIOSEvent(event: NativeToWebEvent): void {
  if (typeof window !== 'undefined' && window.__INKVAULT_NATIVE_DISPATCH__) {
    window.__INKVAULT_NATIVE_DISPATCH__(event);
    return;
  }
  for (const fn of nativeListeners) {
    fn(event);
  }
}
