import { InkVaultDocument } from './types';

export interface HistoryStateSnapshot {
  past: InkVaultDocument[];
  present: InkVaultDocument;
  future: InkVaultDocument[];
}

/**
 * Deterministic Undo/Redo HistoryManager per open notebook.
 * Preserves full persistent object IDs across undo/redo transitions
 * while capping stack depth to keep memory bounded on 500-page notebooks.
 */
export class DocumentHistoryManager {
  private stacks = new Map<string, HistoryStateSnapshot>();
  private readonly maxDepth: number;

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  initDocument(doc: InkVaultDocument): void {
    if (!this.stacks.has(doc.id)) {
      this.stacks.set(doc.id, {
        past: [],
        present: structuredClone(doc),
        future: [],
      });
    }
  }

  replacePresentSilently(doc: InkVaultDocument): void {
    const existing = this.stacks.get(doc.id);
    if (!existing) {
      this.initDocument(doc);
      return;
    }
    existing.present = structuredClone(doc);
  }

  commit(nextDoc: InkVaultDocument): InkVaultDocument {
    const existing = this.stacks.get(nextDoc.id);
    if (!existing) {
      this.stacks.set(nextDoc.id, {
        past: [],
        present: structuredClone(nextDoc),
        future: [],
      });
      return nextDoc;
    }

    const nextPast = [...existing.past, existing.present];
    if (nextPast.length > this.maxDepth) {
      nextPast.shift();
    }

    this.stacks.set(nextDoc.id, {
      past: nextPast,
      present: structuredClone(nextDoc),
      future: [],
    });

    return nextDoc;
  }

  canUndo(docId: string): boolean {
    const state = this.stacks.get(docId);
    return Boolean(state && state.past.length > 0);
  }

  canRedo(docId: string): boolean {
    const state = this.stacks.get(docId);
    return Boolean(state && state.future.length > 0);
  }

  undo(docId: string): InkVaultDocument | null {
    const state = this.stacks.get(docId);
    if (!state || state.past.length === 0) return null;

    const previous = state.past[state.past.length - 1];
    const nextPast = state.past.slice(0, -1);
    const nextFuture = [state.present, ...state.future].slice(0, this.maxDepth);

    const restored: InkVaultDocument = {
      ...structuredClone(previous),
      revision: state.present.revision + 1,
      updatedAt: Date.now(),
    };

    this.stacks.set(docId, {
      past: nextPast,
      present: structuredClone(restored),
      future: nextFuture,
    });

    return restored;
  }

  redo(docId: string): InkVaultDocument | null {
    const state = this.stacks.get(docId);
    if (!state || state.future.length === 0) return null;

    const [next, ...remainingFuture] = state.future;
    const nextPast = [...state.past, state.present].slice(-this.maxDepth);

    const restored: InkVaultDocument = {
      ...structuredClone(next),
      revision: state.present.revision + 1,
      updatedAt: Date.now(),
    };

    this.stacks.set(docId, {
      past: nextPast,
      present: structuredClone(restored),
      future: remainingFuture,
    });

    return restored;
  }

  getDepth(docId: string): { undoCount: number; redoCount: number } {
    const state = this.stacks.get(docId);
    if (!state) return { undoCount: 0, redoCount: 0 };
    return {
      undoCount: state.past.length,
      redoCount: state.future.length,
    };
  }

  clearDocument(docId: string): void {
    this.stacks.delete(docId);
  }
}
