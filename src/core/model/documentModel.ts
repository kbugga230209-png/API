import {
  getPageDimensions,
  PAPER_TEMPLATES,
} from './templates';
import {
  CoverStyleId,
  EditablePageObject,
  INKVAULT_SCHEMA_VERSION,
  InkVaultDocument,
  InkVaultFolder,
  InkVaultPage,
  NotebookCoverConfig,
  OutlineNode,
  PageBackground,
  PageLayer,
  PageRotation,
  PaperColorId,
  PaperOrientation,
  PaperSizeId,
  TemplateId,
} from './types';

export function createId(prefix = 'iv'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

let cachedDeviceId: string | null = null;
export function getLocalDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem('inkvault_device_id');
      if (existing) {
        cachedDeviceId = existing;
        return existing;
      }
      const generated = createId('dev');
      localStorage.setItem('inkvault_device_id', generated);
      cachedDeviceId = generated;
      return generated;
    }
  } catch {
    // Fallback for restricted runtimes
  }
  cachedDeviceId = createId('dev');
  return cachedDeviceId;
}

export function createDefaultLayer(name = 'Primary Ink & Notes'): PageLayer {
  return {
    id: createId('lyr'),
    name,
    visible: true,
    locked: false,
    opacity: 1,
  };
}

export interface CreatePageOptions {
  sizeId?: PaperSizeId;
  orientation?: PaperOrientation;
  templateId?: TemplateId;
  paperColor?: PaperColorId;
  lineSpacing?: number;
  width?: number;
  height?: number;
  isCoverPage?: boolean;
  backgroundOverride?: Partial<PageBackground>;
}

export function createPage(options: CreatePageOptions = {}): InkVaultPage {
  const sizeId = options.sizeId ?? 'ipad-standard';
  const orientation = options.orientation ?? 'portrait';
  const templateId = options.templateId ?? 'ruled-narrow';
  const paperColor = options.paperColor ?? 'white';
  const templateSpec = PAPER_TEMPLATES.find((t) => t.id === templateId);
  const defaultDims = getPageDimensions(sizeId, orientation);
  const now = Date.now();
  const defaultLayer = createDefaultLayer();

  return {
    id: createId('pg'),
    width: options.width ?? defaultDims.width,
    height: options.height ?? defaultDims.height,
    sizeId,
    orientation,
    rotation: 0,
    isCoverPage: options.isCoverPage ?? false,
    background: {
      type: 'template',
      templateId,
      paperColor,
      lineSpacing: options.lineSpacing ?? templateSpec?.defaultSpacing ?? 28,
      ...options.backgroundOverride,
    },
    layers: [defaultLayer],
    strokes: [],
    shapes: [],
    connectors: [],
    textBoxes: [],
    images: [],
    stickers: [],
    tapes: [],
    bookmarked: false,
    createdAt: now,
    updatedAt: now,
  };
}

export interface CreateNotebookOptions {
  title: string;
  folderId?: string | null;
  sizeId?: PaperSizeId;
  orientation?: PaperOrientation;
  templateId?: TemplateId;
  paperColor?: PaperColorId;
  initialPageCount?: number;
  cover?: Partial<NotebookCoverConfig>;
  tags?: string[];
}

