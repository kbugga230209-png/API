import React, { useMemo, useState } from 'react';
import { Bookmark, FileSearch, Sparkles } from 'lucide-react';
import { InkVaultDocument } from '../../core/model/types';
import {
  searchAcrossLibrary,
  SearchMatchSource,
} from '../../core/ocr/ocrAndSearchEngine';
import { Modal } from '../../design/components';

interface UniversalSearchModalProps {
  open: boolean;
  documents: InkVaultDocument[];
  pendingOcrJobs: number;
  onSelectResult: (documentId: string, pageIndex: number) => void;
  onClose: () => void;
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  open,
  documents,
  pendingOcrJobs,
  onSelectResult,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | SearchMatchSource>('all');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const results = useMemo(() => {
    return searchAcrossLibrary(documents, query, {
      sources: sourceFilter === 'all' ? undefined : [sourceFilter],
      bookmarkedOnly,
    });
  }, [documents, query, sourceFilter, bookmarkedOnly]);

  return (
    <Modal
      open={open}
      title="Universal Library & OCR Search"
      subtitle="Search notebook titles, typed text, asynchronous handwriting & image OCR, PDF text, and outlines"
      maxWidth={680}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          className="iv-input"
          autoFocus
          placeholder="Search across handwriting, PDFs, typed notes, titles & outlines..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="universal-search-input"
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="iv-segmented">
            {(
              [
                { id: 'all', label: 'All Sources' },
                { id: 'title', label: 'Titles' },
                { id: 'handwriting-ocr', label: 'Handwriting OCR' },
                { id: 'image-ocr', label: 'Image OCR' },
                { id: 'typed', label: 'Typed Text' },
                { id: 'pdf', label: 'PDF Text' },
                { id: 'outline', label: 'Outlines' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="iv-segmented-item"
                data-active={sourceFilter === opt.id}
                onClick={() => setSourceFilter(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="iv-btn"
            style={{
              height: 28,
              fontSize: 11.5,
              background: bookmarkedOnly ? 'var(--iv-accent-soft)' : undefined,
              color: bookmarkedOnly ? 'var(--iv-accent)' : undefined,
            }}
            onClick={() => setBookmarkedOnly((b) => !b)}
          >
            <Bookmark size={12} />
            Bookmarked Only
          </button>
        </div>

        {pendingOcrJobs > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--iv-accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} />
            Background OCR indexing {pendingOcrJobs} page(s) asynchronously (non-blocking)...
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {!query.trim() ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--iv-text-muted)', fontSize: 13 }}>
              <FileSearch size={24} style={{ marginBottom: 6, opacity: 0.6 }} />
              <div>Enter any keyword or phrase to search across your entire local vault.</div>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--iv-text-muted)', fontSize: 13 }}>
              No matching pages found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            results.map((hit) => {
              const before = hit.snippet.slice(0, hit.matchStart);
              const matched = hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength);
              const after = hit.snippet.slice(hit.matchStart + hit.matchLength);
              return (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => {
                    onSelectResult(hit.documentId, hit.pageIndex);
                    onClose();
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--iv-radius-md)',
                    border: '1px solid var(--iv-border)',
                    background: 'var(--iv-bg-subtle)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {hit.documentTitle} · Page {hit.pageIndex + 1}
                    </span>
                    <span className="iv-badge">{hit.source}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--iv-text-secondary)' }}>
                    {before}
                    <mark
                      style={{
                        background: 'var(--iv-amber-soft)',
                        color: 'var(--iv-text-primary)',
                        padding: '0 2px',
                        borderRadius: 2,
                      }}
                    >
                      {matched}
                    </mark>
                    {after}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
