import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  FolderOpen,
  Info,
  Upload,
} from 'lucide-react';
import {
  isRunningInNativeIOSShell,
  postCommandToNativeIOS,
} from '../../core/ios/pencilKitBridge';
import {
  BatchMigrationResult,
  DuplicatePolicy,
  IncomingFileInput,
  MigrationProgressEvent,
  runBatchGoodnotesMigration,
} from '../../core/migration/goodnotesMigration';
import { MigrationReport } from '../../core/model/types';
import { InkVaultStorageEngine } from '../../core/storage/storageEngine';
import { Modal } from '../../design/components';

interface MigrationModalProps {
  open: boolean;
  targetFolderId: string | null;
  storage: InkVaultStorageEngine;
  singleReportToInspect?: MigrationReport | null;
  onClose: () => void;
  onMigrationComplete: (result: BatchMigrationResult) => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  open,
  targetFolderId,
  storage,
  singleReportToInspect,
  onClose,
  onMigrationComplete,
}) => {
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>('keep-both');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<MigrationProgressEvent | null>(null);
  const [lastResult, setLastResult] = useState<BatchMigrationResult | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setRunning(true);
    setLastResult(null);

    const inputs: IncomingFileInput[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const ab = await f.arrayBuffer();
      inputs.push({
        name: f.name,
        relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        bytes: new Uint8Array(ab),
        mimeType: f.type,
      });
    }

    const res = await runBatchGoodnotesMigration(inputs, storage, {
      targetRootFolderId: targetFolderId,
      duplicatePolicy,
      onProgress: (ev) => setProgress(ev),
    });

    setRunning(false);
    setLastResult(res);
    onMigrationComplete(res);
  };

  if (singleReportToInspect) {
    return (
      <Modal
        open={open}
        title={`Migration Audit Report — ${singleReportToInspect.sourceFileName}`}
        subtitle={`Format: ${singleReportToInspect.sourceFormat} · Imported ${new Date(
          singleReportToInspect.importedAt
        ).toLocaleString()}`}
        maxWidth={640}
        onClose={onClose}
        footer={
          <button type="button" className="iv-btn iv-btn-primary" onClick={onClose}>
            Close Report
          </button>
        }
      >
        <MigrationReportCard report={singleReportToInspect} />
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title="Import Documents & Goodnotes Migration Studio"
      subtitle="Non-destructively import .goodnotes archives, PDFs, batch .zip backups, .inkvault bundles, images, or .csv Study Sets"
      maxWidth={700}
      onClose={onClose}
      footer={
        <button type="button" className="iv-btn" onClick={onClose}>
          Done
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Honesty & Safety Banner */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--iv-radius-md)',
            background: 'var(--iv-bg-subtle)',
            border: '1px solid var(--iv-border)',
            fontSize: 12.5,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <Info size={16} style={{ color: 'var(--iv-accent)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Transparent Migration Guarantee:</strong> Original files are never modified or deleted.
            INKVAULT reconstructs pages, PDFs, images, audio, outlines, and accessible stroke streams, and
            explicitly reports when flattened PDF ink cannot be separated into native strokes.
          </div>
        </div>

        {/* Duplicate Handling Policy */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Duplicate Detection (SHA-256)</div>
            <div style={{ fontSize: 11.5, color: 'var(--iv-text-secondary)' }}>
              Action when an identical source file already exists in your vault
            </div>
          </div>
          <div className="iv-segmented">
            {(
              [
                { id: 'keep-both', label: 'Keep Both' },
                { id: 'skip', label: 'Skip Duplicate' },
                { id: 'replace', label: 'Replace Existing' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="iv-segmented-item"
                data-active={duplicatePolicy === opt.id}
                onClick={() => setDuplicatePolicy(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropzone / Multi-File Picker */}
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesSelected(e.dataTransfer.files);
          }}
          style={{
            padding: '28px 20px',
            borderRadius: 'var(--iv-radius-lg)',
            border: '2px dashed var(--iv-border-strong)',
            background: 'var(--iv-bg-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            cursor: running ? 'wait' : 'pointer',
            textAlign: 'center',
          }}
        >
          <FileArchive size={28} color="var(--iv-accent)" />
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            Drop .goodnotes, .pdf, .zip backup archives, .inkvault, images, or .csv files here
          </div>
          <div style={{ fontSize: 12, color: 'var(--iv-text-secondary)' }}>
            Supports single or batch multi-notebook selection · Nested folders inside .zip archives are preserved automatically
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
            <span className="iv-btn iv-btn-primary">
              <Upload size={14} />
              Choose Files (Files App)
            </span>
            <button
              type="button"
              className="iv-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isRunningInNativeIOSShell()) {
                  postCommandToNativeIOS({
                    command: 'openDocumentPicker',
                    allowedUTTypes: ['public.folder', 'com.adobe.pdf', 'public.zip-archive'],
                    allowMultiple: true,
                    allowFolders: true,
                  });
                  return;
                }
                folderInputRef.current?.click();
              }}
              data-testid="choose-folder-import-btn"
            >
              <FolderOpen size={14} />
              Select Folder (Batch)
            </button>
          </div>
          <input
            type="file"
            multiple
            accept=".goodnotes,.pdf,.zip,.inkvault,.png,.jpg,.jpeg,.webp,.csv,.tsv"
            style={{ display: 'none' }}
            disabled={running}
            onChange={(e) => handleFilesSelected(e.target.files)}
            data-testid="migration-file-input"
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
            style={{ display: 'none' }}
            disabled={running}
            onChange={(e) => handleFilesSelected(e.target.files)}
            data-testid="migration-folder-input"
          />
        </label>

        {/* Live Progress Indicator */}
        {running && progress && (
          <div
            style={{
              padding: 12,
              borderRadius: 'var(--iv-radius-md)',
              border: '1px solid var(--iv-border)',
              background: 'var(--iv-bg-surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span>Importing: {progress.currentFile}</span>
              <span>
                {progress.completedFiles} / {progress.totalFiles}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--iv-bg-subtle)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.round((progress.completedFiles / Math.max(1, progress.totalFiles)) * 100)}%`,
                  background: 'var(--iv-accent)',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Migration Summary & Itemized Reports */}
        {lastResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                padding: 12,
                borderRadius: 'var(--iv-radius-md)',
                background: 'var(--iv-success-soft)',
                color: 'var(--iv-success)',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              <span>✓ {lastResult.importedDocuments.length} notebook(s) imported</span>
              {lastResult.createdFolders.length > 0 && (
                <span>· {lastResult.createdFolders.length} folder(s) created</span>
              )}
              {lastResult.importedStudySets.length > 0 && (
                <span>· {lastResult.importedStudySets.length} study set(s) imported</span>
              )}
              {lastResult.skippedDuplicates.length > 0 && (
                <span>· {lastResult.skippedDuplicates.length} duplicate(s) skipped</span>
              )}
            </div>

            {lastResult.failures.length > 0 && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 'var(--iv-radius-md)',
                  background: 'var(--iv-danger-soft)',
                  color: 'var(--iv-danger)',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  Import Errors ({lastResult.failures.length})
                </div>
                {lastResult.failures.map((f, idx) => (
                  <div key={idx}>
                    • <strong>{f.fileName}:</strong> {f.reason}
                  </div>
                ))}
              </div>
            )}

            {lastResult.reports.map((rep) => (
              <MigrationReportCard key={rep.id} report={rep} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

const MigrationReportCard: React.FC<{ report: MigrationReport }> = ({ report }) => {
  return (
    <div
      data-testid="migration-report-card"
      style={{
        padding: 14,
        borderRadius: 'var(--iv-radius-md)',
        border: '1px solid var(--iv-border)',
        background: 'var(--iv-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{report.sourceFileName}</div>
        <span className="iv-badge">{report.sourceFormat}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--iv-text-secondary)' }}>{report.summary}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {report.items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 12,
              padding: '6px 8px',
              borderRadius: 5,
              background: 'var(--iv-bg-subtle)',
            }}
          >
            {item.status === 'preserved' ? (
              <CheckCircle2 size={14} color="var(--iv-success)" style={{ flexShrink: 0, marginTop: 2 }} />
            ) : (
              <AlertTriangle size={14} color="var(--iv-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
            )}
            <div>
              <strong>{item.category}:</strong> {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