export function createNotebook(options: CreateNotebookOptions): InkVaultDocument {
  const now = Date.now();
  const sizeId = options.sizeId ?? 'ipad-standard';
  const orientation = options.orientation ?? 'portrait';
  const templateId = options.templateId ?? 'ruled-narrow';
  const paperColor = options.paperColor ?? 'white';

  const cover: NotebookCoverConfig = {
    enabled: options.cover?.enabled ?? true,
    style: (options.cover?.style as CoverStyleId) ?? 'architectural-spine',
    color: options.cover?.color ?? '#1F232B',
    accentColor: options.cover?.accentColor ?? '#3B82F6',
    subtitle: options.cover?.subtitle ?? '',
    customImageAssetId: options.cover?.customImageAssetId,
  };

  const count = Math.max(1, options.initialPageCount ?? 1);
  const pages: InkVaultPage[] = [];
  for (let i = 0; i < count; i++) {
    pages.push(
      createPage({
        sizeId,
        orientation,
        templateId,
        paperColor,
      })
    );
  }

  return {
    id: createId('doc'),
    schemaVersion: INKVAULT_SCHEMA_VERSION,
    title: options.title.trim() || 'Untitled Notebook',
    folderId: options.folderId ?? null,
    tags: options.tags ?? [],
    isFavorite: false,
    isShared: false,
    collaborators: [],
    trashedAt: null,
    lastOpenedAt: now,
    cover,
    pages,
    activePageIndex: 0,
    outline: [],
    audioSessions: [],
    revision: 1,
    deviceId: getLocalDeviceId(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createFolder(
  name: string,
  parentId: string | null = null,
  color = '#475569'
): InkVaultFolder {
  const now = Date.now();
  return {
    id: createId('fld'),
    name: name.trim() || 'Untitled Folder',
    parentId,
    color,
    isFavorite: false,
    trashedAt: null,
    order: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function touchDocument(doc: InkVaultDocument): InkVaultDocument {
  return {
    ...doc,
    revision: doc.revision + 1,
    updatedAt: Date.now(),
  };
}

export function clonePageWithFreshIds(source: InkVaultPage): InkVaultPage {
  const now = Date.now();
  const layerIdMap = new Map<string, string>();
  const layers = source.layers.map((layer) => {
    const newId = createId('lyr');
    layerIdMap.set(layer.id, newId);
    return { ...layer, id: newId };
  });
  const mapLayer = (oldId: string) => layerIdMap.get(oldId) ?? layers[0]?.id ?? createId('lyr');

  return {
    ...structuredClone(source),
    id: createId('pg'),
    layers,
    strokes: source.strokes.map((s) => ({
      ...structuredClone(s),
      id: createId('stk'),
      layerId: mapLayer(s.layerId),
      createdAt: now,
      updatedAt: now,
    })),
    shapes: source.shapes.map((s) => ({
      ...structuredClone(s),
      id: createId('shp'),
      layerId: mapLayer(s.layerId),
      createdAt: now,
      updatedAt: now,
    })),
    connectors: source.connectors.map((c) => ({
      ...structuredClone(c),
      id: createId('con'),
      layerId: mapLayer(c.layerId),
      createdAt: now,
      updatedAt: now,
    })),
    textBoxes: source.textBoxes.map((t) => ({
      ...structuredClone(t),
      id: createId('txt'),
      layerId: mapLayer(t.layerId),
      createdAt: now,
      updatedAt: now,
    })),
    images: source.images.map((img) => ({
      ...structuredClone(img),
      id: createId('img'),
      layerId: mapLayer(img.layerId),
      createdAt: now,
      updatedAt: now,
    })),
    stickers: source.stickers.map((st) => ({
      ...structuredClone(st),
      id: createId('el'),
      layerId: mapLayer(st.layerId),
      createdAt: now,
      updatedAt: now,
    })),
    tapes: source.tapes.map((tp) => ({
      ...structuredClone(tp),
      id: createId('tap'),
      layerId: mapLayer(tp.layerId),
      createdAt: now,
      updatedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export function insertPageInDocument(
  doc: InkVaultDocument,
  newPage: InkVaultPage,
  insertIndex?: number
): InkVaultDocument {
  const idx =
    insertIndex === undefined
      ? doc.pages.length
      : Math.max(0, Math.min(doc.pages.length, insertIndex));
  const pages = [...doc.pages.slice(0, idx), newPage, ...doc.pages.slice(idx)];
  return touchDocument({
    ...doc,
    pages,
    activePageIndex: idx,
  });
}

export function duplicatePageInDocument(
  doc: InkVaultDocument,
  pageIndex: number
): InkVaultDocument {
  const target = doc.pages[pageIndex];
  if (!target) return doc;
  const cloned = clonePageWithFreshIds(target);
  return insertPageInDocument(doc, cloned, pageIndex + 1);
}

export function deletePagesFromDocument(
  doc: InkVaultDocument,
  pageIdsToDelete: string[]
): InkVaultDocument {
  const deleteSet = new Set(pageIdsToDelete);
  const remaining = doc.pages.filter((p) => !deleteSet.has(p.id));
  // Never leave a notebook with 0 pages: if all deleted, keep a fresh blank page matching page 0
  const safePages =
    remaining.length > 0
      ? remaining
      : [
          createPage({
            sizeId: doc.pages[0]?.sizeId ?? 'ipad-standard',
            orientation: doc.pages[0]?.orientation ?? 'portrait',
            templateId: doc.pages[0]?.background.templateId ?? 'ruled-narrow',
            paperColor: doc.pages[0]?.background.paperColor ?? 'white',
          }),
        ];
  const validPageIds = new Set(safePages.map((p) => p.id));
  const outline = filterOutlineByValidPages(doc.outline, validPageIds);
  const nextActive = Math.min(doc.activePageIndex, safePages.length - 1);
  return touchDocument({
    ...doc,
    pages: safePages,
    outline,
    activePageIndex: Math.max(0, nextActive),
  });
}

function filterOutlineByValidPages(nodes: OutlineNode[], validPageIds: Set<string>): OutlineNode[] {
  return nodes
    .filter((n) => validPageIds.has(n.pageId))
    .map((n) => ({
      ...n,
      children: n.children ? filterOutlineByValidPages(n.children, validPageIds) : undefined,
    }));
}

export function reorderPageInDocument(
  doc: InkVaultDocument,
  fromIndex: number,
  toIndex: number
): InkVaultDocument {
  if (
    fromIndex < 0 ||
    fromIndex >= doc.pages.length ||
    toIndex < 0 ||
    toIndex >= doc.pages.length ||
    fromIndex === toIndex
  ) {
    return doc;
  }
  const pages = [...doc.pages];
  const [moved] = pages.splice(fromIndex, 1);
  pages.splice(toIndex, 0, moved);
  return touchDocument({
    ...doc,
    pages,
    activePageIndex: toIndex,
  });
}

export function rotatePageInDocument(
  doc: InkVaultDocument,
  pageId: string,
  deltaDegrees: 90 | -90 | 180 = 90
): InkVaultDocument {
  const pages = doc.pages.map((p) => {
    if (p.id !== pageId) return p;
    const nextRot = (((p.rotation + deltaDegrees) % 360) + 360) % 360 as PageRotation;
    return {
      ...p,
      rotation: nextRot,
      updatedAt: Date.now(),
    };
  });
  return touchDocument({ ...doc, pages });
}

export function togglePageBookmark(
  doc: InkVaultDocument,
  pageId: string,
  label?: string
): InkVaultDocument {
  const pages = doc.pages.map((p) => {
    if (p.id !== pageId) return p;
    const nextBookmarked = !p.bookmarked;
    return {
      ...p,
      bookmarked: nextBookmarked,
      bookmarkLabel: nextBookmarked ? label ?? p.bookmarkLabel ?? `Page ${doc.pages.indexOf(p) + 1}` : undefined,
      updatedAt: Date.now(),
    };
  });
  return touchDocument({ ...doc, pages });
}

export function updatePageInDocument(
  doc: InkVaultDocument,
  pageId: string,
  updater: (page: InkVaultPage) => InkVaultPage
): InkVaultDocument {
  let changed = false;
  const pages = doc.pages.map((page) => {
    if (page.id !== pageId) return page;
    const updated = updater(page);
    if (updated !== page) {
      changed = true;
      return { ...updated, updatedAt: Date.now() };
    }
    return page;
  });
  if (!changed) return doc;
  return touchDocument({ ...doc, pages });
}

export function getNextZIndex(page: InkVaultPage): number {
  let maxZ = 0;
  const scan = (arr: { zIndex: number }[]) => {
    for (const item of arr) {
      if (item.zIndex > maxZ) maxZ = item.zIndex;
    }
  };
  scan(page.strokes);
  scan(page.shapes);
  scan(page.connectors);
  scan(page.textBoxes);
  scan(page.images);
  scan(page.stickers);
  scan(page.tapes);
  return maxZ + 1;
}

export function getAllPageObjects(page: InkVaultPage): EditablePageObject[] {
  return [
    ...page.strokes,
    ...page.shapes,
    ...page.connectors,
    ...page.textBoxes,
    ...page.images,
    ...page.stickers,
    ...page.tapes,
  ].sort((a, b) => a.zIndex - b.zIndex);
}

export function moveObjectsBetweenPages(
  doc: InkVaultDocument,
  sourcePageId: string,
  targetPageId: string,
  objectIds: string[]
): InkVaultDocument {
  if (sourcePageId === targetPageId || objectIds.length === 0) return doc;
  const idSet = new Set(objectIds);
  const sourcePage = doc.pages.find((p) => p.id === sourcePageId);
  const targetPage = doc.pages.find((p) => p.id === targetPageId);
  if (!sourcePage || !targetPage) return doc;

  const targetDefaultLayerId = targetPage.layers[0]?.id ?? createDefaultLayer().id;
  let nextZ = getNextZIndex(targetPage);
  const stampMoved = <T extends EditablePageObject>(item: T): T => ({
    ...structuredClone(item),
    layerId: targetDefaultLayerId,
    zIndex: nextZ++,
    updatedAt: Date.now(),
  });

  const movedStrokes = sourcePage.strokes.filter((x) => idSet.has(x.id)).map(stampMoved);
  const movedShapes = sourcePage.shapes.filter((x) => idSet.has(x.id)).map(stampMoved);
  const movedConnectors = sourcePage.connectors.filter((x) => idSet.has(x.id)).map(stampMoved);
  const movedTextBoxes = sourcePage.textBoxes.filter((x) => idSet.has(x.id)).map(stampMoved);
  const movedImages = sourcePage.images.filter((x) => idSet.has(x.id)).map(stampMoved);
  const movedStickers = sourcePage.stickers.filter((x) => idSet.has(x.id)).map(stampMoved);
  const movedTapes = sourcePage.tapes.filter((x) => idSet.has(x.id)).map(stampMoved);

  const pages = doc.pages.map((page) => {
    if (page.id === sourcePageId) {
      return {
        ...page,
        strokes: page.strokes.filter((x) => !idSet.has(x.id)),
        shapes: page.shapes.filter((x) => !idSet.has(x.id)),
        connectors: page.connectors.filter((x) => !idSet.has(x.id)),
        textBoxes: page.textBoxes.filter((x) => !idSet.has(x.id)),
        images: page.images.filter((x) => !idSet.has(x.id)),
        stickers: page.stickers.filter((x) => !idSet.has(x.id)),
        tapes: page.tapes.filter((x) => !idSet.has(x.id)),
        updatedAt: Date.now(),
      };
    }
    if (page.id === targetPageId) {
      return {
        ...page,
        strokes: [...page.strokes, ...movedStrokes],
        shapes: [...page.shapes, ...movedShapes],
        connectors: [...page.connectors, ...movedConnectors],
        textBoxes: [...page.textBoxes, ...movedTextBoxes],
        images: [...page.images, ...movedImages],
        stickers: [...page.stickers, ...movedStickers],
        tapes: [...page.tapes, ...movedTapes],
        updatedAt: Date.now(),
      };
    }
    return page;
  });

  return touchDocument({ ...doc, pages });
}

export function duplicateNotebook(source: InkVaultDocument): InkVaultDocument {
  const now = Date.now();
  const pageIdMap = new Map<string, string>();
  const clonedPages = source.pages.map((p) => {
    const cloned = clonePageWithFreshIds(p);
    pageIdMap.set(p.id, cloned.id);
    return cloned;
  });
  return {
    ...structuredClone(source),
    id: createId('doc'),
    title: `${source.title} (Copy)`,
    pages: clonedPages,
    outline: source.outline.map((node) => ({
      ...node,
      id: createId('out'),
      pageId: pageIdMap.get(node.pageId) ?? clonedPages[0]?.id ?? node.pageId,
    })),
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

