import React, { useState } from 'react';
import { Download, FileArchive, FileImage, FileText, Share2 } from 'lucide-react';
import { renderInkStrokeToCanvas, renderShapeToCanvas } from '../../core/ink/inkEngine';
import { renderPaperBackgroundToCanvas } from '../../core/ink/templateRenderer';
import {
  canUseAppleShareSheet,
  shareOrExportToAppleFiles,
} from '../../core/ios/iosFileAndLifecycleBridge';
import { InkVaultDocument } from '../../core/model/types';
import { exportDocumentToPdfBytes } from '../../core/pdf/pdfEngine';
import {
  exportDocumentToMarkdown,
  exportSingleNotebookArchive,
} from '../../core/storage/backupAndSync';
import { InkVaultStorageEngine } from '../../core/storage/storageEngine';
import { Modal, SwitchRow } from '../../design/components';

interface ExportModalProps {
  open: boolean;
  doc: InkVaultDocument | null;
  storage: InkVaultStorageEngine;
  onClose: () => void;
}

function triggerBrowserDownload(bytesOrText: Uint8Array | string, fileName: string, mimeType: string) {
  const blob =
    typeof bytesOrText === 'string'
      ? new Blob([bytesOrText], { type: mimeType })
      : new Blob([bytesOrText as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, doc, storage, onClose }) => {
  const [format, setFormat] = useState<'pdf' | 'inkvault' | 'png' | 'markdown'>('pdf');
  const [includeBackground, setIncludeBackground] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [includeTapeMasks, setIncludeTapeMasks] = useState(false);
  const [embedEditableMetadata, setEmbedEditableMetadata] = useState(true);
  const [rangeMode, setRangeMode] = useState<'all' | 'current'>('all');
  const [busy, setBusy] = useState(false);

  if (!doc) return null;

  const safeSlug = doc.title.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'notebook';
  const supportsShareSheet = canUseAppleShareSheet();

  const buildExportArtifact = async (): Promise<{
    bytes: Uint8Array;
    fileName: string;
    mimeType: string;
  }> => {
    const pageIndices =
      rangeMode === 'current'
        ? [doc.activePageIndex]
        : doc.pages.map((_, idx) => idx);

    if (format === 'pdf') {
      const bytes = await exportDocumentToPdfBytes(doc, storage, {
        includeBackground,
        includeAnnotations,
        includeTapeMasks,
        embedEditableMetadata,
        pageIndices,
      });
      return { bytes, fileName: `${safeSlug}.pdf`, mimeType: 'application/pdf' };
    }
    if (format === 'inkvault') {
      const bytes = await exportSingleNotebookArchive(doc, storage);
      return { bytes, fileName: `${safeSlug}.inkvault`, mimeType: 'application/zip' };
    }
    if (format === 'markdown') {
      const md = exportDocumentToMarkdown(doc);
      return {
        bytes: new TextEncoder().encode(md),
        fileName: `${safeSlug}.md`,
        mimeType: 'text/markdown;charset=utf-8',
      };
    }

    const pg = doc.pages[doc.activePageIndex] ?? doc.pages[0];
    const canvas = document.createElement('canvas');
    canvas.width = pg.width * 2;
    canvas.height = pg.height * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      if (includeBackground) {
        renderPaperBackgroundToCanvas(ctx, pg.width, pg.height, pg.background);
      }
      if (includeAnnotations) {
        for (const s of pg.strokes) renderInkStrokeToCanvas(ctx, s);
        for (const sh of pg.shapes) renderShapeToCanvas(ctx, sh);
      }
    }
    const dataUrl = canvas.toDataURL('image/png');
    const bin = atob(dataUrl.split(',')[1] || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return {
      bytes,
      fileName: `${safeSlug}_page_${doc.activePageIndex + 1}.png`,
      mimeType: 'image/png',
    };
  };

  const handleExport = async (preferShareSheet = false) => {
    setBusy(true);
    try {
      const artifact = await buildExportArtifact();
      if (preferShareSheet) {
        await shareOrExportToAppleFiles({ ...artifact, preferShareSheet: true });
      } else {
        triggerBrowserDownload(artifact.bytes, artifact.fileName, artifact.mimeType);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Export "${doc.title}"`}
      subtitle="Export standards-compliant annotated PDFs, lossless .inkvault archives, high-DPI PNGs, or OCR Markdown"
      maxWidth={560}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="iv-btn" onClick={onClose}>
            Cancel
          </button>
          {supportsShareSheet && (
            <button
              type="button"
              className="iv-btn"
              disabled={busy}
              onClick={() => handleExport(true)}
              data-testid="share-sheet-export-btn"
              title="Open iOS/iPadOS Share Sheet (AirDrop, Save to Files, Books)"
            >
              <Share2 size={14} />
              Share / AirDrop
            </button>
          )}
          <button
            type="button"
            className="iv-btn iv-btn-primary"
            disabled={busy}
            onClick={() => handleExport(false)}
            data-testid="confirm-export-btn"
          >
            <Download size={14} />
            {busy ? 'Generating...' : `Export ${format.toUpperCase()}`}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {(
            [
              { id: 'pdf', label: 'PDF Document', sub: 'Vector ink & original PDF pages', icon: FileText },
              { id: 'inkvault', label: '.inkvault Archive', sub: 'Lossless editable + audio/assets', icon: FileArchive },
              { id: 'png', label: 'High-DPI PNG (2×)', sub: 'Crisp raster page snapshot', icon: FileImage },
              { id: 'markdown', label: 'Markdown & OCR', sub: 'Typed text + OCR + PDF text', icon: FileText },
            ] as const
          ).map((card) => {
            const Icon = card.icon;
            const selected = format === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setFormat(card.id)}
                style={{
                  padding: 12,
                  borderRadius: 'var(--iv-radius-md)',
                  border: selected ? '2px solid var(--iv-accent)' : '1px solid var(--iv-border)',
                  background: selected ? 'var(--iv-accent-soft)' : 'var(--iv-bg-surface)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <Icon size={18} color="var(--iv-accent)" style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{card.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--iv-text-secondary)' }}>{card.sub}</div>
                </div>
              </button>
            );
          })}
        </div>

        {(format === 'pdf' || format === 'png') && (
          <div style={{ borderTop: '1px solid var(--iv-border)', paddingTop: 10 }}>
            {format === 'pdf' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>Page Scope</span>
                <div className="iv-segmented">
                  <button
                    type="button"
                    className="iv-segmented-item"
                    data-active={rangeMode === 'all'}
                    onClick={() => setRangeMode('all')}
                  >
                    All Pages ({doc.pages.length})
                  </button>
                  <button
                    type="button"
                    className="iv-segmented-item"
                    data-active={rangeMode === 'current'}
                    onClick={() => setRangeMode('current')}
                  >
                    Current Page ({doc.activePageIndex + 1})
                  </button>
                </div>
              </div>
            )}

            <SwitchRow
              checked={includeBackground}
              onChange={setIncludeBackground}
              label="Include Paper Ruling / PDF Background"
            />
            <SwitchRow
              checked={includeAnnotations}
              onChange={setIncludeAnnotations}
              label="Include Handwriting, Highlights, Shapes & Text"
            />
            {format === 'pdf' && (
              <>
                <SwitchRow
                  checked={includeTapeMasks}
                  onChange={setIncludeTapeMasks}
                  label="Render Opaque Study Tape Masks"
                />
                <SwitchRow
                  checked={embedEditableMetadata}
                  onChange={setEmbedEditableMetadata}
                  label="Attach Lossless INKVAULT Editable Schema"
                  description="Preserves visual PDF compatibility everywhere while allowing lossless re-import into INKVAULT"
                />
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
