import { getObjectBounds } from '../ink/inkEngine';
import { createId } from '../model/documentModel';
import { FlashcardItem, InkVaultDocument, StudySet } from '../model/types';

export type RecallRating = 'again' | 'hard' | 'good' | 'easy';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Authentic SuperMemo SM-2 Spaced Repetition scheduler.
 * Updates easiness factor (>= 1.3), interval days, repetitions, lapses, and nextReviewAt.
 */
export function reviewFlashcardSM2(
  card: FlashcardItem,
  rating: RecallRating,
  now = Date.now()
): FlashcardItem {
  const qualityMap: Record<RecallRating, number> = {
    again: 1,
    hard: 3,
    good: 4,
    easy: 5,
  };
  const q = qualityMap[rating];

  let repetitions = card.repetitions;
  let intervalDays = card.intervalDays;
  let lapses = card.lapses;
  let ef = card.easinessFactor;

  if (q < 3) {
    // Forgot card -> reset repetitions and review again in 10 minutes (stored as fractional day or 0)
    repetitions = 0;
    intervalDays = 0;
    lapses += 1;
  } else {
    if (repetitions === 0) {
      intervalDays = rating === 'easy' ? 3 : 1;
    } else if (repetitions === 1) {
      intervalDays = rating === 'easy' ? 8 : 6;
    } else {
      const mult = rating === 'hard' ? 1.2 : rating === 'easy' ? ef * 1.25 : ef;
      intervalDays = Math.max(1, Math.round(intervalDays * mult));
    }
    repetitions += 1;
  }

  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const nextReviewAt =
    intervalDays === 0 ? now + 10 * 60 * 1000 : now + intervalDays * DAY_MS;

  return {
    ...card,
    easinessFactor: Number(ef.toFixed(3)),
    intervalDays,
    repetitions,
    lapses,
    lastReviewedAt: now,
    nextReviewAt,
    updatedAt: now,
  };
}

export interface ExtractedNotebookHighlight {
  id: string;
  pageId: string;
  pageIndex: number;
  kind: 'highlight' | 'bookmark' | 'tape-mask';
  color: string;
  prompt: string;
  content: string;
}

/**
 * Extracts highlighter annotations, bookmarked pages, and Tape active-recall regions from a notebook
 * so users can review all highlights in one place or convert them directly into SM-2 Study Set flashcards!
 */
export function extractHighlightsAndAnnotationsFromDocument(
  doc: InkVaultDocument
): ExtractedNotebookHighlight[] {
  const items: ExtractedNotebookHighlight[] = [];

  doc.pages.forEach((page, pIdx) => {
    if (page.bookmarked) {
      const summary =
        page.textBoxes.map((t) => t.text).join(' ').trim() ||
        page.ocrText?.slice(0, 160) ||
        page.pdfText?.slice(0, 160) ||
        `Bookmarked review page ${pIdx + 1}`;
      items.push({
        id: `${page.id}_bm`,
        pageId: page.id,
        pageIndex: pIdx,
        kind: 'bookmark',
        color: '#2563EB',
        prompt: page.bookmarkLabel || `${doc.title} — Page ${pIdx + 1}`,
        content: summary,
      });
    }

    // Highlighter strokes -> find overlapping typed text box or page OCR/PDF text
    const highlightStrokes = page.strokes.filter((s) => s.instrument === 'highlighter');
    highlightStrokes.forEach((hs, hIdx) => {
      const bounds = getObjectBounds(hs);
      const overlappingTextBoxes = page.textBoxes.filter(
        (tb) =>
          tb.x <= bounds.maxX &&
          tb.x + tb.width >= bounds.minX &&
          tb.y <= bounds.maxY &&
          tb.y + tb.height >= bounds.minY
      );
      const matchedText =
        overlappingTextBoxes.map((t) => t.text.trim()).filter(Boolean).join(' ') ||
        page.ocrText?.trim() ||
        page.pdfText?.trim().slice(0, 200) ||
        `Highlighted passage #${hIdx + 1} on Page ${pIdx + 1}`;

      items.push({
        id: hs.id,
        pageId: page.id,
        pageIndex: pIdx,
        kind: 'highlight',
        color: hs.color,
        prompt: `Key Concept (${doc.title}, p.${pIdx + 1})`,
        content: matchedText,
      });
    });

    // Tape active-recall masks
    page.tapes.forEach((tape, tIdx) => {
      const tBounds = getObjectBounds(tape);
      const coveredText = page.textBoxes
        .filter(
          (tb) =>
            tb.x < tBounds.maxX &&
            tb.x + tb.width > tBounds.minX &&
            tb.y < tBounds.maxY &&
            tb.y + tb.height > tBounds.minY
        )
        .map((t) => t.text.trim())
        .join(' ');
      items.push({
        id: tape.id,
        pageId: page.id,
        pageIndex: pIdx,
        kind: 'tape-mask',
        color: tape.color,
        prompt: tape.promptHint || `Active Recall Mask #${tIdx + 1} (${doc.title}, p.${pIdx + 1})`,
        content: coveredText || page.ocrText?.trim() || `Masked diagram/ink region on Page ${pIdx + 1}`,
      });
    });
  });

  return items;
}

export function createStudySetFromExtractedHighlights(
  doc: InkVaultDocument,
  highlights: ExtractedNotebookHighlight[]
): StudySet {
  const id = createId('set');
  const now = Date.now();
  const cards: FlashcardItem[] = highlights.map((h) => ({
    id: createId('crd'),
    studySetId: id,
    front: h.prompt,
    back: h.content,
    sourceDocumentId: doc.id,
    sourcePageId: h.pageId,
    tags: [h.kind],
    easinessFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReviewAt: now,
    lapses: 0,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    id,
    title: `${doc.title} — Study Set`,
    description: `Extracted ${cards.length} highlight & active-recall item(s) from ${doc.title}`,
    folderId: doc.folderId,
    cards,
    createdAt: now,
    updatedAt: now,
  };
}
