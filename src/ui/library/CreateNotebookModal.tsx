import React, { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { renderPaperBackgroundToCanvas } from '../../core/ink/templateRenderer';
import { CreateNotebookOptions } from '../../core/model/documentModel';
import {
  COVER_PALETTES,
  COVER_STYLES,
  PAPER_COLORS,
  PAPER_SIZES,
  PAPER_TEMPLATES,
} from '../../core/model/templates';
import {
  CoverStyleId,
  CustomTemplateRecord,
  PaperColorId,
  PaperOrientation,
  PaperSizeId,
  TemplateId,
} from '../../core/model/types';
import { Modal, SwitchRow } from '../../design/components';

interface Props {
  open: boolean;
  defaultSize: PaperSizeId;
  defaultTemplate: TemplateId;
  defaultColor: PaperColorId;
  customTemplates: CustomTemplateRecord[];
  onUploadCustomTemplate: (file: File, kind: 'paper' | 'cover') => Promise<CustomTemplateRecord>;
  onClose: () => void;
  onCreate: (options: CreateNotebookOptions & { customTemplateId?: string }) => void;
}

export const CreateNotebookModal: React.FC<Props> = ({
  open,
  defaultSize,
  defaultTemplate,
  defaultColor,
  customTemplates,
  onUploadCustomTemplate,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('Untitled Notebook');
  const [subtitle, setSubtitle] = useState('');
  const [sizeId, setSizeId] = useState<PaperSizeId>(defaultSize);
  const [orientation, setOrientation] = useState<PaperOrientation>('portrait');
  const [paperColor, setPaperColor] = useState<PaperColorId>(defaultColor);
  const [templateId, setTemplateId] = useState<TemplateId>(defaultTemplate);
  const [customTemplateId, setCustomTemplateId] = useState<string | undefined>(undefined);
  const [coverEnabled, setCoverEnabled] = useState(true);
  const [coverStyle, setCoverStyle] = useState<CoverStyleId>('architectural-spine');
  const [coverColor, setCoverColor] = useState(COVER_PALETTES[0].color);
  const [coverAccent, setCoverAccent] = useState(COVER_PALETTES[0].accentColor);
  const [customCoverAssetId, setCustomCoverAssetId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'paper' | 'cover'>('paper');

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('Untitled Notebook');
      setSubtitle('');
      setSizeId(defaultSize);
      setTemplateId(defaultTemplate);
      setPaperColor(defaultColor);
      setCustomTemplateId(undefined);
      setCustomCoverAssetId(undefined);
    }
  }, [open, defaultSize, defaultTemplate, defaultColor]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = orientation === 'portrait' ? 160 : 212;
    const h = orientation === 'portrait' ? 212 : 160;
    canvas.width = w;
    canvas.height = h;
    renderPaperBackgroundToCanvas(ctx, w, h, {
      type: 'template',
      templateId,
      paperColor,
      lineSpacing: 14,
    });
  }, [open, templateId, paperColor, orientation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      title: title.trim() || 'Untitled Notebook',
      sizeId,
      orientation,
      templateId,
      paperColor,
      customTemplateId,
      cover: {
        enabled: coverEnabled,
        style: customCoverAssetId ? 'custom-image' : coverStyle,
        color: coverColor,
        accentColor: coverAccent,
        subtitle,
        customImageAssetId: customCoverAssetId,
      },
    });
  };

  const paperCustomList = customTemplates.filter((t) => t.kind === 'paper');
  const coverCustomList = customTemplates.filter((t) => t.kind === 'cover');

  return (
    <Modal
      open={open}
      title="New Notebook"
      subtitle="Configure dimensions, archival paper ruling, and notebook spine"
      maxWidth={860}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="iv-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="iv-btn iv-btn-primary"
            onClick={handleSubmit}
            data-testid="confirm-create-notebook"
          >
            Create Notebook
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        {/* Left Configuration & Live Preview Column */}
        <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label
              htmlFor="nb-title-input"
              style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--iv-text-secondary)' }}
            >
              NOTEBOOK TITLE
            </label>
            <input
              id="nb-title-input"
              className="iv-input"
              style={{ width: '100%' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Linear Algebra — Fall"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="nb-subtitle-input"
              style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--iv-text-secondary)' }}
            >
              SPINE / COURSE CODE (OPTIONAL)
            </label>
            <input
              id="nb-subtitle-input"
              className="iv-input"
              style={{ width: '100%' }}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="MATH-301"
            />
          </div>

          <SwitchRow
            id="nb-cover-toggle"
            checked={coverEnabled}
            onChange={setCoverEnabled}
            label="Notebook Cover"
            description="Disable for coverless quick pads"
          />

          <div
            style={{
              padding: 12,
              borderRadius: 'var(--iv-radius-md)',
              background: 'var(--iv-bg-subtle)',
              border: '1px solid var(--iv-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--iv-text-secondary)' }}>
              PAPER SHEET PREVIEW
            </div>
            <canvas
              ref={previewCanvasRef}
              style={{
                borderRadius: 4,
                boxShadow: 'var(--iv-shadow-sm)',
                maxWidth: '100%',
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--iv-text-muted)', textAlign: 'center' }}>
              {PAPER_SIZES[sizeId].label} · {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
            </div>
          </div>
        </div>

        {/* Right Template & Cover Gallery */}
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Top Controls Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="iv-segmented">
              <button
                type="button"
                className="iv-segmented-item"
                data-active={activeTab === 'paper'}
                onClick={() => setActiveTab('paper')}
              >
                Paper Templates
              </button>
              <button
                type="button"
                className="iv-segmented-item"
                data-active={activeTab === 'cover'}
                onClick={() => setActiveTab('cover')}
              >
                Cover & Spine
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                aria-label="Paper size"
                className="iv-select"
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value as PaperSizeId)}
              >
                {Object.values(PAPER_SIZES).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Paper color"
                className="iv-select"
                value={paperColor}
                onChange={(e) => setPaperColor(e.target.value as PaperColorId)}
              >
                {Object.values(PAPER_COLORS).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              <div className="iv-segmented" role="group" aria-label="Orientation">
                <button
                  type="button"
                  className="iv-segmented-item"
                  data-active={orientation === 'portrait'}
                  onClick={() => setOrientation('portrait')}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  className="iv-segmented-item"
                  data-active={orientation === 'landscape'}
                  onClick={() => setOrientation('landscape')}
                >
                  Landscape
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'paper' ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))',
                  gap: 10,
                }}
              >
                {PAPER_TEMPLATES.map((tpl) => {
                  const selected = !customTemplateId && templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setCustomTemplateId(undefined);
                        setTemplateId(tpl.id);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderRadius: 'var(--iv-radius-md)',
                        border: selected
                          ? '2px solid var(--iv-accent)'
                          : '1px solid var(--iv-border)',
                        background: selected ? 'var(--iv-accent-soft)' : 'var(--iv-bg-surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 10, color: 'var(--iv-text-muted)', fontWeight: 600 }}>
                        {tpl.category.toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 12.5, marginTop: 2 }}>{tpl.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--iv-text-secondary)', marginTop: 4 }}>
                        {tpl.description}
                      </div>
                    </button>
                  );
                })}

                {paperCustomList.map((ct) => {
                  const selected = customTemplateId === ct.id;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setCustomTemplateId(ct.id)}
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderRadius: 'var(--iv-radius-md)',
                        border: selected
                          ? '2px solid var(--iv-accent)'
                          : '1px solid var(--iv-border)',
                        background: selected ? 'var(--iv-accent-soft)' : 'var(--iv-bg-surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 10, color: 'var(--iv-accent)', fontWeight: 600 }}>
                        CUSTOM TEMPLATE
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 12.5, marginTop: 2 }}>{ct.name}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--iv-text-secondary)' }}>
                  Import your own PNG/JPG stationery as a reusable custom paper template:
                </span>
                <label className="iv-btn" style={{ cursor: 'pointer' }}>
                  <Upload size={14} />
                  Import Custom Paper
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const rec = await onUploadCustomTemplate(file, 'paper');
                      setCustomTemplateId(rec.id);
                    }}
                  />
                </label>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--iv-text-secondary)', marginBottom: 6 }}>
                  ARCHITECTURAL COVER STYLE
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {COVER_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      className="iv-btn"
                      style={{
                        borderColor:
                          !customCoverAssetId && coverStyle === st.id
                            ? 'var(--iv-accent)'
                            : undefined,
                        background:
                          !customCoverAssetId && coverStyle === st.id
                            ? 'var(--iv-accent-soft)'
                            : undefined,
                      }}
                      onClick={() => {
                        setCustomCoverAssetId(undefined);
                        setCoverStyle(st.id);
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--iv-text-secondary)', marginBottom: 6 }}>
                  CLOTH &amp; SPINE PALETTE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 8 }}>
                  {COVER_PALETTES.map((pal) => {
                    const active = coverColor === pal.color && coverAccent === pal.accentColor;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => {
                          setCustomCoverAssetId(undefined);
                          setCoverColor(pal.color);
                          setCoverAccent(pal.accentColor);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: 8,
                          borderRadius: 'var(--iv-radius-sm)',
                          border: active ? '2px solid var(--iv-accent)' : '1px solid var(--iv-border)',
                          background: 'var(--iv-bg-surface)',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            background: pal.color,
                            borderLeft: `5px solid ${pal.accentColor}`,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{pal.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {coverCustomList.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--iv-text-secondary)', marginBottom: 6 }}>
                    CUSTOM UPLOADED COVERS
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {coverCustomList.map((cc) => (
                      <button
                        key={cc.id}
                        type="button"
                        className="iv-btn"
                        style={{
                          borderColor: customCoverAssetId === cc.assetId ? 'var(--iv-accent)' : undefined,
                        }}
                        onClick={() => setCustomCoverAssetId(cc.assetId)}
                      >
                        {cc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="iv-btn" style={{ cursor: 'pointer' }}>
                  <Upload size={14} />
                  Upload Custom Cover Artwork
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const rec = await onUploadCustomTemplate(file, 'cover');
                      setCustomCoverAssetId(rec.assetId);
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
