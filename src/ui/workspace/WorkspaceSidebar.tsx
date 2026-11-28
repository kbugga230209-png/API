import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Copy,
  Eye,
  EyeOff,
  FileInput,
  Grid,
  List,
  Lock,
  Plus,
  RotateCw,
  Scissors,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { renderInkStrokeToCanvas, renderShapeToCanvas } from '../../core/ink/inkEngine';
import { renderPaperBackgroundToCanvas } from '../../core/ink/templateRenderer';
import { createDefaultLayer, createId } from '../../core/model/documentModel';
import {
  InkVaultDocument,
  InkVaultPage,
  OutlineNode,
  PageLayer,
} from '../../core/model/types';

const MAX_THUMBNAIL_CACHE_ENTRIES = 80;
const pageThumbnailCache = new Map<string, string>();

/**
 * Generates and caches a lightweight miniature preview of a page (paper ruling + strokes + shapes)
 * bounded by an 80-entry LRU eviction policy so 350+ page notebooks remain memory-bounded.
 */
export function getOrRenderPageThumbnail(page: InkVaultPage, maxThumbWidth = 128): string {
  const cacheKey = `${page.id}:${page.updatedAt}:${page.strokes.length}:${page.shapes.length}:${page.rotation}`;
  const cached = pageThumbnailCache.get(cacheKey);
  if (cached) {
    pageThumbnailCache.delete(cacheKey);
    pageThumbnailCache.set(cacheKey, cached);
    return cached;
  }

  const scale = maxThumbWidth / Math.max(1, page.width);
  const w = Math.max(32, Math.round(page.width * scale));
  const h = Math.max(42, Math.round(page.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.save();
    ctx.scale(scale, scale);
    renderPaperBackgroundToCanvas(ctx, page.width, page.height, page.background);
    for (const s of page.strokes) {
      if (s.instrument === 'highlighter') renderInkStrokeToCanvas(ctx, s);
    }
    for (const s of page.strokes) {
      if (s.instrument !== 'highlighter') renderInkStrokeToCanvas(ctx, s);
    }
    for (const sh of page.shapes) {
      renderShapeToCanvas(ctx, sh);
    }
    ctx.restore();
  }

  const dataUrl = canvas.toDataURL('image/png');
  if (pageThumbnailCache.size >= MAX_THUMBNAIL_CACHE_ENTRIES) {
    const oldestKey = pageThumbnailCache.keys().next().value;
    if (oldestKey) pageThumbnailCache.delete(oldestKey);
  }
  pageThumbnailCache.set(cacheKey, dataUrl);
  return dataUrl;
}

export function getThumbnailCacheSize(): number {
  return pageThumbnailCache.size;
}

const LazyPageThumbnail: React.FC<{ page: InkVaultPage; compact?: boolean }> = ({
  page,
  compact,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);

  useEffect(() => {
    if (visible || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const el = hostRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '180px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setThumbSrc(getOrRenderPageThumbnail(page, compact ? 110 : 140));
  }, [visible, page, compact]);

  const aspect = `${page.width} / ${page.height}`;

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        aspectRatio: aspect,
        maxHeight: compact ? 115 : 145,
        borderRadius: 4,
        border: '1px solid var(--iv-border)',
        background: '#FAF8F5',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
      }}
    >
      {thumbSrc && (
        <img
          src={thumbSrc}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      )}
    </div>
  );
};

export type SidebarTabId = 'pages' | 'outline' | 'bookmarks' | 'layers';

