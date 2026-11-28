import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Mic,
  Pause,
  Play,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  ActiveAudioRecordingController,
  getAudioSessionBlobUrl,
  listSyncedStrokesForAudioSession,
  startAudioRecordingSession,
} from '../../core/audio/audioEngine';
import { AudioSessionMeta, InkVaultDocument } from '../../core/model/types';
import { InkVaultStorageEngine } from '../../core/storage/storageEngine';

interface AudioNotesBarProps {
  doc: InkVaultDocument;
  storage: InkVaultStorageEngine;
  externalSeekRequest: { sessionId: string; offsetMs: number; token: number } | null;
  onRecordingContextChange: (ctx: {
    sessionId: string | null;
    getOffsetMs: () => number;
  }) => void;
  onPlaybackSyncChange: (sync: {
    sessionId: string | null;
    offsetMs: number | null;
  }) => void;
  onAddAudioSession: (session: AudioSessionMeta) => void;
  onDeleteAudioSession: (sessionId: string) => void;
  onNavigateToPage: (pageIndex: number) => void;
  onClose: () => void;
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const AudioNotesBar: React.FC<AudioNotesBarProps> = ({
  doc,
  storage,
  externalSeekRequest,
  onRecordingContextChange,
  onPlaybackSyncChange,
  onAddAudioSession,
  onDeleteAudioSession,
  onNavigateToPage,
  onClose,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    doc.audioSessions[0]?.id ?? null
  );
  const [recordingCtrl, setRecordingCtrl] =
    useState<ActiveAudioRecordingController | null>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const activeSession =
    doc.audioSessions.find((s) => s.id === selectedSessionId) ??
    doc.audioSessions[0] ??
    null;

  useEffect(() => {
    if (!selectedSessionId && doc.audioSessions.length > 0) {
      setSelectedSessionId(doc.audioSessions[0].id);
    }
  }, [doc.audioSessions, selectedSessionId]);

  // Load selected session blob into HTMLAudioElement
  useEffect(() => {
    let cancelled = false;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlaying(false);
    setPlaybackMs(0);

    if (!activeSession) return;
    getAudioSessionBlobUrl(activeSession, storage).then((loaded) => {
      if (cancelled || !loaded) return;
      objectUrlRef.current = loaded.url;
      if (audioRef.current) {
        audioRef.current.src = loaded.url;
        audioRef.current.playbackRate = playbackRate;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSession?.id, storage]);

  // Handle tap-on-stroke seek requests from canvas!
  useEffect(() => {
    if (!externalSeekRequest) return;
    setSelectedSessionId(externalSeekRequest.sessionId);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = externalSeekRequest.offsetMs / 1000;
        setPlaybackMs(externalSeekRequest.offsetMs);
        onPlaybackSyncChange({
          sessionId: externalSeekRequest.sessionId,
          offsetMs: externalSeekRequest.offsetMs,
        });
        audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
      }
    }, 80);
  }, [externalSeekRequest?.token]);

  // Live clock ticker while recording
  useEffect(() => {
    if (!recordingCtrl) return;
    const id = window.setInterval(() => {
      setRecordingElapsedMs(recordingCtrl.getElapsedMs());
      setRecordingPaused(recordingCtrl.isPaused());
    }, 150);
    return () => window.clearInterval(id);
  }, [recordingCtrl]);

  const handleStartRecording = async () => {
    setMicError(null);
    try {
      const currentPage = doc.pages[doc.activePageIndex] ?? doc.pages[0];
      const ctrl = await startAudioRecordingSession(
        currentPage.id,
        storage,
        doc.audioSessions.length + 1
      );
      setRecordingCtrl(ctrl);
      onRecordingContextChange({
        sessionId: ctrl.sessionId,
        getOffsetMs: ctrl.getElapsedMs,
      });
    } catch (err) {
      setMicError(
        err instanceof Error ? err.message : 'Microphone access denied or unavailable.'
      );
    }
  };

  const handleStopRecording = async () => {
    if (!recordingCtrl) return;
    const saved = await recordingCtrl.stopAndSave();
    setRecordingCtrl(null);
    setRecordingElapsedMs(0);
    onRecordingContextChange({ sessionId: null, getOffsetMs: () => 0 });
    onAddAudioSession(saved);
    setSelectedSessionId(saved.id);
  };

  const handleExportSession = async () => {
    if (!activeSession) return;
    const loaded = await getAudioSessionBlobUrl(activeSession, storage);
    if (!loaded) return;
    const a = document.createElement('a');
    a.href = loaded.url;
    const ext = activeSession.mimeType.includes('mp4') ? 'm4a' : 'webm';
    a.download = `${activeSession.title.replace(/\s+/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(loaded.url), 2500);
  };

  const syncedStrokes = activeSession
    ? listSyncedStrokesForAudioSession(doc, activeSession.id)
    : [];
  const durationMs = Math.max(1000, activeSession?.durationMs || 1000);

  return (
    <div
      data-testid="audio-notes-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 14px',
        background: 'var(--iv-bg-surface)',
        borderBottom: '1px solid var(--iv-border)',
        flexWrap: 'wrap',
        fontSize: 12,
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (!audioRef.current || !activeSession) return;
          const ms = Math.round(audioRef.current.currentTime * 1000);
          setPlaybackMs(ms);
          onPlaybackSyncChange({ sessionId: activeSession.id, offsetMs: ms });
        }}
        onEnded={() => {
          setPlaying(false);
          onPlaybackSyncChange({ sessionId: null, offsetMs: null });
        }}
      />

      {/* Recording Controls */}
      {!recordingCtrl ? (
        <button
          type="button"
          className="iv-btn iv-btn-danger"
          style={{ height: 28, fontSize: 12 }}
          onClick={handleStartRecording}
        >
          <Mic size={13} />
          Record Audio Note
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              background: 'var(--iv-danger-soft)',
              color: 'var(--iv-danger)',
              fontWeight: 700,
              fontFamily: 'var(--iv-font-mono)',
            }}
          >
            ● {formatClock(recordingElapsedMs)} {recordingPaused ? '(Paused)' : 'Syncing Ink'}
          </span>
          <button
            type="button"
            className="iv-btn"
            style={{ height: 28 }}
            onClick={() =>
              recordingPaused ? recordingCtrl.resume() : recordingCtrl.pause()
            }
          >
            {recordingPaused ? <Play size={13} /> : <Pause size={13} />}
            {recordingPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            className="iv-btn iv-btn-primary"
            style={{ height: 28 }}
            onClick={handleStopRecording}
          >
            <Square size={12} />
            Save Session
          </button>
        </div>
      )}

      {/* Multi-session selector & Synchronised Playback Timeline */}
      {doc.audioSessions.length > 0 && activeSession && (
        <>
          <div style={{ width: 1, height: 18, background: 'var(--iv-border)' }} />
          <select
            className="iv-select"
            style={{ height: 28, fontSize: 12 }}
            value={activeSession.id}
            onChange={(e) => setSelectedSessionId(e.target.value)}
          >
            {doc.audioSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({formatClock(s.durationMs)})
              </option>
            ))}
          </select>

          <button
            type="button"
            className="iv-tool-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => {
              if (!audioRef.current) return;
              if (playing) {
                audioRef.current.pause();
                setPlaying(false);
              } else {
                audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
              }
            }}
            title={playing ? 'Pause Playback' : 'Play Synchronised Audio'}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <span style={{ fontFamily: 'var(--iv-font-mono)', fontSize: 11.5 }}>
            {formatClock(playbackMs)} / {formatClock(durationMs)}
          </span>

          {/* Scrubber with Handwriting Stroke Timestamp Ticks */}
          <div style={{ position: 'relative', flex: 1, minWidth: 160, display: 'flex', alignItems: 'center' }}>
            <input
              type="range"
              min={0}
              max={durationMs}
              value={Math.min(durationMs, playbackMs)}
              onChange={(e) => {
                const nextMs = Number(e.target.value);
                setPlaybackMs(nextMs);
                if (audioRef.current) audioRef.current.currentTime = nextMs / 1000;
                onPlaybackSyncChange({ sessionId: activeSession.id, offsetMs: nextMs });

                // Jump to page of nearest synced stroke if on another page
                const near = syncedStrokes.find((st) => Math.abs(st.offsetMs - nextMs) < 1500);
                if (near && near.pageIndex !== doc.activePageIndex) {
                  onNavigateToPage(near.pageIndex);
                }
              }}
              style={{ width: '100%' }}
            />
          </div>

          <span className="iv-badge" title="Strokes linked to this audio recording">
            {syncedStrokes.length} synced strokes
          </span>

          <button
            type="button"
            className="iv-btn"
            style={{ height: 26, fontSize: 11, padding: '0 8px' }}
            onClick={() => {
              const rates = [0.75, 1, 1.25, 1.5, 2];
              const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
              setPlaybackRate(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
          >
            {playbackRate}×
          </button>

          <button
            type="button"
            className="iv-tool-btn"
            style={{ width: 28, height: 28 }}
            onClick={handleExportSession}
            title="Export Audio File"
          >
            <Download size={14} />
          </button>

          <button
            type="button"
            className="iv-tool-btn"
            style={{ width: 28, height: 28, color: 'var(--iv-danger)' }}
            onClick={() => {
              onDeleteAudioSession(activeSession.id);
              onPlaybackSyncChange({ sessionId: null, offsetMs: null });
            }}
            title="Delete Audio Session"
          >
            <Trash2 size={14} />
          </button>
        </>
      )}

      {micError && (
        <span style={{ color: 'var(--iv-danger)', fontSize: 11.5 }}>{micError}</span>
      )}

      <button
        type="button"
        className="iv-tool-btn"
        style={{ width: 26, height: 26, marginLeft: 'auto' }}
        onClick={() => {
          onPlaybackSyncChange({ sessionId: null, offsetMs: null });
          onClose();
        }}
        title="Hide Audio Bar"
      >
        <X size={14} />
      </button>
    </div>
  );
};
