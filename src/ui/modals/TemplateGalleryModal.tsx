import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, FilePlus2, FileText, Trash2, Upload } from 'lucide-react';
import { renderPaperBackgroundToCanvas } from '../../core/ink/templateRenderer';
import { createNotebook } from '../../core/model/documentModel';
import {
  COVER_PALETTES,
  COVER_STYLES,
  PAPER_COLORS,
  PAPER_TEMPLATES,
} from '../../core/model/templates';
import {
  CoverStyleId,
  CustomTemplateRecord,
  NotebookCoverConfig,
  PaperColorId,
  TemplateId,
} from '../../core/model/types';
import { Modal } from '../../design/components';
import { NotebookCoverPreview } from '../library/NotebookCoverPreview';

interface TemplateGalleryModalProps {
  open: boolean;
  customTemplates: CustomTemplateRecord[];
  onUploadCustomTemplate: (file: File, kind: 'paper' | 'cover') => Promise<CustomTemplateRecord>;
  onDeleteCustomTemplate: (id: string) => Promise<void>;
  onCreateFromTemplate: (
    templateId: TemplateId,
    paperColor: PaperColorId,
    customTemplateId?: string,
    coverOverride?: Partial<NotebookCoverConfig>
  ) => void;
  onClose: () => void;
}

const MiniTemplateCanvas: React.FC<{
  templateId: TemplateId;
  paperColor: PaperColorId;
}> = ({ templateId, paperColor }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderPaperBackgroundToCanvas(ctx, 180, 230, {
      type: 'template',
      templateId,
      paperColor,
      lineSpacing: 24,
    });
  }, [templateId, paperColor]);

  return (
    <canvas
      ref={ref}
      width={180}
      height={230}
      style={{
        width: '100%',
        height: 145,
        objectFit: 'cover',
        borderRadius: 6,
        border: '1px solid var(--iv-border)',
      }}
    />
  );
};