interface WorkspaceSidebarProps {
  open: boolean;
  doc: InkVaultDocument;
  activeTab: SidebarTabId;
  activeLayerId: string;
  onTabChange: (tab: SidebarTabId) => void;
  onSelectActiveLayer: (layerId: string) => void;
  onClose: () => void;
  onJumpToPage: (index: number) => void;
  onAddPageAfter: (index: number) => void;
  onDuplicatePage: (index: number) => void;
  onRotatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onReorderPage: (fromIndex: number, toIndex: number) => void;
  onToggleBookmark: (pageId: string) => void;
  onUpdateOutline: (outline: OutlineNode[]) => void;
  onUpdatePageLayers: (pageId: string, layers: PageLayer[]) => void;
  onMergePdfClick: () => void;
  onSplitSelectedPages: (pageIndices: number[]) => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  open,
  doc,
  activeTab,
  activeLayerId,
  onTabChange,
  onSelectActiveLayer,
  onClose,
  onJumpToPage,
  onAddPageAfter,
  onDuplicatePage,
  onRotatePage,
  onDeletePage,
  onReorderPage,
  onToggleBookmark,
  onUpdateOutline,
  onUpdatePageLayers,
  onMergePdfClick,
  onSplitSelectedPages,
}) => {
  const [selectedPageIndices, setSelectedPageIndices] = useState<number[]>([]);
  const [thumbLayout, setThumbLayout] = useState<'list' | 'grid'>('grid');
  const [newOutlineTitle, setNewOutlineTitle] = useState('');
  const [newOutlineLevel, setNewOutlineLevel] = useState(0);
  const [newLayerName, setNewLayerName] = useState('');

  if (!open) return null;

  const currentPage: InkVaultPage | undefined = doc.pages[doc.activePageIndex];

  const toggleSelectPageIdx = (idx: number) => {
    setSelectedPageIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <aside data-testid="workspace-sidebar" className="iv-workspace-sidebar">
      {/* Header & Segmented Switcher */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--iv-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Document Navigator</span>
          <button type="button" className="iv-icon-btn" style={{ width: 26, height: 26 }} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="iv-segmented" style={{ width: '100%', justifyContent: 'space-between' }}>
          {(
            [
              { id: 'pages', label: 'Pages' },
              { id: 'outline', label: 'Outline' },
              { id: 'bookmarks', label: 'Saved' },
              { id: 'layers', label: 'Layers' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className="iv-segmented-item"
              style={{ flex: 1, justifyContent: 'center', padding: '0 6px' }}
              data-active={activeTab === t.id}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* PAGES TAB */}
      {activeTab === 'pages' && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderBottom: '1px solid var(--iv-border)',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="iv-btn"
              style={{ height: 26, padding: '0 8px', fontSize: 11.5 }}
              onClick={() => onAddPageAfter(doc.activePageIndex)}
              data-testid="sidebar-add-page"
            >
              <Plus size={13} />
              Add Page
            </button>
            <button
              type="button"
              className="iv-btn"
              style={{ height: 26, padding: '0 8px', fontSize: 11.5 }}
              onClick={onMergePdfClick}
              title="Merge external PDF pages into this notebook"
            >
              <FileInput size={13} />
              Merge PDF
            </button>
            {selectedPageIndices.length > 0 && (
              <button
                type="button"
                className="iv-btn iv-btn-primary"
                style={{ height: 26, padding: '0 8px', fontSize: 11.5 }}
                onClick={() => {
                  onSplitSelectedPages(selectedPageIndices);
                  setSelectedPageIndices([]);
                }}
              >
                <Scissors size={12} />
                Split ({selectedPageIndices.length})
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 2 }}>
              <button
                type="button"
                className="iv-icon-btn"
                style={{ width: 24, height: 24 }}
                data-active={thumbLayout === 'grid'}
                title="2-Column Thumbnail Grid"
                onClick={() => setThumbLayout('grid')}
              >
                <Grid size={12} />
              </button>
              <button
                type="button"
                className="iv-icon-btn"
                style={{ width: 24, height: 24 }}
                data-active={thumbLayout === 'list'}
                title="Detailed Page List"
                onClick={() => setThumbLayout('list')}
              >
                <List size={12} />
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 10,
              display: thumbLayout === 'grid' ? 'grid' : 'flex',
              gridTemplateColumns: thumbLayout === 'grid' ? 'repeat(2, minmax(0, 1fr))' : undefined,
              flexDirection: thumbLayout === 'list' ? 'column' : undefined,
              alignContent: 'start',
              gap: 8,
            }}
          >
            {doc.pages.map((p, idx) => {
              const isActive = idx === doc.activePageIndex;
              const isSelected = selectedPageIndices.includes(idx);
              return (
                <div
                  key={p.id}
                  onClick={() => onJumpToPage(idx)}
                  style={{
                    padding: 7,
                    borderRadius: 'var(--iv-radius-md)',
                    border: isActive
                      ? '2px solid var(--iv-accent)'
                      : '1px solid var(--iv-border)',
                    background: isActive ? 'var(--iv-accent-soft)' : 'var(--iv-bg-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <LazyPageThumbnail page={p} compact={thumbLayout === 'grid'} />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectPageIdx(idx)}
                      />
                      p.{idx + 1}
                      {p.background.type === 'pdf' && <span className="iv-badge">PDF</span>}
                    </label>
                    {p.bookmarked && <Bookmark size={12} color="var(--iv-amber)" fill="var(--iv-amber)" />}
                  </div>

                  {thumbLayout === 'list' && (
                    <div style={{ fontSize: 11, color: 'var(--iv-text-secondary)', marginBottom: 6 }}>
                      {p.width}×{p.height} · {p.strokes.length} strokes · {p.textBoxes.length} text
                    </div>
                  )}

                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 3 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="iv-icon-btn"
                      style={{ width: 24, height: 24 }}
                      disabled={idx === 0}
                      title="Move page earlier"
                      onClick={() => onReorderPage(idx, idx - 1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="iv-icon-btn"
                      style={{ width: 24, height: 24 }}
                      disabled={idx === doc.pages.length - 1}
                      title="Move page later"
                      onClick={() => onReorderPage(idx, idx + 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="iv-icon-btn"
                      style={{ width: 24, height: 24 }}
                      title="Duplicate page"
                      onClick={() => onDuplicatePage(idx)}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="iv-icon-btn"
                      style={{ width: 24, height: 24 }}
                      title="Rotate page 90°"
                      onClick={() => onRotatePage(p.id)}
                    >
                      <RotateCw size={13} />
                    </button>
                    <button
                      type="button"
                      className="iv-icon-btn"
                      style={{ width: 24, height: 24 }}
                      title="Toggle bookmark"
                      onClick={() => onToggleBookmark(p.id)}
                    >
                      <Bookmark size={13} />
                    </button>
                    <button
                      type="button"
                      className="iv-icon-btn"
                      style={{ width: 24, height: 24, color: 'var(--iv-danger)', marginLeft: 'auto' }}
                      title="Delete page"
                      onClick={() => onDeletePage(p.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* OUTLINE TAB */}
      {activeTab === 'outline' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              className="iv-input"
              style={{ height: 30, fontSize: 12.5 }}
              placeholder={`Heading for Page ${doc.activePageIndex + 1}...`}
              value={newOutlineTitle}
              onChange={(e) => setNewOutlineTitle(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                className="iv-select"
                style={{ height: 28, fontSize: 12 }}
                value={newOutlineLevel}
                onChange={(e) => setNewOutlineLevel(Number(e.target.value))}
              >
                <option value={0}>Level 1 Heading</option>
                <option value={1}>Level 2 Subtopic</option>
                <option value={2}>Level 3 Detail</option>
              </select>
              <button
                type="button"
                className="iv-btn iv-btn-primary"
                style={{ flex: 1, height: 28, fontSize: 12 }}
                onClick={() => {
                  if (!newOutlineTitle.trim() || !currentPage) return;
                  const node: OutlineNode = {
                    id: createId('out'),
                    title: newOutlineTitle.trim(),
                    pageId: currentPage.id,
                    level: newOutlineLevel,
                  };
                  onUpdateOutline([...doc.outline, node]);
                  setNewOutlineTitle('');
                }}
              >
                Add Entry
              </button>
            </div>
          </div>

          {doc.outline.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--iv-text-muted)', padding: '24px 8px', textAlign: 'center' }}>
              No outline entries yet. Imported PDFs populate outlines automatically, or add custom chapter headings above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {doc.outline.map((node) => {
                const pIdx = doc.pages.findIndex((p) => p.id === node.pageId);
                return (
                  <div
                    key={node.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      paddingLeft: 8 + node.level * 14,
                      borderRadius: 5,
                      background: pIdx === doc.activePageIndex ? 'var(--iv-accent-soft)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      if (pIdx >= 0) onJumpToPage(pIdx);
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: node.level === 0 ? 600 : 400 }}>
                      {node.title}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="iv-badge">p.{pIdx >= 0 ? pIdx + 1 : '?'}</span>
                      <button
                        type="button"
                        className="iv-icon-btn"
                        style={{ width: 20, height: 20 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateOutline(doc.outline.filter((o) => o.id !== node.id));
                        }}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BOOKMARKS TAB */}
      {activeTab === 'bookmarks' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {doc.pages.filter((p) => p.bookmarked).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--iv-text-muted)', padding: '24px 8px', textAlign: 'center' }}>
              Tap the Bookmark ribbon in the top header to flag key pages, formulas, or signature blocks.
            </div>
          ) : (
            doc.pages.map((p, idx) => {
              if (!p.bookmarked) return null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onJumpToPage(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--iv-border)',
                    background: 'var(--iv-bg-subtle)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                      {p.bookmarkLabel || `Page ${idx + 1}`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--iv-text-muted)' }}>Page {idx + 1}</div>
                  </div>
                  <Bookmark size={14} color="var(--iv-amber)" fill="var(--iv-amber)" />
                </button>
              );
            })
          )}
        </div>
      )}

      {/* LAYERS TAB */}
      {activeTab === 'layers' && currentPage && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="iv-input"
              style={{ flex: 1, height: 28, fontSize: 12 }}
              placeholder="New layer (e.g. Solutions)"
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
            />
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              style={{ height: 28, fontSize: 12 }}
              onClick={() => {
                const layer = createDefaultLayer(newLayerName.trim() || `Layer ${currentPage.layers.length + 1}`);
                onUpdatePageLayers(currentPage.id, [...currentPage.layers, layer]);
                onSelectActiveLayer(layer.id);
                setNewLayerName('');
              }}
            >
              Add
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {currentPage.layers.map((layer) => {
              const isSelected = layer.id === activeLayerId;
              return (
                <div
                  key={layer.id}
                  onClick={() => onSelectActiveLayer(layer.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: isSelected ? '1.5px solid var(--iv-accent)' : '1px solid var(--iv-border)',
                    background: isSelected ? 'var(--iv-accent-soft)' : 'var(--iv-bg-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: isSelected ? 600 : 500 }}>{layer.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="iv-icon-btn"
                      style={{ width: 24, height: 24 }}
                      title={layer.visible ? 'Hide layer' : 'Show layer'}
                      onClick={() =>
                        onUpdatePageLayers(
                          currentPage.id,
                          currentPage.layers.map((l) =>
                            l.id === layer.id ? { ...l, visible: !l.visible } : l
                          )
                        )
                      }
                    >
                      {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      type="button"
                      className="iv-icon-btn"
                      style={{ width: 24, height: 24 }}
                      title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                      onClick={() =>
                        onUpdatePageLayers(
                          currentPage.id,
                          currentPage.layers.map((l) =>
                            l.id === layer.id ? { ...l, locked: !l.locked } : l
                          )
                        )
                      }
                    >
                      {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                    {currentPage.layers.length > 1 && (
                      <button
                        type="button"
                        className="iv-icon-btn"
                        style={{ width: 24, height: 24, color: 'var(--iv-danger)' }}
                        title="Delete layer"
                        onClick={() =>
                          onUpdatePageLayers(
                            currentPage.id,
                            currentPage.layers.filter((l) => l.id !== layer.id)
                          )
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
