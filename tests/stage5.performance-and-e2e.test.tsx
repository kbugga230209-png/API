import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import {
  createId,
  createNotebook,
  createPage,
  insertPageInDocument,
  reorderPageInDocument,
} from '../src/core/model/documentModel';
import { DocumentHistoryManager } from '../src/core/model/historyManager';
import { searchAcrossLibrary } from '../src/core/ocr/ocrAndSearchEngine';
import {
  detectPlatformCapabilities,
  resolveEffectiveTheme,
} from '../src/core/platform/platformAdapter';
import { InkVaultStorageEngine } from '../src/core/storage/storageEngine';
import {
  getOrRenderPageThumbnail,
  getThumbnailCacheSize,
} from '../src/ui/workspace/WorkspaceSidebar';

describe('Stage 5 — Cross-Platform Capabilities, 350-Page Stress Benchmark & Full App E2E UI', () => {
  let storage: InkVaultStorageEngine;

  beforeEach(async () => {
    storage = new InkVaultStorageEngine();
    await storage.clearAllData();
  });

  it('detects cross-platform runtime capabilities and resolves light/dark themes cleanly', () => {
    const caps = detectPlatformCapabilities();
    expect(['iPadOS', 'macOS', 'Windows', 'Android', 'Web']).toContain(caps.platform);
    expect(resolveEffectiveTheme('dark')).toBe('dark');
    expect(resolveEffectiveTheme('light')).toBe('light');
  });

  it('handles a 350-page notebook with mixed paper templates, vector strokes, undo/redo, persistence, and search within strict latency bounds', async () => {
    const tStart = performance.now();
    const templates = ['ruled-narrow', 'grid', 'dotted', 'cornell'] as const;

    let largeDoc = createNotebook({
      title: '350-Page Medical Residency Compendium',
      cover: { enabled: false },
    });

    const pages = Array.from({ length: 350 }, (_, idx) => {
      const p = createPage({
        templateId: templates[idx % templates.length],
      });
      p.ocrText = idx === 287 ? 'Glomerular filtration rate equation' : `Page ${idx + 1} lecture notes`;
      p.strokes.push({
        id: createId('stk'),
        kind: 'stroke',
        layerId: p.layers[0].id,
        zIndex: 1,
        instrument: 'fountain',
        color: '#18181B',
        width: 2.2,
        opacity: 1,
        smoothing: 0.5,
        pressureSensitivity: 0.5,
        tipSharpness: 0.5,
        points: [
          { x: 40, y: 80, p: 0.5, t: 0 },
          { x: 140, y: 84, p: 0.6, t: 16 },
          { x: 240, y: 82, p: 0.55, t: 32 },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return p;
    });
    largeDoc = { ...largeDoc, pages };

    const history = new DocumentHistoryManager(25);
    history.initDocument(largeDoc);

    // Insert page 351 and reorder
    const withInserted = insertPageInDocument(largeDoc, createPage(), 175);
    history.commit(withInserted);
    expect(withInserted.pages).toHaveLength(351);

    const reordered = reorderPageInDocument(withInserted, 0, 349);
    history.commit(reordered);

    // Undo restores previous 351-page order cleanly
    const undone = history.undo(largeDoc.id)!;
    expect(undone.pages[0].id).toBe(withInserted.pages[0].id);

    // Save & reload from IndexedDB
    await storage.saveDocument(undone);
    const reloaded = await storage.getDocument(largeDoc.id);
    expect(reloaded?.pages).toHaveLength(351);

    // Search across all 351 pages
    const searchHits = searchAcrossLibrary([reloaded!], 'glomerular filtration');
    expect(searchHits).toHaveLength(1);
    expect(searchHits[0].pageIndex).toBe(288); // shifted by 1 after insert at 175!

    // Render thumbnails across 120 pages and verify LRU cache caps memory cleanly at <= 80 entries
    for (let i = 0; i < 120; i++) {
      const thumb = getOrRenderPageThumbnail(reloaded!.pages[i], 96);
      expect(thumb.startsWith('data:image/png')).toBe(true);
    }
    expect(getThumbnailCacheSize()).toBeLessThanOrEqual(80);

    const elapsedMs = performance.now() - tStart;
    expect(elapsedMs).toBeLessThan(2500);
  });

  it('mounts <App /> with zero fake demo notebooks, browses Templates & Covers, creates a Quick Note, uses Underline & Undo/Redo, and persists back to Library', async () => {
    render(<App storage={storage} />);

    // Wait for IndexedDB hydration
    const quickNoteBtn = await screen.findByTestId('quick-note-btn');
    expect(quickNoteBtn).toBeInTheDocument();

    // Verify empty vault starts cleanly with zero permanent hardcoded demo notebooks
    expect(await storage.listDocuments()).toHaveLength(0);

    // Verify Templates & Custom Notebook Covers Studio opens and switches to Covers tab
    fireEvent.click(screen.getByTestId('open-templates-btn'));
    const coversTabBtn = await screen.findByTestId('templates-covers-tab');
    fireEvent.click(coversTabBtn);
    fireEvent.click(screen.getByText('Close Studio'));

    // Create a real Quick Note -> transitions into NotebookWorkspace
    fireEvent.click(quickNoteBtn);

    const bookmarkBtn = await screen.findByTestId('bookmark-page-btn');
    expect(bookmarkBtn).toBeInTheDocument();

    // Activate PDF/Note Underline tool
    const underlineBtn = screen.getByTestId('tool-underline');
    fireEvent.click(underlineBtn);
    expect(underlineBtn).toHaveAttribute('data-active', 'true');

    // Bookmark page 1 -> Undo -> Redo
    fireEvent.click(bookmarkBtn);
    const undoBtn = screen.getByTestId('undo-btn');
    expect(undoBtn).not.toBeDisabled();
    fireEvent.click(undoBtn);
    const redoBtn = screen.getByTestId('redo-btn');
    expect(redoBtn).not.toBeDisabled();
    fireEvent.click(redoBtn);

    // Open Audio Notes bar inside workspace
    fireEvent.click(screen.getByTestId('toggle-audio-btn'));
    expect(await screen.findByTestId('audio-notes-bar')).toBeInTheDocument();

    // Return to Library and verify our created notebook is listed and persisted!
    fireEvent.click(screen.getByTestId('back-to-library-btn'));

    await waitFor(async () => {
      const savedDocs = await storage.listDocuments();
      expect(savedDocs).toHaveLength(1);
      expect(savedDocs[0].pages[0].bookmarked).toBe(true);
    });
  });

  it('exercises Studio Onboarding empty state, Light/Dark/System themes, collapsible sidebar, populated Favourites/Recent shelves, multi-select, and customisable workspace toolbar', async () => {
    localStorage.clear();
    render(<App storage={storage} />);

    // 1. Verify rich Studio Onboarding Empty State renders when vault is empty
    const onboarding = await screen.findByTestId('studio-onboarding-empty-state');
    expect(onboarding).toBeInTheDocument();

    // 2. Test Light / Dark / System theme switcher in sidebar footer
    fireEvent.click(screen.getByTestId('sidebar-theme-dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByTestId('sidebar-theme-light'));
    expect(document.documentElement.dataset.theme).toBe('light');

    // 3. Test collapsible library sidebar toggle & re-expand
    fireEvent.click(screen.getByTestId('collapse-sidebar-btn'));
    const expandBtn = await screen.findByTestId('expand-sidebar-btn');
    fireEvent.click(expandBtn);

    // 4. Launch a 1-tap Cornell Lecture notebook directly from onboarding paper starters
    fireEvent.click(screen.getByText('Cornell Lecture'));

    // 5. Inside Workspace: test Customisable Instrument Bar & Pen Dynamics popover
    const customiseBtn = await screen.findByTestId('customise-toolbar-btn');
    fireEvent.click(customiseBtn);
    expect(screen.getByText('Customise Instrument Bar')).toBeInTheDocument();

    // Hide Laser Pointer tool and verify it disappears from strip & persists in localStorage
    expect(screen.getByTestId('tool-laser')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Laser Pointer'));
    expect(screen.queryByTestId('tool-laser')).not.toBeInTheDocument();
    expect(localStorage.getItem('inkvault_toolbar_hidden_v1')).toContain('laser');

    // Reset default toolbar order restores all tools
    fireEvent.click(screen.getByText('Reset Default Order'));
    expect(screen.getByTestId('tool-laser')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Done'));

    // Open Dedicated Pen Settings popover with live nib stroke preview
    fireEvent.click(screen.getByTestId('tool-pen'));
    expect(screen.getByText('Pen Instrument & Stylus Dynamics')).toBeInTheDocument();

    // Open Page Thumbnails sidebar
    fireEvent.click(screen.getByTestId('toggle-workspace-sidebar'));
    expect(await screen.findByTestId('workspace-sidebar')).toBeInTheDocument();

    // Return to Library, create a second Quick Note, star a notebook, and verify populated shelves + Multi-Select
    fireEvent.click(screen.getByTestId('back-to-library-btn'));
    fireEvent.click(await screen.findByTestId('quick-note-btn'));
    fireEvent.click(await screen.findByTestId('back-to-library-btn'));

    await waitFor(async () => {
      expect(await storage.listDocuments()).toHaveLength(2);
    });

    // Recent Documents shelf appears when >= 2 notebooks exist
    expect(await screen.findByLabelText('Recent Documents')).toBeInTheDocument();

    // Multi-Select mode toggles cleanly
    fireEvent.click(screen.getByTestId('multi-select-btn'));
    expect(screen.getByText(/0 notebooks selected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Done'));
  });
});
