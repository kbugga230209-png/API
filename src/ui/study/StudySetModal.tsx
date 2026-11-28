import React, { useMemo, useState } from 'react';
import {
  Brain,
  Download,
  ExternalLink,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { createId } from '../../core/model/documentModel';
import { FlashcardItem, InkVaultDocument, StudySet } from '../../core/model/types';
import {
  createStudySetFromExtractedHighlights,
  extractHighlightsAndAnnotationsFromDocument,
  RecallRating,
  reviewFlashcardSM2,
} from '../../core/study/studyEngine';
import { Modal } from '../../design/components';

interface StudySetModalProps {
  open: boolean;
  studySet: StudySet | null;
  activeDocument?: InkVaultDocument | null;
  onSaveStudySet: (next: StudySet) => Promise<void>;
  onJumpToSourcePage?: (documentId: string, pageId: string) => void;
  onClose: () => void;
}

export const StudySetModal: React.FC<StudySetModalProps> = ({
  open,
  studySet,
  activeDocument,
  onSaveStudySet,
  onJumpToSourcePage,
  onClose,
}) => {
  const [tab, setTab] = useState<'review' | 'cards' | 'extract'>('review');
  const [flipped, setFlipped] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  const dueCards = useMemo(() => {
    if (!studySet) return [];
    const now = Date.now();
    return studySet.cards.filter((c) => c.nextReviewAt <= now);
  }, [studySet]);

  const currentReviewCard: FlashcardItem | undefined =
    dueCards[0] ?? studySet?.cards[0];

  if (!open) return null;

  // If opened from workspace to extract highlights without an existing StudySet
  if (!studySet && activeDocument) {
    const highlights = extractHighlightsAndAnnotationsFromDocument(activeDocument);
    return (
      <Modal
        open={open}
        title={`Study & Highlight Extraction — ${activeDocument.title}`}
        subtitle="Optional active-recall assistant: review extracted highlights, bookmarks & Tape masks or build an SM-2 Study Set"
        maxWidth={640}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="iv-btn" onClick={onClose}>
              Close
            </button>
            {highlights.length > 0 && (
              <button
                type="button"
                className="iv-btn iv-btn-primary"
                onClick={async () => {
                  const created = createStudySetFromExtractedHighlights(
                    activeDocument,
                    highlights
                  );
                  await onSaveStudySet(created);
                }}
                data-testid="create-studyset-from-highlights-btn"
              >
                <Sparkles size={14} />
                Create Study Set ({highlights.length} cards)
              </button>
            )}
          </>
        }
      >
        {highlights.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--iv-text-secondary)' }}>
            No highlights, bookmarked pages, or Tape study masks found yet in this notebook. Highlight key concepts, bookmark pages, or place Tape strips to extract them automatically.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {highlights.map((h) => (
              <div
                key={h.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  borderLeft: `4px solid ${h.color}`,
                  background: 'var(--iv-bg-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                    {h.prompt} <span className="iv-badge">{h.kind}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--iv-text-secondary)', marginTop: 2 }}>
                    {h.content}
                  </div>
                </div>
                {onJumpToSourcePage && (
                  <button
                    type="button"
                    className="iv-btn iv-btn-ghost"
                    style={{ height: 26, fontSize: 11 }}
                    onClick={() => {
                      onJumpToSourcePage(activeDocument.id, h.pageId);
                      onClose();
                    }}
                  >
                    p.{h.pageIndex + 1}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    );
  }

  if (!studySet) return null;

  const handleGrade = async (rating: RecallRating) => {
    if (!currentReviewCard) return;
    const updatedCard = reviewFlashcardSM2(currentReviewCard, rating);
    const nextSet: StudySet = {
      ...studySet,
      cards: studySet.cards.map((c) => (c.id === updatedCard.id ? updatedCard : c)),
      updatedAt: Date.now(),
    };
    setFlipped(false);
    await onSaveStudySet(nextSet);
  };

  const handleAddCard = async () => {
    if (!newFront.trim() || !newBack.trim()) return;
    const now = Date.now();
    const card: FlashcardItem = {
      id: createId('crd'),
      studySetId: studySet.id,
      front: newFront.trim(),
      back: newBack.trim(),
      tags: [],
      easinessFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: now,
      lapses: 0,
      createdAt: now,
      updatedAt: now,
    };
    await onSaveStudySet({
      ...studySet,
      cards: [...studySet.cards, card],
      updatedAt: now,
    });
    setNewFront('');
    setNewBack('');
  };

  const handleExportCsv = () => {
    const csv = studySet.cards
      .map(
        (c) =>
          `"${c.front.replace(/"/g, '""')}","${c.back.replace(/"/g, '""')}"`
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${studySet.title.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Modal
      open={open}
      title={studySet.title}
      subtitle={`${studySet.cards.length} cards · ${dueCards.length} due for SM-2 spaced repetition review`}
      maxWidth={660}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="iv-btn" onClick={handleExportCsv}>
            <Download size={14} />
            Export CSV
          </button>
          <button type="button" className="iv-btn iv-btn-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="iv-segmented" style={{ alignSelf: 'flex-start' }}>
          <button
            type="button"
            className="iv-segmented-item"
            data-active={tab === 'review'}
            onClick={() => setTab('review')}
          >
            Active Recall ({dueCards.length} Due)
          </button>
          <button
            type="button"
            className="iv-segmented-item"
            data-active={tab === 'cards'}
            onClick={() => setTab('cards')}
          >
            Manage Cards ({studySet.cards.length})
          </button>
          {activeDocument && (
            <button
              type="button"
              className="iv-segmented-item"
              data-active={tab === 'extract'}
              onClick={() => setTab('extract')}
            >
              Import From Notebook Highlights
            </button>
          )}
        </div>

        {tab === 'review' && (
          <div>
            {!currentReviewCard ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--iv-text-secondary)' }}>
                No flashcards in this Study Set yet. Switch to &ldquo;Manage Cards&rdquo; to add cards.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  onClick={() => setFlipped((f) => !f)}
                  style={{
                    minHeight: 190,
                    padding: 24,
                    borderRadius: 'var(--iv-radius-lg)',
                    border: '1px solid var(--iv-border)',
                    background: 'var(--iv-bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    gap: 10,
                  }}
                  data-testid="flashcard-review-box"
                >
                  <span className="iv-badge">
                    {flipped ? 'ANSWER (BACK)' : 'PROMPT (FRONT) — Click to Reveal'}
                  </span>
                  <div style={{ fontSize: 17, fontWeight: 600, maxWidth: 500 }}>
                    {flipped ? currentReviewCard.back : currentReviewCard.front}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--iv-text-muted)' }}>
                    SM-2 EF {currentReviewCard.easinessFactor} · Interval {currentReviewCard.intervalDays}d · Reps {currentReviewCard.repetitions}
                  </div>
                  {currentReviewCard.sourceDocumentId &&
                    currentReviewCard.sourcePageId &&
                    onJumpToSourcePage && (
                      <button
                        type="button"
                        className="iv-btn iv-btn-ghost"
                        style={{ height: 26, fontSize: 11 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToSourcePage(
                            currentReviewCard.sourceDocumentId!,
                            currentReviewCard.sourcePageId!
                          );
                          onClose();
                        }}
                      >
                        <ExternalLink size={12} />
                        Open Source Notebook Page
                      </button>
                    )}
                </div>

                {!flipped ? (
                  <button
                    type="button"
                    className="iv-btn iv-btn-primary"
                    style={{ alignSelf: 'center' }}
                    onClick={() => setFlipped(true)}
                  >
                    <Brain size={14} />
                    Show Answer
                  </button>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {(
                      [
                        { id: 'again', label: 'Again', sub: '10 min', color: 'var(--iv-danger)' },
                        { id: 'hard', label: 'Hard', sub: 'Short interval', color: 'var(--iv-amber)' },
                        { id: 'good', label: 'Good', sub: 'Standard SM-2', color: 'var(--iv-accent)' },
                        { id: 'easy', label: 'Easy', sub: 'Long interval', color: 'var(--iv-success)' },
                      ] as const
                    ).map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        className="iv-btn"
                        style={{
                          height: 46,
                          flexDirection: 'column',
                          gap: 1,
                          borderColor: btn.color,
                        }}
                        onClick={() => handleGrade(btn.id)}
                        data-testid={`sm2-grade-${btn.id}`}
                      >
                        <span style={{ fontWeight: 700, color: btn.color }}>{btn.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--iv-text-muted)' }}>{btn.sub}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'cards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <input
                className="iv-input"
                placeholder="Front (Question / Concept)"
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
              />
              <input
                className="iv-input"
                placeholder="Back (Answer / Explanation)"
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
              />
              <button
                type="button"
                className="iv-btn iv-btn-primary"
                onClick={handleAddCard}
                data-testid="add-flashcard-btn"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {studySet.cards.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--iv-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <strong>{c.front}</strong> — <span style={{ color: 'var(--iv-text-secondary)' }}>{c.back}</span>
                  </div>
                  <button
                    type="button"
                    className="iv-tool-btn"
                    style={{ width: 26, height: 26, color: 'var(--iv-danger)' }}
                    onClick={() =>
                      onSaveStudySet({
                        ...studySet,
                        cards: studySet.cards.filter((x) => x.id !== c.id),
                        updatedAt: Date.now(),
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'extract' && activeDocument && (
          <div>
            {(() => {
              const extracted = extractHighlightsAndAnnotationsFromDocument(activeDocument);
              return extracted.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--iv-text-secondary)' }}>
                  No highlights or bookmarks found on &ldquo;{activeDocument.title}&rdquo;.
                </div>
              ) : (
                <button
                  type="button"
                  className="iv-btn iv-btn-primary"
                  onClick={async () => {
                    const extraSet = createStudySetFromExtractedHighlights(
                      activeDocument,
                      extracted
                    );
                    await onSaveStudySet({
                      ...studySet,
                      cards: [...studySet.cards, ...extraSet.cards],
                      updatedAt: Date.now(),
                    });
                    setTab('cards');
                  }}
                >
                  <Sparkles size={14} />
                  Append {extracted.length} Highlighted Concept(s) to This Study Set
                </button>
              );
            })()}
          </div>
        )}
      </div>
    </Modal>
  );
};
