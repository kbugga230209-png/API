import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HardDrive,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { AppSettings, SyncConflictRecord } from '../../core/model/types';
import {
  canUseAppleShareSheet,
  shareOrExportToAppleFiles,
  verifyBackupArchiveIntegrity,
} from '../../core/ios/iosFileAndLifecycleBridge';
import {
  exportFullLibraryBackupZip,
  reconcileSyncBundle,
  resolveSyncConflict,
  restoreFullLibraryBackupZip,
  SyncPayloadBundle,
} from '../../core/storage/backupAndSync';
import { InkVaultStorageEngine } from '../../core/storage/storageEngine';
import { formatBytes, Modal } from '../../design/components';

interface BackupAndSyncModalProps {
  open: boolean;
  storage: InkVaultStorageEngine;
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onLibraryRestoredOrSynced: () => Promise<void>;
  onClose: () => void;
}

export const BackupAndSyncModal: React.FC<BackupAndSyncModalProps> = ({
  open,
  storage,
  settings,
  onUpdateSettings,
  onLibraryRestoredOrSynced,
  onClose,
}) => {
  const [stats, setStats] = useState<{
    documentCount: number;
    trashedCount: number;
    folderCount: number;
    studySetCount: number;
    assetCount: number;
    totalAssetBytes: number;
    versionSnapshotCount: number;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflictRecord[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      storage.getStorageStats().then(setStats);
      setStatusMsg(null);
      setErrorMsg(null);
    }
  }, [open, storage]);

  const handleDownloadFullBackup = async (preferShareSheet = false) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const { bytes, manifest } = await exportFullLibraryBackupZip(storage);
      const dateStr = new Date().toISOString().slice(0, 10);
      await shareOrExportToAppleFiles({
        bytes,
        fileName: `inkvault-full-backup-${dateStr}.inkvault-backup.zip`,
        mimeType: 'application/zip',
        preferShareSheet,
      });

      onUpdateSettings({ ...settings, lastBackupAt: manifest.createdAt });
      setStatusMsg(
        `Exported complete library backup (${manifest.documentCount} notebooks, ${manifest.assetCount} binary assets, ${manifest.versionCount} version snapshots).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Backup export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (file: File) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const integrity = await verifyBackupArchiveIntegrity(bytes);
      if (!integrity.valid) {
        throw new Error(
          integrity.errorMessage ||
            'Backup integrity verification failed — local notebooks were kept untouched.'
        );
      }
      const manifest = await restoreFullLibraryBackupZip(
        bytes,
        storage,
        restoreMode
      );
      await onLibraryRestoredOrSynced();
      const nextStats = await storage.getStorageStats();
      setStats(nextStats);
      setStatusMsg(
        `Verified SHA-256 (${integrity.sha256.slice(0, 12)}…) & restored ${manifest.documentCount} notebooks, ${manifest.folderCount} folders, and ${manifest.studySetCount} study sets (${restoreMode} mode).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSyncWithEndpoint = async () => {
    if (!settings.syncEndpointUrl.trim()) {
      setErrorMsg('Enter a valid Sync Endpoint URL or use Sync Bundle File import/export below.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const [docs, folders, sets] = await Promise.all([
        storage.listDocuments(),
        storage.listFolders(),
        storage.listStudySets(),
      ]);
      const localBundle: SyncPayloadBundle = {
        format: 'inkvault-sync-bundle',
        exportedAt: Date.now(),
        documents: docs,
        folders,
        studySets: sets,
      };
      const resp = await fetch(settings.syncEndpointUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localBundle),
      });
      if (!resp.ok) {
        throw new Error(`Sync endpoint responded with HTTP ${resp.status}`);
      }
      const remoteBundle = (await resp.json()) as SyncPayloadBundle;
      const result = await reconcileSyncBundle(remoteBundle, storage, settings.lastSyncAt);
      setConflicts(result.conflicts);
      const now = Date.now();
      onUpdateSettings({ ...settings, lastSyncAt: now });
      await onLibraryRestoredOrSynced();
      setStatusMsg(
        `Sync completed: ${result.appliedRemoteDocs} remote document(s) applied, ${result.conflicts.length} conflict(s) detected.`
      );
    } catch (err) {
      setErrorMsg(
        `Sync endpoint unreachable (${err instanceof Error ? err.message : 'network error'}). Local notes remain 100% safe offline.`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImportSyncBundleFile = async (file: File) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as SyncPayloadBundle;
      const result = await reconcileSyncConflictCheck(bundle);
      setStatusMsg(
        `Reconciled sync bundle: ${result.appliedRemoteDocs} updated, ${result.conflicts.length} conflict(s) flagged for review.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid sync bundle JSON');
    } finally {
      setBusy(false);
    }
  };

  const reconcileSyncConflictCheck = async (bundle: SyncPayloadBundle) => {
    const res = await reconcileSyncBundle(bundle, storage, settings.lastSyncAt);
    setConflicts(res.conflicts);
    onUpdateSettings({ ...settings, lastSyncAt: Date.now() });
    await onLibraryRestoredOrSynced();
    return res;
  };

  const handleExportSyncBundleFile = async () => {
    const [docs, folders, sets] = await Promise.all([
      storage.listDocuments(),
      storage.listFolders(),
      storage.listStudySets(),
    ]);
    const bundle: SyncPayloadBundle = {
      format: 'inkvault-sync-bundle',
      exportedAt: Date.now(),
      documents: docs,
      folders,
      studySets: sets,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkvault-sync-state-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Modal
      open={open}
      title="Local Storage, Full Backup & Cross-Device Sync"
      subtitle="100% local ownership — zero subscription required to access, back up, or restore your library"
      maxWidth={660}
      onClose={onClose}
      footer={
        <button type="button" className="iv-btn iv-btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Telemetry Summary */}
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))',
              gap: 8,
            }}
          >
            {[
              { label: 'Active Notebooks', val: stats.documentCount },
              { label: 'Folders', val: stats.folderCount },
              { label: 'Version Snapshots', val: stats.versionSnapshotCount },
              { label: 'Study Sets', val: stats.studySetCount },
              { label: 'Asset Storage', val: formatBytes(stats.totalAssetBytes) },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: 10,
                  borderRadius: 'var(--iv-radius-md)',
                  background: 'var(--iv-bg-subtle)',
                  border: '1px solid var(--iv-border)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--iv-text-secondary)' }}>{item.label}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{item.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Full Library Backup & Restore */}
        <div
          style={{
            padding: 14,
            borderRadius: 'var(--iv-radius-md)',
            border: '1px solid var(--iv-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <HardDrive size={16} color="var(--iv-accent)" />
                Complete Library Backup (.inkvault-backup.zip)
              </div>
              <div style={{ fontSize: 12, color: 'var(--iv-text-secondary)' }}>
                {settings.lastBackupAt
                  ? `Last backup: ${new Date(settings.lastBackupAt).toLocaleString()}`
                  : 'Includes all notebooks, encrypted vaults, PDFs, audio, study sets & version history'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {canUseAppleShareSheet() && (
                <button
                  type="button"
                  className="iv-btn"
                  disabled={busy}
                  onClick={() => handleDownloadFullBackup(true)}
                  data-testid="share-full-backup-btn"
                >
                  Save to Files / Share
                </button>
              )}
              <button
                type="button"
                className="iv-btn iv-btn-primary"
                disabled={busy}
                onClick={() => handleDownloadFullBackup(false)}
                data-testid="download-full-backup-btn"
              >
                <Download size={14} />
                Back Up Full Library
              </button>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--iv-border)',
              paddingTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>Restore Mode:</span>
              <div className="iv-segmented">
                <button
                  type="button"
                  className="iv-segmented-item"
                  data-active={restoreMode === 'merge'}
                  onClick={() => setRestoreMode('merge')}
                >
                  Merge Into Vault
                </button>
                <button
                  type="button"
                  className="iv-segmented-item"
                  data-active={restoreMode === 'replace'}
                  onClick={() => setRestoreMode('replace')}
                >
                  Replace Entire Vault
                </button>
              </div>
            </div>

            <label className="iv-btn" style={{ cursor: 'pointer' }}>
              <Upload size={14} />
              Restore Backup Archive...
              <input
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleRestoreFile(file);
                  e.currentTarget.value = '';
                }}
                data-testid="restore-backup-input"
              />
            </label>
          </div>
        </div>

        {/* Optional Cross-Device Sync & Conflict Resolution */}
        <div
          style={{
            padding: 14,
            borderRadius: 'var(--iv-radius-md)',
            border: '1px solid var(--iv-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            Optional Cross-Device Synchronisation &amp; Conflict Resolution
          </div>
          <div style={{ fontSize: 12, color: 'var(--iv-text-secondary)' }}>
            Sync via your own self-hosted REST/WebDAV JSON endpoint or exchange portable Sync State bundles across iPad, Mac, Windows &amp; Android.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="iv-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="https://your-sync-server.example/inkvault/sync"
              value={settings.syncEndpointUrl}
              onChange={(e) =>
                onUpdateSettings({ ...settings, syncEndpointUrl: e.target.value })
              }
            />
            <button
              type="button"
              className="iv-btn"
              disabled={busy}
              onClick={handleSyncWithEndpoint}
            >
              <RefreshCw size={14} />
              Sync Endpoint
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="iv-btn" onClick={handleExportSyncBundleFile}>
              <Download size={14} />
              Export Sync Bundle
            </button>
            <label className="iv-btn" style={{ cursor: 'pointer' }}>
              <Upload size={14} />
              Reconcile Sync Bundle
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportSyncBundleFile(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          {/* Conflict Resolution Cards */}
          {conflicts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--iv-amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} />
                Sync Conflicts Requiring Your Decision ({conflicts.length})
              </div>
              {conflicts.map((cnf) => (
                <div
                  key={cnf.id}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    background: 'var(--iv-amber-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 12 }}>
                    <strong>{cnf.documentTitle}</strong>
                    <div>
                      Local rev {cnf.localDoc.revision} vs Remote rev {cnf.remoteDoc.revision}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="iv-btn"
                      style={{ height: 26, fontSize: 11.5 }}
                      onClick={async () => {
                        await resolveSyncConflict(cnf, 'keep-local', storage);
                        setConflicts((prev) => prev.filter((x) => x.id !== cnf.id));
                        await onLibraryRestoredOrSynced();
                      }}
                    >
                      Keep Local
                    </button>
                    <button
                      type="button"
                      className="iv-btn"
                      style={{ height: 26, fontSize: 11.5 }}
                      onClick={async () => {
                        await resolveSyncConflict(cnf, 'accept-remote', storage);
                        setConflicts((prev) => prev.filter((x) => x.id !== cnf.id));
                        await onLibraryRestoredOrSynced();
                      }}
                    >
                      Use Remote
                    </button>
                    <button
                      type="button"
                      className="iv-btn iv-btn-primary"
                      style={{ height: 26, fontSize: 11.5 }}
                      onClick={async () => {
                        await resolveSyncConflict(cnf, 'keep-both', storage);
                        setConflicts((prev) => prev.filter((x) => x.id !== cnf.id));
                        await onLibraryRestoredOrSynced();
                      }}
                    >
                      Keep Both
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {statusMsg && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: 'var(--iv-success-soft)',
              color: 'var(--iv-success)',
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={15} />
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: 'var(--iv-danger-soft)',
              color: 'var(--iv-danger)',
              fontSize: 12.5,
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    </Modal>
  );
};
