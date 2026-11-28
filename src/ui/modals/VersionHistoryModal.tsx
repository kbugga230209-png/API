import React, { useEffect, useState } from 'react';
import { History, Plus, RotateCcw } from 'lucide-react';
import { DocumentVersionSnapshot, InkVaultDocument } from '../../core/model/types';
import { InkVaultStorageEngine } from '../../core/storage/storageEngine';
import { formatRelativeDate, Modal } from '../../design/components';

interface VersionHistoryModalProps {
  open: boolean;
  doc: InkVaultDocument | null;
  storage: InkVaultStorageEngine;
  onRestored: (restoredDoc: InkVaultDocument) => void;
  onClose: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  open,
  doc,
  storage,
  onRestored,
  onClose,
}) => {
  const [snapshots, setSnapshots] = useState<DocumentVersionSnapshot[]>([]);
  const [checkpointLabel, setCheckpointLabel] = useState('');

  useEffect(() => {
    if (open && doc) {
      storage.listVersionSnapshots(doc.id).then(setSnapshots);
    }
  }, [open, doc, storage]);

  if (!doc) return null;

  const handleCreateManualSnapshot = async () => {
    const label = checkpointLabel.trim() || `Manual Checkpoint (rev ${doc.revision})`;
    await storage.createVersionSnapshot(doc, label, 'manual');
    setCheckpointLabel('');
    setSnapshots(await storage.listVersionSnapshots(doc.id));
  };

  const handleRestore = async (snapId: string) => {
    const restored = await storage.restoreVersionSnapshot(snapId);
    if (restored) {
      onRestored(restored);
      setSnapshots(await storage.listVersionSnapshots(doc.id));
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={`Version History — ${doc.title}`}
      subtitle="Create instant local checkpoints or restore any previous state (automatically saves a pre-restore safety snapshot)"
      maxWidth={560}
      onClose={onClose}
      footer={
        <button type="button" className="iv-btn" onClick={onClose}>
          Close
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="iv-input"
            style={{ flex: 1 }}
            placeholder="Checkpoint label (e.g. Before exam annotations)"
            value={checkpointLabel}
            onChange={(e) => setCheckpointLabel(e.target.value)}
          />
          <button
            type="button"
            className="iv-btn iv-btn-primary"
            onClick={handleCreateManualSnapshot}
            data-testid="create-version-btn"
          >
            <Plus size={14} />
            Save Snapshot
          </button>
        </div>

        {snapshots.length === 0 ? (
          <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--iv-text-muted)', fontSize: 13 }}>
            No snapshots saved yet for this notebook. Click &ldquo;Save Snapshot&rdquo; above or continue writing for automatic periodic versions.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--iv-radius-md)',
                  border: '1px solid var(--iv-border)',
                  background: 'var(--iv-bg-subtle)',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History size={14} color="var(--iv-accent)" />
                    {snap.label}
                    <span className="iv-badge">{snap.trigger}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--iv-text-secondary)', marginTop: 2 }}>
                    {formatRelativeDate(snap.createdAt)} · {snap.pageCount} pages · rev {snap.revision}
                  </div>
                </div>
                <button
                  type="button"
                  className="iv-btn"
                  onClick={() => handleRestore(snap.id)}
                  data-testid={`restore-version-${snap.id}`}
                >
                  <RotateCcw size={13} />
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
