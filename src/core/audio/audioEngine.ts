import { createId } from '../model/documentModel';
import { AudioSessionMeta, InkVaultDocument } from '../model/types';
import { base64ToUint8 } from '../storage/cryptoVault';
import { InkVaultStorageEngine } from '../storage/storageEngine';

export interface ActiveAudioRecordingController {
  sessionId: string;
  getElapsedMs: () => number;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  stopAndSave: (title?: string) => Promise<AudioSessionMeta>;
}

/**
 * Starts a real microphone `MediaRecorder` session with accurate pause-adjusted elapsed clock
 * so every handwriting stroke drawn during recording receives an exact `audioOffsetMs` timestamp!
 */
export async function startAudioRecordingSession(
  pageIdAtStart: string,
  storage: InkVaultStorageEngine,
  sessionNumber: number
): Promise<ActiveAudioRecordingController> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone recording is not supported in this browser context.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const mimeType =
    preferredTypes.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ||
    'audio/webm';

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  const sessionId = createId('aud');

  let accumulatedMs = 0;
  let segmentStartPerf = performance.now();
  let paused = false;

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  recorder.start(250);

  const getElapsedMs = () => {
    if (paused) return Math.round(accumulatedMs);
    return Math.round(accumulatedMs + (performance.now() - segmentStartPerf));
  };

  return {
    sessionId,
    getElapsedMs,
    isPaused: () => paused,
    pause: () => {
      if (!paused && recorder.state === 'recording') {
        accumulatedMs += performance.now() - segmentStartPerf;
        paused = true;
        recorder.pause();
      }
    },
    resume: () => {
      if (paused && recorder.state === 'paused') {
        segmentStartPerf = performance.now();
        paused = false;
        recorder.resume();
      }
    },
    stopAndSave: async (title?: string) => {
      const finalDurationMs = Math.max(200, getElapsedMs());
      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          resolve(new Blob(chunks, { type: mimeType }));
        }
      });
      stream.getTracks().forEach((tr) => tr.stop());

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const asset = await storage.storeBinaryAsset(
        bytes,
        mimeType,
        `recording-${sessionNumber}.webm`
      );

      return {
        id: sessionId,
        title: title || `Audio Session ${sessionNumber}`,
        assetId: asset.id,
        mimeType,
        durationMs: finalDurationMs,
        createdAt: Date.now(),
        pageIdAtStart,
      };
    },
  };
}

/**
 * Loads an audio session's binary asset as an Object URL for HTMLAudioElement playback or file export.
 */
export async function getAudioSessionBlobUrl(
  session: AudioSessionMeta,
  storage: InkVaultStorageEngine
): Promise<{ url: string; bytes: Uint8Array } | null> {
  const asset = await storage.getAsset(session.assetId);
  if (!asset) return null;
  const bytes = base64ToUint8(asset.dataBase64);
  const mime = session.mimeType || 'audio/webm';
  const url =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
      : `data:${mime};base64,${asset.dataBase64}`;
  return {
    url,
    bytes,
  };
}

/**
 * Finds all handwriting strokes linked to a given `audioSessionId` across all pages of a notebook,
 * sorted chronologically by `audioOffsetMs`.
 */
export function listSyncedStrokesForAudioSession(
  doc: InkVaultDocument,
  sessionId: string
): { strokeId: string; pageId: string; pageIndex: number; offsetMs: number }[] {
  const list: { strokeId: string; pageId: string; pageIndex: number; offsetMs: number }[] = [];
  doc.pages.forEach((page, pageIndex) => {
    for (const s of page.strokes) {
      if (s.audioSessionId === sessionId && typeof s.audioOffsetMs === 'number') {
        list.push({
          strokeId: s.id,
          pageId: page.id,
          pageIndex,
          offsetMs: s.audioOffsetMs,
        });
      }
    }
  });
  return list.sort((a, b) => a.offsetMs - b.offsetMs);
}