export const TemplateGalleryModal: React.FC<TemplateGalleryModalProps> = ({
  open,
  customTemplates,
  onUploadCustomTemplate,
  onDeleteCustomTemplate,
  onCreateFromTemplate,
  onClose,
}) => {
  const [studioTab, setStudioTab] = useState<'paper' | 'covers'>('paper');
  const [paperColor, setPaperColor] = useState<PaperColorId>('cream');
  const [selectedCoverStyle, setSelectedCoverStyle] =
    useState<CoverStyleId>('architectural-spine');
  const [selectedPaletteIdx, setSelectedPaletteIdx] = useState(0);

  const customPaperTemplates = customTemplates.filter((t) => t.kind === 'paper');
  const customCoverTemplates = customTemplates.filter((t) => t.kind === 'cover');
  const activePalette = COVER_PALETTES[selectedPaletteIdx] ?? COVER_PALETTES[0];

  return (
    <Modal
      open={open}
      title="Templates & Custom Notebook Covers Studio"
      subtitle="Browse precision ruled, grid, dotted, Cornell & planner papers, or manage custom templates & covers"
      maxWidth={780}
      onClose={onClose}
      footer={
        <button type="button" className="iv-btn iv-btn-primary" onClick={onClose}>
          Close Studio
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div className="iv-segmented">
            <button
              type="button"
              className="iv-segmented-item"
              data-active={studioTab === 'paper'}
              onClick={() => setStudioTab('paper')}
            >
              <FileText size={13} style={{ marginRight: 5 }} />
              Paper Templates ({PAPER_TEMPLATES.length + customPaperTemplates.length})
            </button>
            <button
              type="button"
              className="iv-segmented-item"
              data-active={studioTab === 'covers'}
              onClick={() => setStudioTab('covers')}
              data-testid="templates-covers-tab"
            >
              <BookOpen size={13} style={{ marginRight: 5 }} />
              Notebook Covers ({COVER_STYLES.length + customCoverTemplates.length})
            </button>
          </div>

          {studioTab === 'paper' ? (
            <label className="iv-btn" style={{ cursor: 'pointer' }}>
              <Upload size={14} />
              Import Custom Paper (PNG / JPG / PDF)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await onUploadCustomTemplate(file, 'paper');
                  e.currentTarget.value = '';
                }}
              />
            </label>
          ) : (
            <label className="iv-btn" style={{ cursor: 'pointer' }}>
              <Upload size={14} />
              Import Custom Cover Artwork
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await onUploadCustomTemplate(file, 'cover');
                  e.currentTarget.value = '';
                }}
              />
            </label>
          )}
        </div>

        {studioTab === 'paper' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Paper Tone:</span>
              <div className="iv-segmented">
                {Object.values(PAPER_COLORS).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="iv-segmented-item"
                    data-active={paperColor === c.id}
                    onClick={() => setPaperColor(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(152px, 1fr))',
                gap: 12,
              }}
            >
              {PAPER_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    padding: 8,
                    borderRadius: 'var(--iv-radius-md)',
                    border: '1px solid var(--iv-border)',
                    background: 'var(--iv-bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <MiniTemplateCanvas templateId={tpl.id} paperColor={paperColor} />
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{tpl.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--iv-text-secondary)', flex: 1 }}>
                    {tpl.description}
                  </div>
                  <button
                    type="button"
                    className="iv-btn iv-btn-primary"
                    style={{ height: 28, fontSize: 11.5 }}
                    onClick={() => {
                      onCreateFromTemplate(tpl.id, paperColor, undefined, {
                        enabled: true,
                        style: selectedCoverStyle,
                        color: activePalette.color,
                        accentColor: activePalette.accentColor,
                      });
                      onClose();
                    }}
                  >
                    <FilePlus2 size={12} />
                    Create Notebook
                  </button>
                </div>
              ))}
            </div>

            {customPaperTemplates.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  Custom Paper Templates ({customPaperTemplates.length})
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(152px, 1fr))',
                    gap: 12,
                  }}
                >
                  {customPaperTemplates.map((ct) => (
                    <div
                      key={ct.id}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: '1px solid var(--iv-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <img
                        src={ct.previewDataUrl}
                        alt={ct.name}
                        style={{
                          width: '100%',
                          height: 130,
                          objectFit: 'cover',
                          borderRadius: 4,
                        }}
                      />
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{ct.name}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="iv-btn iv-btn-primary"
                          style={{ flex: 1, height: 26, fontSize: 11 }}
                          onClick={() => {
                            onCreateFromTemplate('blank', paperColor, ct.id);
                            onClose();
                          }}
                        >
                          Use Paper
                        </button>
                        <button
                          type="button"
                          className="iv-tool-btn"
                          style={{ width: 26, height: 26, color: 'var(--iv-danger)' }}
                          onClick={() => onDeleteCustomTemplate(ct.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {studioTab === 'covers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Spine &amp; Binding Palette:</span>
              {COVER_PALETTES.map((pal, idx) => (
                <button
                  key={pal.label}
                  type="button"
                  onClick={() => setSelectedPaletteIdx(idx)}
                  title={pal.label}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: pal.color,
                    border:
                      idx === selectedPaletteIdx
                        ? `2px solid var(--iv-accent)`
                        : '1px solid var(--iv-border)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))',
                gap: 12,
              }}
            >
              {COVER_STYLES.filter((s) => s.id !== 'custom-image').map((st) => (
                <div
                  key={st.id}
                  style={{
                    padding: 10,
                    borderRadius: 'var(--iv-radius-md)',
                    border:
                      selectedCoverStyle === st.id
                        ? '2px solid var(--iv-accent)'
                        : '1px solid var(--iv-border)',
                    background: 'var(--iv-bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ height: 150 }}>
                    <NotebookCoverPreview
                      doc={createNotebook({
                        title: st.label,
                        cover: {
                          enabled: true,
                          style: st.id,
                          color: activePalette.color,
                          accentColor: activePalette.accentColor,
                          subtitle: 'ARCHITECTURAL',
                        },
                      })}
                    />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{st.label}</div>
                  <button
                    type="button"
                    className="iv-btn iv-btn-primary"
                    style={{ height: 28, fontSize: 11.5 }}
                    onClick={() => {
                      setSelectedCoverStyle(st.id);
                      onCreateFromTemplate('ruled-narrow', paperColor, undefined, {
                        enabled: true,
                        style: st.id,
                        color: activePalette.color,
                        accentColor: activePalette.accentColor,
                      });
                      onClose();
                    }}
                  >
                    <FilePlus2 size={12} />
                    Start With Cover
                  </button>
                </div>
              ))}
            </div>

            {customCoverTemplates.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  Custom Uploaded Notebook Covers ({customCoverTemplates.length})
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))',
                    gap: 12,
                  }}
                >
                  {customCoverTemplates.map((cc) => (
                    <div
                      key={cc.id}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: '1px solid var(--iv-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <img
                        src={cc.previewDataUrl}
                        alt={cc.name}
                        style={{
                          width: '100%',
                          height: 145,
                          objectFit: 'cover',
                          borderRadius: 4,
                        }}
                      />
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{cc.name}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="iv-btn iv-btn-primary"
                          style={{ flex: 1, height: 26, fontSize: 11 }}
                          onClick={() => {
                            onCreateFromTemplate('ruled-narrow', paperColor, undefined, {
                              enabled: true,
                              style: 'custom-image',
                              customImageAssetId: cc.assetId,
                              color: activePalette.color,
                              accentColor: activePalette.accentColor,
                            });
                            onClose();
                          }}
                        >
                          Use Cover
                        </button>
                        <button
                          type="button"
                          className="iv-tool-btn"
                          style={{ width: 26, height: 26, color: 'var(--iv-danger)' }}
                          onClick={() => onDeleteCustomTemplate(cc.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
