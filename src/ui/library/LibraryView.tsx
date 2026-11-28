import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Bookmark,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FilePlus2,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  GraduationCap,
  Grid,
  HardDrive,
  Hash,
  Layers,
  List,
  Lock,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  PenTool,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Tag,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { FOLDER_ACCENT_COLORS } from '../../core/model/templates';
import {
  AppSettings,
  InkVaultDocument,
  InkVaultFolder,
  StudySet,
  TemplateId,
} from '../../core/model/types';
import { formatBytes, formatRelativeDate, Modal } from '../../design/components';
import { NotebookCoverPreview } from './NotebookCoverPreview';

export type LibrarySection =
  | 'all'
  | 'recent'
  | 'favorites'
  | 'shared'
  | 'study-sets'
  | 'search'
  | 'trash';

export interface SearchHitItem {
  documentId: string;
  documentTitle: string;
  pageIndex: number;
  pageId: string;
  matchType:
    | 'title'
    | 'handwriting-ocr'
    | 'typed-text'
    | 'pdf-text'
    | 'image-ocr'
    | 'outline'
    | 'bookmark';
  snippet: string;
}

interface LibraryViewProps {
  documents: InkVaultDocument[];
  folders: InkVaultFolder[];
  studySets: StudySet[];
  openTabIds: string[];
  customCoverUrls: Record<string, string>;
  searchHits: SearchHitItem[];
  searchQuery: string;
  searchFilter: string;
  ocrBusyCount: number;
  settings?: AppSettings;
  storageStats?: {
    documentCount: number;
    trashedCount: number;
    folderCount: number;
    studySetCount: number;
    assetCount: number;
    totalAssetBytes: number;
    versionSnapshotCount: number;
  } | null;
  onUpdateSettings?: (next: AppSettings) => void;
  onSearchQueryChange: (q: string) => void;
  onSearchFilterChange: (filter: string) => void;
  onOpenDocument: (docId: string, pageIndex?: number) => void;
  onOpenNewNotebookModal: (folderId: string | null) => void;
  onQuickNote: (folderId: string | null) => void;
  onCreateQuickTemplateNotebook?: (
    templateId: TemplateId,
    title: string,
    folderId: string | null
  ) => void;
  onCreateFolder: (name: string, parentId: string | null, color: string) => void;
  onRenameFolder?: (folderId: string, newName: string) => void;
  onRenameDocument: (docId: string, newTitle: string) => void;
  onUpdateDocumentTags?: (docId: string, tags: string[]) => void;
  onDuplicateDocument: (docId: string) => void;
  onToggleFavoriteDocument: (docId: string) => void;
  onToggleFavoriteFolder: (folderId: string) => void;
  onMoveDocumentToFolder: (docId: string, targetFolderId: string | null) => void;
  onMoveDocumentToTrash: (docId: string) => void;
  onRestoreDocument: (docId: string) => void;
  onDeleteDocumentForever: (docId: string) => void;
  onMoveFolderToTrash: (folderId: string) => void;
  onRestoreFolder: (folderId: string) => void;
  onDeleteFolderForever: (folderId: string) => void;
  onEmptyTrash: () => void;
  onOpenImportModal: (targetFolderId: string | null) => void;
  onOpenSettingsModal: () => void;
  onOpenBackupModal: () => void;
  onOpenTemplatesModal?: () => void;
  onEncryptDocument: (docId: string, passphrase: string, hint?: string) => Promise<void>;
  onUnlockAndOpenDocument: (docId: string, passphrase: string) => Promise<void>;
  onToggleShareDocument: (docId: string, collaboratorName?: string) => void;
  onExportDocument: (docId: string) => void;
  onViewMigrationReport: (doc: InkVaultDocument) => void;
  onOpenStudySet: (studySetId?: string) => void;
  onCreateStudySet: (title: string, description: string) => void;
  onReturnToActiveWorkspace?: () => void;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  documents,
  folders,
  studySets,
  openTabIds,
  customCoverUrls,
  searchHits,
  searchQuery,
  searchFilter,
  ocrBusyCount,
  settings,
  storageStats,
  onUpdateSettings,
  onSearchQueryChange,
  onSearchFilterChange,
  onOpenDocument,
  onOpenNewNotebookModal,
  onQuickNote,
  onCreateQuickTemplateNotebook,
  onCreateFolder,
  onRenameFolder,
  onRenameDocument,
  onUpdateDocumentTags,
  onDuplicateDocument,
  onToggleFavoriteDocument,
  onToggleFavoriteFolder,
  onMoveDocumentToFolder,
  onMoveDocumentToTrash,
  onRestoreDocument,
  onDeleteDocumentForever,
  onMoveFolderToTrash,
  onRestoreFolder,
  onDeleteFolderForever,
  onEmptyTrash,
  onOpenImportModal,
  onOpenSettingsModal,
  onOpenBackupModal,
  onOpenTemplatesModal,
  onEncryptDocument,
  onUnlockAndOpenDocument,
  onToggleShareDocument,
  onExportDocument,
  onViewMigrationReport,
  onOpenStudySet,
  onCreateStudySet,
  onReturnToActiveWorkspace,
}) => {
  const [section, setSection] = useState<LibrarySection>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedCollectionTag, setSelectedCollectionTag] = useState<string | null>(null);
  const [contentKindFilter, setContentKindFilter] = useState<
    'all' | 'notebooks' | 'pdfs' | 'locked'
  >('all');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'created' | 'pages'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());

  // Multi-Select State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(() => new Set());
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);

  // Modals & Popovers
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderParentOverride, setFolderParentOverride] = useState<string | null | undefined>(
    undefined
  );
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_ACCENT_COLORS[0].hex);

  const [renamingFolder, setRenamingFolder] = useState<InkVaultFolder | null>(null);
  const [renameFolderText, setRenameFolderText] = useState('');

  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<InkVaultDocument | null>(null);
  const [renameText, setRenameText] = useState('');

  const [taggingDoc, setTaggingDoc] = useState<InkVaultDocument | null>(null);
  const [tagInput, setTagInput] = useState('');

  const [movingDoc, setMovingDoc] = useState<InkVaultDocument | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const [encryptingDoc, setEncryptingDoc] = useState<InkVaultDocument | null>(null);
  const [unlockingDoc, setUnlockingDoc] = useState<InkVaultDocument | null>(null);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseHint, setPassphraseHint] = useState('');
  const [cryptoError, setCryptoError] = useState<string | null>(null);

  const [sharingDoc, setSharingDoc] = useState<InkVaultDocument | null>(null);
  const [collaboratorInput, setCollaboratorInput] = useState('');

  const [newStudyModalOpen, setNewStudyModalOpen] = useState(false);
  const [studyTitle, setStudyTitle] = useState('');
  const [studyDesc, setStudyDesc] = useState('');
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  const topSearchInputRef = useRef<HTMLInputElement | null>(null);

  const activeDocs = useMemo(() => documents.filter((d) => d.trashedAt === null), [documents]);
  const trashedDocs = useMemo(() => documents.filter((d) => d.trashedAt !== null), [documents]);
  const activeFolders = useMemo(() => folders.filter((f) => f.trashedAt === null), [folders]);
  const trashedFolders = useMemo(() => folders.filter((f) => f.trashedAt !== null), [folders]);

  const totalPagesAcrossVault = useMemo(
    () => activeDocs.reduce((sum, d) => sum + (d.pages?.length || 0), 0),
    [activeDocs]
  );

  // Collect custom collections (tags) used across active notebooks
  const allCollectionTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of activeDocs) {
      for (const t of d.tags ?? []) {
        const clean = t.trim();
        if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeDocs]);

  // Keyboard shortcuts (`⌘K` / `/` search, `Alt+N` QuickNote, `[` toggle sidebar, `Esc` exit selection)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSection('search');
        topSearchInputRef.current?.focus();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onQuickNote(section === 'all' ? currentFolderId : null);
        return;
      }
      if (!inEditable && e.key === '/') {
        e.preventDefault();
        setSection('search');
        topSearchInputRef.current?.focus();
        return;
      }
      if (!inEditable && e.key === '[') {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setActiveMenuDocId(null);
        if (selectionMode) {
          setSelectionMode(false);
          setSelectedDocIds(new Set());
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentFolderId, onQuickNote, section, selectionMode]);

  const breadcrumbs = useMemo(() => {
    const trail: InkVaultFolder[] = [];
    let cursor = currentFolderId;
    const byId = new Map(activeFolders.map((f) => [f.id, f]));
    while (cursor) {
      const f = byId.get(cursor);
      if (!f) break;
      trail.unshift(f);
      cursor = f.parentId;
    }
    return trail;
  }, [currentFolderId, activeFolders]);

  const visibleFolders = useMemo(() => {
    if (selectedCollectionTag) return [];
    if (section === 'all') {
      return activeFolders.filter((f) => f.parentId === currentFolderId);
    }
    if (section === 'favorites') {
      return activeFolders.filter((f) => f.isFavorite);
    }
    if (section === 'trash') {
      return trashedFolders;
    }
    return [];
  }, [section, activeFolders, trashedFolders, currentFolderId, selectedCollectionTag]);

  const visibleDocuments = useMemo(() => {
    let list: InkVaultDocument[] = [];
    if (selectedCollectionTag) {
      list = activeDocs.filter((d) => d.tags?.includes(selectedCollectionTag));
    } else if (section === 'all') {
      list = activeDocs.filter((d) => d.folderId === currentFolderId);
    } else if (section === 'recent') {
      list = [...activeDocs]
        .filter((d) => d.lastOpenedAt !== null)
        .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
        .slice(0, 32);
    } else if (section === 'favorites') {
      list = activeDocs.filter((d) => d.isFavorite);
    } else if (section === 'shared') {
      list = activeDocs.filter((d) => d.isShared);
    } else if (section === 'trash') {
      list = trashedDocs;
    }

    if (contentKindFilter === 'pdfs') {
      list = list.filter((d) => d.pages.some((p) => p.background.type === 'pdf'));
    } else if (contentKindFilter === 'notebooks') {
      list = list.filter(
        (d) => !d.isEncrypted && !d.pages.some((p) => p.background.type === 'pdf')
      );
    } else if (contentKindFilter === 'locked') {
      list = list.filter((d) => Boolean(d.isEncrypted));
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title);
      if (sortBy === 'created') return b.createdAt - a.createdAt;
      if (sortBy === 'pages') return b.pages.length - a.pages.length;
      return b.updatedAt - a.updatedAt;
    });
    return sorted;
  }, [
    section,
    activeDocs,
    trashedDocs,
    currentFolderId,
    selectedCollectionTag,
    contentKindFilter,
    sortBy,
  ]);

  // Curated shelves shown at top of "All Notes" root when populated
  const recentShelfDocs = useMemo(() => {
    if (
      section !== 'all' ||
      currentFolderId !== null ||
      selectedCollectionTag !== null ||
      contentKindFilter !== 'all' ||
      activeDocs.length < 2
    ) {
      return [];
    }
    return [...activeDocs]
      .filter((d) => d.lastOpenedAt !== null)
      .sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt))
      .slice(0, 4);
  }, [section, currentFolderId, selectedCollectionTag, contentKindFilter, activeDocs]);

  const pinnedFavoritesShelf = useMemo(() => {
    if (
      section !== 'all' ||
      currentFolderId !== null ||
      selectedCollectionTag !== null ||
      contentKindFilter !== 'all'
    ) {
      return [];
    }
    return activeDocs.filter((d) => d.isFavorite).slice(0, 4);
  }, [section, currentFolderId, selectedCollectionTag, contentKindFilter, activeDocs]);

  const bookmarkedPagesAcrossVault = useMemo(() => {
    if (section !== 'favorites') return [];
    const items: { doc: InkVaultDocument; pageIndex: number; label: string }[] = [];
    for (const doc of activeDocs) {
      if (doc.isEncrypted) continue;
      doc.pages.forEach((p, idx) => {
        if (p.bookmarked) {
          items.push({
            doc,
            pageIndex: idx,
            label: p.bookmarkLabel || `Page ${idx + 1}`,
          });
        }
      });
    }
    return items;
  }, [section, activeDocs]);

  const toggleSelectDoc = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const handleCardOpen = (doc: InkVaultDocument) => {
    if (selectionMode && doc.trashedAt === null) {
      toggleSelectDoc(doc.id);
      return;
    }
    if (doc.trashedAt !== null) return;
    if (doc.isEncrypted) {
      setPassphraseInput('');
      setCryptoError(null);
      setUnlockingDoc(doc);
      return;
    }
    onOpenDocument(doc.id);
  };

  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setSidebarCollapsed(true);
    }
  };

  // Recursive Nested Folder Tree Item
  const renderFolderTreeNodes = (parentId: string | null, depth = 0): React.ReactNode => {
    const children = activeFolders.filter((f) => f.parentId === parentId);
    if (children.length === 0) return null;

    return children.map((folder) => {
      const subChildren = activeFolders.filter((f) => f.parentId === folder.id);
      const isExpanded = expandedFolderIds.has(folder.id);
      const isSelected =
        section === 'all' && !selectedCollectionTag && currentFolderId === folder.id;
      const docCount = activeDocs.filter((d) => d.folderId === folder.id).length;

      return (
        <div key={folder.id}>
          <div
            className="iv-nav-item"
            data-active={isSelected}
            data-drop-target={dragOverFolderId === folder.id}
            style={{ paddingLeft: 10 + depth * 14, paddingRight: 6 }}
            onClick={() => {
              setSelectedCollectionTag(null);
              setSection('all');
              setCurrentFolderId(folder.id);
              closeSidebarOnMobile();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverFolderId(folder.id);
            }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverFolderId(null);
              const docId = e.dataTransfer.getData('text/inkvault-doc-id');
              if (docId) onMoveDocumentToFolder(docId, folder.id);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              {subChildren.length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedFolderIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(folder.id)) next.delete(folder.id);
                      else next.add(folder.id);
                      return next;
                    });
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    width: 14,
                    height: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--iv-text-muted)',
                    cursor: 'pointer',
                  }}
                  aria-label={isExpanded ? 'Collapse subfolder' : 'Expand subfolder'}
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : (
                <span style={{ width: 14, flexShrink: 0 }} />
              )}
              <Folder size={14} color={folder.color} fill={folder.color} fillOpacity={0.2} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {folder.name}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {docCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--iv-text-muted)' }}>{docCount}</span>
              )}
              <button
                type="button"
                title="Create nested subfolder"
                onClick={(e) => {
                  e.stopPropagation();
                  setFolderParentOverride(folder.id);
                  setExpandedFolderIds((prev) => new Set(prev).add(folder.id));
                  setNewFolderName('');
                  setFolderModalOpen(true);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--iv-text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'inline-flex',
                  opacity: 0.7,
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {subChildren.length > 0 && isExpanded && renderFolderTreeNodes(folder.id, depth + 1)}
        </div>
      );
    });
  };

  // Renders an individual tactile physical notebook item + contextual menu
  const renderNotebookShelfItem = (doc: InkVaultDocument, shelfPrefix = '') => {
    const customCoverUrl = doc.cover.customImageAssetId
      ? customCoverUrls[doc.cover.customImageAssetId]
      : undefined;
    const menuKey = `${shelfPrefix}${doc.id}`;
    const menuOpen = activeMenuDocId === menuKey;
    const isSelected = selectedDocIds.has(doc.id);

    return (
      <div
        key={menuKey}
        className="iv-notebook-item"
        data-selected={isSelected}
        data-testid={shelfPrefix ? undefined : `doc-card-${doc.id}`}
        draggable={doc.trashedAt === null && !selectionMode}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/inkvault-doc-id', doc.id);
        }}
        onClick={() => handleCardOpen(doc)}
      >
        <div className="iv-notebook-cover-stage">
          <NotebookCoverPreview doc={doc} customCoverUrl={customCoverUrl} />

          {/* Selection Checkbox or Quick Star Overlay */}
          {doc.trashedAt === null && (
            <div
              className="iv-cover-quick-actions"
              data-pinned={doc.isFavorite || selectionMode || isSelected}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                left: 18,
                display: 'flex',
                justifyContent: 'space-between',
                pointerEvents: 'none',
              }}
            >
              {selectionMode ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectDoc(doc.id);
                  }}
                  style={{
                    pointerEvents: 'auto',
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.85)',
                    background: isSelected ? 'var(--iv-accent)' : 'rgba(15,17,21,0.5)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Select notebook"
                >
                  {isSelected && <Check size={13} strokeWidth={3} />}
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                aria-label={doc.isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavoriteDocument(doc.id);
                }}
                style={{
                  pointerEvents: 'auto',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  border: 'none',
                  background: doc.isFavorite
                    ? 'rgba(15, 17, 21, 0.72)'
                    : 'rgba(15, 17, 21, 0.44)',
                  backdropFilter: 'blur(4px)',
                  color: doc.isFavorite ? '#fbbf24' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Star size={12.5} fill={doc.isFavorite ? '#fbbf24' : 'none'} />
              </button>
            </div>
          )}
        </div>

        {/* Clean Unboxed Editorial Caption Below Cover */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 4,
            marginTop: 10,
            paddingLeft: 2,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                lineHeight: 1.3,
                color: 'var(--iv-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={doc.title}
            >
              {doc.title}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--iv-text-muted)',
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexWrap: 'wrap',
              }}
            >
              <span>{formatRelativeDate(doc.updatedAt)}</span>
              {!doc.isEncrypted && (
                <>
                  <span>·</span>
                  <span>
                    {doc.pages.length} {doc.pages.length === 1 ? 'page' : 'pages'}
                  </span>
                </>
              )}
              {doc.isShared && <Share2 size={10.5} color="var(--iv-accent)" />}
            </div>
            {doc.tags && doc.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {doc.tags.slice(0, 2).map((tg) => (
                  <span key={tg} className="iv-badge" style={{ height: 17, fontSize: 10 }}>
                    #{tg}
                  </span>
                ))}
              </div>
            )}
          </div>

          {doc.trashedAt === null ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="iv-icon-btn"
                style={{ width: 26, height: 26 }}
                aria-label={`Actions for ${doc.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuDocId(menuOpen ? null : menuKey);
                }}
              >
                <MoreHorizontal size={15} />
              </button>

              {menuOpen && (
                <div
                  className="iv-context-menu"
                  onClick={(e) => e.stopPropagation()}
                  role="menu"
                >
                  <button
                    type="button"
                    className="iv-context-item"
                    onClick={() => {
                      setActiveMenuDocId(null);
                      setRenameText(doc.title);
                      setRenamingDoc(doc);
                    }}
                  >
                    <PenTool size={13.5} />
                    Rename
                  </button>
                  <button
                    type="button"
                    className="iv-context-item"
                    onClick={() => {
                      setActiveMenuDocId(null);
                      onToggleFavoriteDocument(doc.id);
                    }}
                  >
                    <Star size={13.5} />
                    {doc.isFavorite ? 'Remove Favourite' : 'Add to Favourites'}
                  </button>
                  <button
                    type="button"
                    className="iv-context-item"
                    onClick={() => {
                      setActiveMenuDocId(null);
                      setTagInput('');
                      setTaggingDoc(doc);
                    }}
                  >
                    <Tag size={13.5} />
                    Collections &amp; Tags
                  </button>
                  <button
                    type="button"
                    className="iv-context-item"
                    onClick={() => {
                      setActiveMenuDocId(null);
                      onDuplicateDocument(doc.id);
                    }}
                  >
                    <Copy size={13.5} />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="iv-context-item"
                    onClick={() => {
                      setActiveMenuDocId(null);
                      setMovingDoc(doc);
                    }}
                  >
                    <FolderInput size={13.5} />
                    Move to Folder…
                  </button>
                  <button
                    type="button"
                    className="iv-context-item"
                    onClick={() => {
                      setActiveMenuDocId(null);
                      onExportDocument(doc.id);
                    }}
                  >
                    <Download size={13.5} />
                    Export PDF / Archive…
                  </button>
                  <button
                    type="button"
                    className="iv-context-item"
                    onClick={() => {
                      setActiveMenuDocId(null);
                      setSharingDoc(doc);
                    }}
                  >
                    <Share2 size={13.5} />
                    Share &amp; Access…
                  </button>
                  {!doc.isEncrypted ? (
                    <button
                      type="button"
                      className="iv-context-item"
                      onClick={() => {
                        setActiveMenuDocId(null);
                        setPassphraseInput('');
                        setPassphraseHint('');
                        setCryptoError(null);
                        setEncryptingDoc(doc);
                      }}
                    >
                      <Lock size={13.5} />
                      Lock with AES-256…
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="iv-context-item"
                      onClick={() => {
                        setActiveMenuDocId(null);
                        setPassphraseInput('');
                        setCryptoError(null);
                        setUnlockingDoc(doc);
                      }}
                    >
                      <Unlock size={13.5} />
                      Unlock Notebook…
                    </button>
                  )}
                  {doc.migrationReport && (
                    <button
                      type="button"
                      className="iv-context-item"
                      onClick={() => {
                        setActiveMenuDocId(null);
                        onViewMigrationReport(doc);
                      }}
                    >
                      <ShieldCheck size={13.5} />
                      View Migration Report
                    </button>
                  )}
                  <div
                    style={{
                      height: 1,
                      background: 'var(--iv-border)',
                      margin: '3px 4px',
                    }}
                  />
                  <button
                    type="button"
                    className="iv-context-item"
                    data-danger="true"
                    onClick={() => {
                      setActiveMenuDocId(null);
                      onMoveDocumentToTrash(doc.id);
                    }}
                  >
                    <Trash2 size={13.5} />
                    Move to Trash
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="iv-icon-btn"
                style={{ width: 26, height: 26 }}
                title="Restore notebook"
                onClick={() => onRestoreDocument(doc.id)}
              >
                <RotateCcw size={13.5} />
              </button>
              <button
                type="button"
                className="iv-icon-btn"
                style={{ width: 26, height: 26, color: 'var(--iv-danger)' }}
                title="Delete permanently"
                onClick={() => onDeleteDocumentForever(doc.id)}
              >
                <Trash2 size={13.5} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const authorInitials = useMemo(() => {
    const name = settings?.accountDisplayName?.trim() || 'Local Studio';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [settings?.accountDisplayName]);

  const currentHeadingTitle = useMemo(() => {
    if (selectedCollectionTag) return `#${selectedCollectionTag}`;
    if (section === 'all') {
      if (breadcrumbs.length > 0) return breadcrumbs[breadcrumbs.length - 1].name;
      return 'All Notes';
    }
    if (section === 'recent') return 'Recent Notes';
    if (section === 'favorites') return 'Favourites';
    if (section === 'shared') return 'Shared Notes';
    if (section === 'study-sets') return 'Study Sets';
    if (section === 'search') return 'Search & OCR';
    return 'Trash';
  }, [selectedCollectionTag, section, breadcrumbs]);

  return (
    <div className="iv-app-shell" onClick={() => setActiveMenuDocId(null)}>
      {/* Portrait Scrim */}
      <div
        className="iv-sidebar-scrim"
        data-visible={!sidebarCollapsed}
        onClick={() => setSidebarCollapsed(true)}
      />

      {/* PERSISTENT COLLAPSIBLE LEFT SIDEBAR */}
      <aside
        className="iv-library-sidebar"
        data-collapsed={sidebarCollapsed}
        aria-label="Primary Library Navigation"
      >
        {/* Studio Brand Header */}
        <div
          style={{
            height: 52,
            minHeight: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px 0 14px',
            borderBottom: '1px solid var(--iv-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 26,
                height: 30,
                borderRadius: '2px 5px 5px 2px',
                background: 'var(--iv-text-primary)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--iv-bg-surface)',
                boxShadow: '1px 1px 4px rgba(0,0,0,0.18)',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  borderRadius: '2px 0 0 2px',
                  background: 'var(--iv-accent)',
                }}
              />
              <PenTool size={12} style={{ marginLeft: 2 }} />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13.5,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.15,
                }}
              >
                INKVAULT
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--iv-text-muted)' }}>
                Notebook Studio
              </div>
            </div>
          </div>

          <button
            type="button"
            className="iv-icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => setSidebarCollapsed(true)}
            title="Collapse sidebar ([)"
            aria-label="Collapse sidebar"
            data-testid="collapse-sidebar-btn"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>

        {/* Resume Open Tabs Banner */}
        {openTabIds.length > 0 && onReturnToActiveWorkspace && (
          <div style={{ padding: '10px 10px 2px' }}>
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              style={{ width: '100%', justifyContent: 'space-between', height: 32 }}
              onClick={onReturnToActiveWorkspace}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <PenTool size={13} />
                Resume Writing
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.2)',
                }}
              >
                {openTabIds.length} open
              </span>
            </button>
          </div>
        )}

        {/* Scrollable Navigation Groups */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* GROUP 1: LIBRARY */}
          <div className="iv-nav-section-label">
            <span>Library</span>
          </div>

          {(
            [
              {
                id: 'all',
                label: 'All Notes',
                icon: BookOpen,
                count: activeDocs.length,
              },
              {
                id: 'recent',
                label: 'Recent',
                icon: Clock,
                count: activeDocs.filter((d) => d.lastOpenedAt !== null).length || undefined,
              },
              {
                id: 'favorites',
                label: 'Favourites',
                icon: Star,
                count: activeDocs.filter((d) => d.isFavorite).length || undefined,
              },
              {
                id: 'shared',
                label: 'Shared',
                icon: Share2,
                count: activeDocs.filter((d) => d.isShared).length || undefined,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive =
              !selectedCollectionTag &&
              section === item.id &&
              (item.id !== 'all' || currentFolderId === null);

            return (
              <button
                key={item.id}
                type="button"
                className="iv-nav-item"
                data-active={isActive}
                data-drop-target={item.id === 'all' && dragOverFolderId === '__root__'}
                data-testid={`nav-${item.id}`}
                onClick={() => {
                  setSelectedCollectionTag(null);
                  setSection(item.id);
                  if (item.id === 'all') setCurrentFolderId(null);
                  closeSidebarOnMobile();
                }}
                onDragOver={
                  item.id === 'all'
                    ? (e) => {
                        e.preventDefault();
                        setDragOverFolderId('__root__');
                      }
                    : undefined
                }
                onDragLeave={
                  item.id === 'all' ? () => setDragOverFolderId(null) : undefined
                }
                onDrop={
                  item.id === 'all'
                    ? (e) => {
                        e.preventDefault();
                        setDragOverFolderId(null);
                        const docId = e.dataTransfer.getData('text/inkvault-doc-id');
                        if (docId) onMoveDocumentToFolder(docId, null);
                      }
                    : undefined
                }
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                  <Icon size={15} />
                  <span>{item.label}</span>
                </span>
                {item.count !== undefined && item.count > 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--iv-text-muted)' }}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* GROUP 2: ORGANISATION */}
          <div className="iv-nav-section-label">
            <span>Organisation</span>
            <button
              type="button"
              onClick={() => {
                setFolderParentOverride(section === 'all' ? currentFolderId : null);
                setNewFolderName('');
                setFolderModalOpen(true);
              }}
              title="New Folder"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--iv-text-muted)',
                cursor: 'pointer',
                padding: 2,
                display: 'inline-flex',
              }}
            >
              <FolderPlus size={13} />
            </button>
          </div>

          {activeFolders.length === 0 ? (
            <button
              type="button"
              className="iv-nav-item"
              onClick={() => {
                setFolderParentOverride(null);
                setNewFolderName('');
                setFolderModalOpen(true);
              }}
              style={{ color: 'var(--iv-text-muted)', fontSize: 12 }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <FolderPlus size={14} />
                Create First Folder…
              </span>
            </button>
          ) : (
            renderFolderTreeNodes(null, 0)
          )}

          {/* Custom Collections (Tags, Stationery & Study Decks) */}
          <div className="iv-nav-section-label" style={{ paddingTop: 12 }}>
            <span>Collections</span>
          </div>

          {allCollectionTags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              className="iv-nav-item"
              data-active={selectedCollectionTag === tag}
              onClick={() => {
                setSection('all');
                setSelectedCollectionTag(selectedCollectionTag === tag ? null : tag);
                closeSidebarOnMobile();
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Hash size={13.5} color="var(--iv-accent)" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tag}
                </span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--iv-text-muted)' }}>{count}</span>
            </button>
          ))}

          {onOpenTemplatesModal && (
            <button
              type="button"
              className="iv-nav-item"
              onClick={() => {
                onOpenTemplatesModal();
                closeSidebarOnMobile();
              }}
              data-testid="open-templates-btn"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <Layers size={15} />
                <span>Templates &amp; Covers</span>
              </span>
            </button>
          )}

          <button
            type="button"
            className="iv-nav-item"
            data-active={!selectedCollectionTag && section === 'study-sets'}
            data-testid="nav-study-sets"
            onClick={() => {
              setSelectedCollectionTag(null);
              setSection('study-sets');
              closeSidebarOnMobile();
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <GraduationCap size={15} />
              <span>Study Sets</span>
            </span>
            {studySets.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--iv-text-muted)' }}>
                {studySets.length}
              </span>
            )}
          </button>

          {/* GROUP 3: STORAGE */}
          <div className="iv-nav-section-label" style={{ paddingTop: 12 }}>
            <span>Storage</span>
          </div>

          <button
            type="button"
            className="iv-nav-item"
            onClick={() => {
              onOpenBackupModal();
              closeSidebarOnMobile();
            }}
            data-testid="open-backup-btn"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <HardDrive size={15} />
              <span>Backup &amp; Sync</span>
            </span>
          </button>

          <button
            type="button"
            className="iv-nav-item"
            data-active={!selectedCollectionTag && section === 'trash'}
            data-testid="nav-trash"
            onClick={() => {
              setSelectedCollectionTag(null);
              setSection('trash');
              closeSidebarOnMobile();
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <Trash2 size={15} />
              <span>Trash</span>
            </span>
            {trashedDocs.length + trashedFolders.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--iv-text-muted)' }}>
                {trashedDocs.length + trashedFolders.length}
              </span>
            )}
          </button>
        </nav>

        {/* Bottom Storage Information & Appearance Footer */}
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--iv-border)',
            background: 'var(--iv-bg-sidebar-elevated)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--iv-text-secondary)' }}>
              Local Vault Storage
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--iv-success)',
              }}
            >
              Offline Ready
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--iv-text-muted)', lineHeight: 1.35 }}>
            {activeDocs.length} {activeDocs.length === 1 ? 'note' : 'notes'} · {totalPagesAcrossVault}{' '}
            {totalPagesAcrossVault === 1 ? 'page' : 'pages'}
            {storageStats ? ` · ${formatBytes(storageStats.totalAssetBytes)}` : ''}
          </div>

          {settings && onUpdateSettings && (
            <div className="iv-segmented" style={{ width: '100%' }} aria-label="Appearance theme">
              {(
                [
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'system', label: 'Auto', icon: Monitor },
                ] as const
              ).map((th) => {
                const Icon = th.icon;
                return (
                  <button
                    key={th.id}
                    type="button"
                    className="iv-segmented-item"
                    style={{ flex: 1, justifyContent: 'center', height: 24, padding: 0 }}
                    data-active={settings.theme === th.id}
                    onClick={() => onUpdateSettings({ ...settings, theme: th.id })}
                    data-testid={`sidebar-theme-${th.id}`}
                  >
                    <Icon size={11.5} />
                    <span>{th.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN WORKSPACE & LIBRARY AREA */}
      <main className="iv-library-main">
        {/* REFINED TOP NAVIGATION TOOLBAR (52px) */}
        <header
          style={{
            minHeight: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 20px',
            borderBottom: '1px solid var(--iv-border)',
            background: 'var(--iv-bg-surface)',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: Sidebar Toggle + Breadcrumb Trail */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {sidebarCollapsed && (
              <button
                type="button"
                className="iv-icon-btn"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Open navigation sidebar"
                title="Show sidebar ([)"
                data-testid="expand-sidebar-btn"
              >
                <PanelLeft size={17} />
              </button>
            )}

            <nav
              aria-label="Breadcrumb"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                minWidth: 0,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="iv-btn iv-btn-ghost"
                style={{
                  height: 28,
                  padding: '0 7px',
                  fontSize: 13.5,
                  fontWeight:
                    section === 'all' && !currentFolderId && !selectedCollectionTag ? 650 : 500,
                  color:
                    section === 'all' && !currentFolderId && !selectedCollectionTag
                      ? 'var(--iv-text-primary)'
                      : 'var(--iv-text-secondary)',
                }}
                onClick={() => {
                  setSelectedCollectionTag(null);
                  setSection('all');
                  setCurrentFolderId(null);
                }}
              >
                Library
              </button>

              {selectedCollectionTag ? (
                <>
                  <ChevronRight size={13} color="var(--iv-text-muted)" />
                  <span style={{ fontSize: 13.5, fontWeight: 650, padding: '0 4px' }}>
                    #{selectedCollectionTag}
                  </span>
                </>
              ) : section === 'all' ? (
                breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    <ChevronRight size={13} color="var(--iv-text-muted)" />
                    <button
                      type="button"
                      className="iv-btn iv-btn-ghost"
                      style={{
                        height: 28,
                        padding: '0 7px',
                        fontSize: 13.5,
                        fontWeight: idx === breadcrumbs.length - 1 ? 650 : 500,
                        color:
                          idx === breadcrumbs.length - 1
                            ? 'var(--iv-text-primary)'
                            : 'var(--iv-text-secondary)',
                      }}
                      onClick={() => setCurrentFolderId(crumb.id)}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))
              ) : (
                <>
                  <ChevronRight size={13} color="var(--iv-text-muted)" />
                  <span style={{ fontSize: 13.5, fontWeight: 650, padding: '0 4px' }}>
                    {currentHeadingTitle}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Right: Compact Search + Restrained Action Hierarchy + Profile/Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* Compact Search Field */}
            <div style={{ position: 'relative', width: 224 }}>
              <Search
                size={13.5}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--iv-text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                ref={topSearchInputRef}
                type="search"
                className="iv-input"
                style={{
                  width: '100%',
                  height: 31,
                  paddingLeft: 30,
                  paddingRight: 28,
                  fontSize: 12.5,
                  background: 'var(--iv-bg-subtle)',
                  borderColor: 'transparent',
                }}
                placeholder="Search notes & OCR…"
                value={searchQuery}
                onFocus={() => setSection('search')}
                onChange={(e) => {
                  onSearchQueryChange(e.target.value);
                  if (section !== 'search') setSection('search');
                }}
                aria-label="Global library search"
              />
              <span
                className="iv-hide-portrait"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 10,
                  color: 'var(--iv-text-muted)',
                  fontFamily: 'var(--iv-font-mono)',
                  pointerEvents: 'none',
                }}
              >
                ⌘K
              </span>
            </div>

            <div
              style={{ width: 1, height: 18, background: 'var(--iv-border)', margin: '0 2px' }}
              className="iv-hide-portrait"
            />

            {section !== 'trash' && section !== 'study-sets' && (
              <>
                {/* Subtle Secondary Icon/Compact Actions */}
                <button
                  type="button"
                  className="iv-icon-btn"
                  onClick={() => onQuickNote(section === 'all' ? currentFolderId : null)}
                  title="Quick Note (Alt+N)"
                  aria-label="Quick Note"
                  data-testid="quick-note-btn"
                >
                  <PenTool size={15} />
                </button>

                <button
                  type="button"
                  className="iv-icon-btn"
                  onClick={() => {
                    setFolderParentOverride(section === 'all' ? currentFolderId : null);
                    setNewFolderName('');
                    setFolderModalOpen(true);
                  }}
                  title="New Folder"
                  aria-label="New Folder"
                  data-testid="new-folder-btn"
                >
                  <FolderPlus size={16} />
                </button>

                <button
                  type="button"
                  className="iv-btn iv-btn-subtle"
                  style={{ height: 31, padding: '0 10px', fontSize: 12.5 }}
                  onClick={() => onOpenImportModal(section === 'all' ? currentFolderId : null)}
                  title="Import PDF or Goodnotes Archive"
                  data-testid="import-migrate-btn"
                >
                  <Upload size={13.5} />
                  <span className="iv-hide-portrait">Import</span>
                </button>

                {activeDocs.length > 0 && (
                  <button
                    type="button"
                    className="iv-icon-btn"
                    data-active={selectionMode}
                    onClick={() => {
                      setSelectionMode((v) => !v);
                      setSelectedDocIds(new Set());
                    }}
                    title="Select multiple notebooks"
                    aria-label="Multi-select notebooks"
                    data-testid="multi-select-btn"
                  >
                    <CheckSquare size={15} />
                  </button>
                )}

                {/* Single Restrained Primary CTA */}
                <button
                  type="button"
                  className="iv-btn iv-btn-primary"
                  style={{ height: 31, padding: '0 12px', fontSize: 12.5 }}
                  onClick={() =>
                    onOpenNewNotebookModal(section === 'all' ? currentFolderId : null)
                  }
                  data-testid="new-notebook-btn"
                >
                  <Plus size={14} strokeWidth={2.4} />
                  <span>New Notebook</span>
                </button>
              </>
            )}

            {section === 'study-sets' && (
              <button
                type="button"
                className="iv-btn iv-btn-primary"
                style={{ height: 31 }}
                onClick={() => {
                  setStudyTitle('');
                  setStudyDesc('');
                  setNewStudyModalOpen(true);
                }}
                data-testid="new-studyset-btn"
              >
                <Plus size={14} />
                New Study Set
              </button>
            )}

            {section === 'trash' && (trashedDocs.length > 0 || trashedFolders.length > 0) && (
              <button
                type="button"
                className="iv-btn iv-btn-danger"
                style={{ height: 31 }}
                onClick={() => setConfirmEmptyTrash(true)}
                data-testid="empty-trash-btn"
              >
                <Trash2 size={13.5} />
                Empty Trash
              </button>
            )}

            {/* Profile / Settings Pill */}
            <button
              type="button"
              onClick={onOpenSettingsModal}
              title="Studio Preferences & Profile"
              aria-label="Open Settings"
              data-testid="open-settings-btn"
              style={{
                width: 31,
                height: 31,
                borderRadius: '50%',
                border: '1px solid var(--iv-border-strong)',
                background: 'var(--iv-bg-subtle)',
                color: 'var(--iv-text-primary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 2,
              }}
            >
              {authorInitials || <Settings size={14} />}
            </button>
          </div>
        </header>

        {/* Multi-Select Batch Action Bar */}
        {selectionMode && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 24px',
              background: 'var(--iv-accent-soft)',
              borderBottom: '1px solid var(--iv-border)',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--iv-accent)' }}>
              {selectedDocIds.size} notebook{selectedDocIds.size === 1 ? '' : 's'} selected
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="iv-btn"
                style={{ height: 28, fontSize: 12 }}
                disabled={selectedDocIds.size === 0}
                onClick={() => setBatchMoveOpen(true)}
              >
                <FolderInput size={13} />
                Move…
              </button>
              <button
                type="button"
                className="iv-btn"
                style={{ height: 28, fontSize: 12 }}
                disabled={selectedDocIds.size === 0}
                onClick={() => {
                  selectedDocIds.forEach((id) => onToggleFavoriteDocument(id));
                  setSelectionMode(false);
                  setSelectedDocIds(new Set());
                }}
              >
                <Star size={13} />
                Toggle Star
              </button>
              <button
                type="button"
                className="iv-btn iv-btn-danger"
                style={{ height: 28, fontSize: 12 }}
                disabled={selectedDocIds.size === 0}
                onClick={() => {
                  selectedDocIds.forEach((id) => onMoveDocumentToTrash(id));
                  setSelectionMode(false);
                  setSelectedDocIds(new Set());
                }}
              >
                <Trash2 size={13} />
                Move to Trash
              </button>
              <button
                type="button"
                className="iv-btn iv-btn-ghost"
                style={{ height: 28, fontSize: 12 }}
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedDocIds(new Set());
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* SCROLLABLE LIBRARY STAGE */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '22px 26px 56px' }}>
            {/* 1. SEARCH & OCR VIEW */}
            {section === 'search' && (
              <div>
                <div style={{ marginBottom: 18 }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: 22,
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Search Library &amp; Handwriting OCR
                  </h1>
                  <p
                    style={{
                      margin: '4px 0 14px',
                      fontSize: 13,
                      color: 'var(--iv-text-secondary)',
                    }}
                  >
                    Instant local search across notebook titles, asynchronous handwriting OCR, embedded images, PDF text, and outlines.
                  </p>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      type="search"
                      className="iv-input"
                      style={{ flex: 1, minWidth: 240, height: 38 }}
                      placeholder="Search handwritten words, equations, PDF text, titles…"
                      value={searchQuery}
                      onChange={(e) => onSearchQueryChange(e.target.value)}
                      autoFocus
                    />
                    <div className="iv-segmented" style={{ flexWrap: 'wrap' }}>
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'title', label: 'Titles' },
                          { id: 'handwriting-ocr', label: 'Handwriting' },
                          { id: 'image-ocr', label: 'Images' },
                          { id: 'pdf-text', label: 'PDFs' },
                          { id: 'typed-text', label: 'Text' },
                          { id: 'outline', label: 'Outlines' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className="iv-segmented-item"
                          data-active={searchFilter === f.id}
                          onClick={() => onSearchFilterChange(f.id)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {ocrBusyCount > 0 && (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: '9px 13px',
                      borderRadius: 'var(--iv-radius-sm)',
                      background: 'var(--iv-accent-soft)',
                      color: 'var(--iv-accent)',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Sparkles size={14} />
                    Indexing {ocrBusyCount} page{ocrBusyCount === 1 ? '' : 's'} in background OCR worker…
                  </div>
                )}

                {!searchQuery.trim() ? (
                  <div
                    style={{
                      padding: '44px 20px',
                      borderRadius: 'var(--iv-radius-lg)',
                      border: '1px solid var(--iv-border)',
                      background: 'var(--iv-bg-surface)',
                      textAlign: 'center',
                      color: 'var(--iv-text-secondary)',
                    }}
                  >
                    Type any phrase above to search every notebook, PDF annotation, and handwritten sheet in your local vault.
                  </div>
                ) : searchHits.length === 0 ? (
                  <div
                    style={{
                      padding: '44px 20px',
                      borderRadius: 'var(--iv-radius-lg)',
                      border: '1px solid var(--iv-border)',
                      background: 'var(--iv-bg-surface)',
                      textAlign: 'center',
                      color: 'var(--iv-text-secondary)',
                    }}
                  >
                    No matching pages found for &ldquo;{searchQuery}&rdquo;.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {searchHits.map((hit, idx) => (
                      <button
                        key={`${hit.documentId}_${hit.pageId}_${hit.matchType}_${idx}`}
                        type="button"
                        onClick={() => onOpenDocument(hit.documentId, hit.pageIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 16,
                          padding: '12px 16px',
                          borderRadius: 'var(--iv-radius-md)',
                          border: '1px solid var(--iv-border)',
                          background: 'var(--iv-bg-surface)',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{hit.documentTitle}</span>
                            <span className="iv-badge">Page {hit.pageIndex + 1}</span>
                            <span
                              className="iv-badge"
                              style={{
                                background: 'var(--iv-accent-soft)',
                                color: 'var(--iv-accent)',
                              }}
                            >
                              {hit.matchType}
                            </span>
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12.5,
                              color: 'var(--iv-text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {hit.snippet}
                          </div>
                        </div>
                        <ChevronRight size={16} color="var(--iv-text-muted)" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. STUDY SETS VIEW */}
            {section === 'study-sets' && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    Study Sets &amp; Spaced Repetition
                  </h1>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--iv-text-secondary)' }}>
                    Optional active-recall flashcards powered by SuperMemo SM-2 and notebook highlight extraction.
                  </p>
                </div>

                {studySets.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 28px',
                      borderRadius: 'var(--iv-radius-lg)',
                      border: '1px solid var(--iv-border)',
                      background: 'var(--iv-bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 24,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ maxWidth: 520 }}>
                      <div style={{ fontWeight: 650, fontSize: 16 }}>
                        Create Your First Active-Recall Deck
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--iv-text-secondary)' }}>
                        Extract highlighted passages, bookmarked pages, and Tape masks directly from any notebook, or import CSV flashcard decks.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="iv-btn iv-btn-primary"
                        onClick={() => setNewStudyModalOpen(true)}
                      >
                        <Plus size={14} />
                        New Study Set
                      </button>
                      <button
                        type="button"
                        className="iv-btn"
                        onClick={() => onOpenImportModal(null)}
                      >
                        <Upload size={14} />
                        Import CSV
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="iv-folder-grid">
                    {studySets.map((set) => {
                      const dueCount = set.cards.filter((c) => c.nextReviewAt <= Date.now()).length;
                      return (
                        <div
                          key={set.id}
                          className="iv-folder-tile"
                          style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 16 }}
                          onClick={() => onOpenStudySet(set.id)}
                        >
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span className="iv-badge">{set.cards.length} cards</span>
                            {dueCount > 0 && (
                              <span
                                className="iv-badge"
                                style={{
                                  background: 'var(--iv-amber-soft)',
                                  color: 'var(--iv-amber)',
                                }}
                              >
                                {dueCount} due
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 650, fontSize: 14.5, marginTop: 8 }}>
                            {set.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--iv-text-secondary)' }}>
                            {set.description || 'SM-2 spaced repetition study set'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. PRIMARY NOTEBOOK LIBRARY (ALL, RECENT, FAVOURITES, SHARED, TRASH) */}
            {section !== 'search' && section !== 'study-sets' && (
              <>
                {/* WELCOME & CONTEXTUAL HEADER */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    marginBottom: 22,
                  }}
                >
                  <div>
                    {section === 'all' && !currentFolderId && !selectedCollectionTag && (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--iv-accent)',
                          letterSpacing: '0.02em',
                          marginBottom: 3,
                        }}
                      >
                        {getTimeGreeting()}
                        {settings?.accountDisplayName &&
                        settings.accountDisplayName !== 'Local User'
                          ? `, ${settings.accountDisplayName}`
                          : ''}
                      </div>
                    )}
                    <h1
                      style={{
                        margin: 0,
                        fontSize: 24,
                        fontWeight: 700,
                        letterSpacing: '-0.024em',
                        lineHeight: 1.18,
                      }}
                    >
                      {currentHeadingTitle}
                    </h1>
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: 13,
                        color: 'var(--iv-text-secondary)',
                      }}
                    >
                      {section === 'trash'
                        ? 'Recover deleted notebooks and folders, or permanently erase them from local storage.'
                        : section === 'favorites'
                        ? 'Pinned notebooks, folders, and bookmarked pages across your library.'
                        : section === 'recent'
                        ? 'Notebooks ordered by most recent reading and writing activity.'
                        : section === 'shared'
                        ? 'Notebooks marked for collaboration and portable archive exchange.'
                        : activeDocs.length === 0
                        ? 'Your private, offline-first digital notebook & PDF studio.'
                        : `${visibleFolders.length > 0 ? `${visibleFolders.length} folder${visibleFolders.length === 1 ? '' : 's'} · ` : ''}${visibleDocuments.length} notebook${visibleDocuments.length === 1 ? '' : 's'} in this view`}
                    </p>
                  </div>

                  {/* Filter, Sort & Grid/List Controls (shown when library has items) */}
                  {(activeDocs.length > 0 || visibleFolders.length > 0) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {section !== 'trash' && (
                        <div className="iv-segmented" role="group" aria-label="Filter by type">
                          {(
                            [
                              { id: 'all', label: 'All' },
                              { id: 'notebooks', label: 'Notes' },
                              { id: 'pdfs', label: 'PDFs' },
                              { id: 'locked', label: 'Locked' },
                            ] as const
                          ).map((flt) => (
                            <button
                              key={flt.id}
                              type="button"
                              className="iv-segmented-item"
                              data-active={contentKindFilter === flt.id}
                              onClick={() => setContentKindFilter(flt.id)}
                            >
                              {flt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <select
                        className="iv-select"
                        style={{ height: 30, fontSize: 12, paddingRight: 24 }}
                        value={sortBy}
                        onChange={(e) =>
                          setSortBy(e.target.value as 'updated' | 'name' | 'created' | 'pages')
                        }
                        aria-label="Sort notebooks"
                      >
                        <option value="updated">Sort: Last Modified</option>
                        <option value="name">Sort: Title (A–Z)</option>
                        <option value="created">Sort: Date Created</option>
                        <option value="pages">Sort: Page Count</option>
                      </select>

                      <div className="iv-segmented" role="group" aria-label="Layout view">
                        <button
                          type="button"
                          className="iv-segmented-item"
                          data-active={viewMode === 'grid'}
                          onClick={() => setViewMode('grid')}
                          aria-label="Grid view"
                        >
                          <Grid size={13} />
                        </button>
                        <button
                          type="button"
                          className="iv-segmented-item"
                          data-active={viewMode === 'list'}
                          onClick={() => setViewMode('list')}
                          aria-label="List view"
                        >
                          <List size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* BESPOKE STUDIO ONBOARDING EMPTY STATE (No tiny floating box!) */}
                {visibleFolders.length === 0 &&
                visibleDocuments.length === 0 &&
                bookmarkedPagesAcrossVault.length === 0 ? (
                  section === 'all' &&
                  contentKindFilter === 'all' &&
                  !selectedCollectionTag ? (
                    <div
                      data-testid="studio-onboarding-empty-state"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 24,
                      }}
                    >
                      {/* Hero Shelf Banner with Tactile Visual Notebook Illustrations */}
                      <div
                        style={{
                          borderRadius: 'var(--iv-radius-lg)',
                          border: '1px solid var(--iv-border)',
                          background: 'var(--iv-bg-surface)',
                          padding: '28px 30px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: 28,
                          alignItems: 'center',
                          boxShadow: 'var(--iv-shadow-sm)',
                        }}
                      >
                        <div>
                          <span
                            className="iv-badge"
                            style={{
                              background: 'var(--iv-accent-soft)',
                              color: 'var(--iv-accent)',
                              marginBottom: 10,
                            }}
                          >
                            100% LOCAL &amp; OFFLINE-FIRST
                          </span>
                          <h2
                            style={{
                              margin: 0,
                              fontSize: 21,
                              fontWeight: 700,
                              letterSpacing: '-0.02em',
                              lineHeight: 1.25,
                            }}
                          >
                            Begin Your Digital Notebook Library
                          </h2>
                          <p
                            style={{
                              margin: '8px 0 18px',
                              fontSize: 13.5,
                              color: 'var(--iv-text-secondary)',
                              lineHeight: 1.55,
                            }}
                          >
                            Write naturally with pressure- and tilt-sensitive vector ink, annotate multi-hundred-page PDFs, or bring your existing Goodnotes notebooks over with full fidelity reports.
                          </p>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="iv-btn iv-btn-primary"
                              style={{ height: 36, padding: '0 16px' }}
                              onClick={() => onOpenNewNotebookModal(currentFolderId)}
                            >
                              <FilePlus2 size={15} />
                              Create a Notebook
                            </button>
                            <button
                              type="button"
                              className="iv-btn"
                              style={{ height: 36, padding: '0 14px' }}
                              onClick={() => onOpenImportModal(currentFolderId)}
                            >
                              <Upload size={14} />
                              Import Goodnotes / PDF
                            </button>
                          </div>
                        </div>

                        {/* Tactile Three-Notebook Visual Showcase */}
                        <div
                          aria-hidden="true"
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'flex-end',
                            gap: 16,
                            padding: '10px 6px 4px',
                          }}
                        >
                          {/* Sample Visual Cover 1: Linen Monograph */}
                          <div
                            style={{
                              width: 102,
                              height: 136,
                              borderRadius: '2px 7px 7px 2px',
                              background: '#1f242d',
                              boxShadow: 'var(--iv-shadow-book)',
                              position: 'relative',
                              padding: '12px 10px 10px 16px',
                              color: '#f8fafc',
                              transform: 'rotate(-4deg)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 10,
                                background: '#2563eb',
                                borderRadius: '2px 0 0 2px',
                              }}
                            />
                            <div style={{ fontSize: 10, fontWeight: 650, lineHeight: 1.25 }}>
                              Architectural Field Notes
                            </div>
                            <div style={{ fontSize: 8, opacity: 0.6 }}>INKVAULT</div>
                          </div>

                          {/* Sample Visual Cover 2: Ruled Cream Cornell Sheet */}
                          <div
                            style={{
                              width: 112,
                              height: 150,
                              borderRadius: '3px 8px 8px 3px',
                              background: '#faf7f0',
                              border: '1px solid rgba(20,22,26,0.14)',
                              boxShadow: 'var(--iv-shadow-book-hover)',
                              padding: '14px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 7,
                              zIndex: 2,
                            }}
                          >
                            <div
                              style={{
                                height: 3,
                                width: '58%',
                                borderRadius: 2,
                                background: '#1e40af',
                              }}
                            />
                            <div style={{ height: 1, background: 'rgba(20,22,26,0.12)' }} />
                            <div style={{ height: 1, background: 'rgba(20,22,26,0.1)' }} />
                            <div
                              style={{
                                height: 8,
                                width: '78%',
                                borderRadius: 2,
                                background: 'rgba(250, 204, 21, 0.55)',
                              }}
                            />
                            <div style={{ height: 1, background: 'rgba(20,22,26,0.1)' }} />
                            <svg width="78" height="26" viewBox="0 0 78 26" fill="none">
                              <path
                                d="M4 20 C18 6, 28 24, 44 11 C54 3, 62 18, 74 8"
                                stroke="#18181b"
                                strokeWidth="2.1"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>

                          {/* Sample Visual Cover 3: Deep Forest PDF Study Binder */}
                          <div
                            style={{
                              width: 102,
                              height: 136,
                              borderRadius: '2px 7px 7px 2px',
                              background: '#1d352d',
                              boxShadow: 'var(--iv-shadow-book)',
                              position: 'relative',
                              padding: '12px 10px 10px 16px',
                              color: '#f8fafc',
                              transform: 'rotate(4deg)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 10,
                                background: '#10b981',
                                borderRadius: '2px 0 0 2px',
                              }}
                            />
                            <div style={{ fontSize: 10, fontWeight: 650, lineHeight: 1.25 }}>
                              Annotated Research PDF
                            </div>
                            <div style={{ fontSize: 8, opacity: 0.65 }}>PDF STUDIO</div>
                          </div>
                        </div>
                      </div>

                      {/* 4 Workflow Onboarding Action Cards */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: 14,
                        }}
                      >
                        {[
                          {
                            icon: BookOpen,
                            title: 'Create a Notebook',
                            desc: 'Choose bespoke covers, ruled/grid/Cornell templates, paper colours, and iPad or A4 sizes.',
                            cta: 'Configure Notebook',
                            onClick: () => onOpenNewNotebookModal(currentFolderId),
                          },
                          {
                            icon: Sparkles,
                            title: 'Import Goodnotes Archive',
                            desc: 'Migrate .goodnotes or batch .zip folders non-destructively with itemized fidelity reports.',
                            cta: 'Migrate Goodnotes',
                            onClick: () => onOpenImportModal(currentFolderId),
                          },
                          {
                            icon: FileText,
                            title: 'Annotate an Existing PDF',
                            desc: 'Highlight, underline, bookmark, merge/split pages, and search full PDF & handwritten text.',
                            cta: 'Import PDF File',
                            onClick: () => onOpenImportModal(currentFolderId),
                          },
                          {
                            icon: PenTool,
                            title: 'Start a Quick Note',
                            desc: 'Skip setup and open a clean writing sheet immediately for meetings, sketches, or equations.',
                            cta: 'Open Blank Sheet',
                            onClick: () => onQuickNote(currentFolderId),
                          },
                        ].map((card) => {
                          const Icon = card.icon;
                          return (
                            <button
                              key={card.title}
                              type="button"
                              onClick={card.onClick}
                              style={{
                                padding: 18,
                                borderRadius: 'var(--iv-radius-md)',
                                border: '1px solid var(--iv-border)',
                                background: 'var(--iv-bg-surface)',
                                boxShadow: 'var(--iv-shadow-xs)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 8,
                                    background: 'var(--iv-accent-soft)',
                                    color: 'var(--iv-accent)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 12,
                                  }}
                                >
                                  <Icon size={17} />
                                </div>
                                <div style={{ fontWeight: 650, fontSize: 14 }}>{card.title}</div>
                                <div
                                  style={{
                                    fontSize: 12.5,
                                    color: 'var(--iv-text-secondary)',
                                    marginTop: 4,
                                    lineHeight: 1.45,
                                  }}
                                >
                                  {card.desc}
                                </div>
                              </div>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'var(--iv-accent)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {card.cta} <ChevronRight size={13} />
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* 1-Tap Paper Quick-Starters */}
                      {onCreateQuickTemplateNotebook && (
                        <div>
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: 'var(--iv-text-muted)',
                              marginBottom: 10,
                            }}
                          >
                            Start Immediately From Paper Layout
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                              gap: 10,
                            }}
                          >
                            {(
                              [
                                { id: 'ruled-narrow', title: 'Ruled Journal', sub: '7mm Narrow Rules' },
                                { id: 'grid', title: 'Engineering Pad', sub: '5mm Square Grid' },
                                { id: 'cornell', title: 'Cornell Lecture', sub: 'Cue + Notes + Summary' },
                                { id: 'dotted', title: 'Dot Matrix', sub: '5mm Bullet Grid' },
                                { id: 'planner-weekly', title: 'Weekly Schedule', sub: 'Structured 7-Day' },
                              ] as const
                            ).map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                className="iv-folder-tile"
                                onClick={() =>
                                  onCreateQuickTemplateNotebook(
                                    preset.id,
                                    preset.title,
                                    currentFolderId
                                  )
                                }
                              >
                                <div style={{ textAlign: 'left' }}>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{preset.title}</div>
                                  <div style={{ fontSize: 11, color: 'var(--iv-text-muted)' }}>
                                    {preset.sub}
                                  </div>
                                </div>
                                <Plus size={14} color="var(--iv-accent)" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Clean contextual empty state for filtered views / Trash / Favorites */
                    <div
                      style={{
                        padding: '44px 24px',
                        borderRadius: 'var(--iv-radius-lg)',
                        border: '1px solid var(--iv-border)',
                        background: 'var(--iv-bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 650, fontSize: 15 }}>
                          {section === 'trash'
                            ? 'Trash is Empty'
                            : section === 'favorites'
                            ? 'No Pinned Favourites Yet'
                            : section === 'shared'
                            ? 'No Shared Notebooks Yet'
                            : 'No Matching Notebooks in This View'}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--iv-text-secondary)', marginTop: 3 }}>
                          {section === 'favorites'
                            ? 'Tap the star icon on any notebook cover or bookmark pages inside the workspace to pin them here.'
                            : section === 'trash'
                            ? 'Deleted notebooks and folders stay recoverable here until emptied.'
                            : 'Adjust your filter above or create a new notebook.'}
                        </div>
                      </div>
                      {contentKindFilter !== 'all' && (
                        <button
                          type="button"
                          className="iv-btn"
                          onClick={() => setContentKindFilter('all')}
                        >
                          Reset Filter
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                    {/* PINNED FAVOURITES SHELF (on All Notes root) */}
                    {viewMode === 'grid' && pinnedFavoritesShelf.length > 0 && (
                      <section aria-label="Pinned Favourites">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 12,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: 'var(--iv-text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <Star size={12.5} color="var(--iv-amber)" fill="var(--iv-amber)" />
                            Favourites
                          </span>
                        </div>
                        <div className="iv-notebook-grid">
                          {pinnedFavoritesShelf.map((doc) =>
                            renderNotebookShelfItem(doc, 'fav_shelf_')
                          )}
                        </div>
                      </section>
                    )}

                    {/* RECENT DOCUMENTS SHELF (on All Notes root) */}
                    {viewMode === 'grid' && recentShelfDocs.length > 0 && (
                      <section aria-label="Recent Documents">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 12,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: 'var(--iv-text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <Clock size={12.5} />
                            Recent Documents
                          </span>
                          <button
                            type="button"
                            className="iv-btn iv-btn-ghost"
                            style={{ height: 24, padding: '0 6px', fontSize: 11.5 }}
                            onClick={() => setSection('recent')}
                          >
                            View all
                          </button>
                        </div>
                        <div className="iv-notebook-grid">
                          {recentShelfDocs.map((doc) =>
                            renderNotebookShelfItem(doc, 'recent_shelf_')
                          )}
                        </div>
                      </section>
                    )}

                    {/* FOLDERS SECTION */}
                    {visibleFolders.length > 0 && viewMode === 'grid' && (
                      <section aria-label="Folders">
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'var(--iv-text-secondary)',
                            marginBottom: 10,
                          }}
                        >
                          Folders ({visibleFolders.length})
                        </div>
                        <div className="iv-folder-grid">
                          {visibleFolders.map((folder) => {
                            const childDocCount = activeDocs.filter(
                              (d) => d.folderId === folder.id
                            ).length;
                            const subFolderCount = activeFolders.filter(
                              (f) => f.parentId === folder.id
                            ).length;

                            return (
                              <div
                                key={folder.id}
                                className="iv-folder-tile"
                                data-drop-target={dragOverFolderId === folder.id}
                                onClick={() => {
                                  if (folder.trashedAt !== null) return;
                                  setSection('all');
                                  setCurrentFolderId(folder.id);
                                }}
                                onDragOver={(e) => {
                                  if (folder.trashedAt !== null) return;
                                  e.preventDefault();
                                  setDragOverFolderId(folder.id);
                                }}
                                onDragLeave={() => setDragOverFolderId(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragOverFolderId(null);
                                  const docId = e.dataTransfer.getData('text/inkvault-doc-id');
                                  if (docId) onMoveDocumentToFolder(docId, folder.id);
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 11,
                                    minWidth: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 36,
                                      height: 30,
                                      borderRadius: '4px 6px 6px 4px',
                                      background: 'var(--iv-bg-subtle)',
                                      borderLeft: `4px solid ${folder.color}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: folder.color,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Folder size={16} fill={folder.color} fillOpacity={0.18} />
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: 13.5,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {folder.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--iv-text-muted)' }}>
                                      {childDocCount} {childDocCount === 1 ? 'note' : 'notes'}
                                      {subFolderCount > 0 ? ` · ${subFolderCount} subfolders` : ''}
                                    </div>
                                  </div>
                                </div>

                                {folder.trashedAt === null ? (
                                  <div
                                    style={{ display: 'flex', alignItems: 'center', gap: 2 }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="iv-icon-btn"
                                      style={{ width: 26, height: 26 }}
                                      aria-label="Favourite folder"
                                      onClick={() => onToggleFavoriteFolder(folder.id)}
                                    >
                                      <Star
                                        size={13.5}
                                        fill={folder.isFavorite ? 'var(--iv-amber)' : 'none'}
                                        color={
                                          folder.isFavorite ? 'var(--iv-amber)' : 'currentColor'
                                        }
                                      />
                                    </button>
                                    {onRenameFolder && (
                                      <button
                                        type="button"
                                        className="iv-icon-btn"
                                        style={{ width: 26, height: 26 }}
                                        title="Rename folder"
                                        onClick={() => {
                                          setRenameFolderText(folder.name);
                                          setRenamingFolder(folder);
                                        }}
                                      >
                                        <PenTool size={12.5} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="iv-icon-btn"
                                      style={{ width: 26, height: 26 }}
                                      title="Move folder to Trash"
                                      onClick={() => onMoveFolderToTrash(folder.id)}
                                    >
                                      <Trash2 size={12.5} />
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    style={{ display: 'flex', gap: 4 }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="iv-btn"
                                      style={{ height: 26, fontSize: 11 }}
                                      onClick={() => onRestoreFolder(folder.id)}
                                    >
                                      Restore
                                    </button>
                                    <button
                                      type="button"
                                      className="iv-btn iv-btn-danger"
                                      style={{ height: 26, fontSize: 11 }}
                                      onClick={() => onDeleteFolderForever(folder.id)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* ALL NOTEBOOKS GRID OR LIST */}
                    {visibleDocuments.length > 0 && (
                      <section aria-label="Notebooks">
                        {viewMode === 'grid' &&
                          (pinnedFavoritesShelf.length > 0 ||
                            recentShelfDocs.length > 0 ||
                            visibleFolders.length > 0) && (
                            <div
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color: 'var(--iv-text-secondary)',
                                marginBottom: 14,
                              }}
                            >
                              {section === 'all' ? 'All Notebooks' : currentHeadingTitle} (
                              {visibleDocuments.length})
                            </div>
                          )}

                        {viewMode === 'grid' ? (
                          <div className="iv-notebook-grid">
                            {visibleDocuments.map((doc) => renderNotebookShelfItem(doc))}
                          </div>
                        ) : (
                          /* Refined Editorial List View */
                          <div
                            style={{
                              borderRadius: 'var(--iv-radius-md)',
                              border: '1px solid var(--iv-border)',
                              background: 'var(--iv-bg-surface)',
                              overflow: 'hidden',
                            }}
                          >
                            {visibleFolders.map((folder) => (
                              <div
                                key={folder.id}
                                onClick={() => {
                                  if (folder.trashedAt === null) {
                                    setSection('all');
                                    setCurrentFolderId(folder.id);
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 16px',
                                  borderBottom: '1px solid var(--iv-border)',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <Folder
                                    size={17}
                                    color={folder.color}
                                    fill={folder.color}
                                    fillOpacity={0.2}
                                  />
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                                      {folder.name}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--iv-text-muted)' }}>
                                      Folder ·{' '}
                                      {activeDocs.filter((d) => d.folderId === folder.id).length}{' '}
                                      items
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight size={15} color="var(--iv-text-muted)" />
                              </div>
                            ))}

                            {visibleDocuments.map((doc, idx) => (
                              <div
                                key={doc.id}
                                onClick={() => handleCardOpen(doc)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 16,
                                  padding: '10px 16px',
                                  borderBottom:
                                    idx < visibleDocuments.length - 1
                                      ? '1px solid var(--iv-border)'
                                      : 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    minWidth: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 24,
                                      height: 32,
                                      borderRadius: '2px 4px 4px 2px',
                                      background: doc.cover.enabled
                                        ? doc.cover.color
                                        : '#faf8f5',
                                      borderLeft: `4px solid ${doc.cover.accentColor}`,
                                      border: '1px solid var(--iv-border)',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: 13.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                      }}
                                    >
                                      <span
                                        style={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {doc.title}
                                      </span>
                                      {doc.isEncrypted && <Lock size={12.5} />}
                                      {doc.isShared && (
                                        <Share2 size={12.5} color="var(--iv-accent)" />
                                      )}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--iv-text-muted)' }}>
                                      {doc.isEncrypted
                                        ? 'AES-256 Encrypted'
                                        : `${doc.pages.length} pages`}{' '}
                                      · Modified {formatRelativeDate(doc.updatedAt)}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {doc.trashedAt === null ? (
                                    <>
                                      <button
                                        type="button"
                                        className="iv-icon-btn"
                                        onClick={() => onToggleFavoriteDocument(doc.id)}
                                      >
                                        <Star
                                          size={14}
                                          fill={doc.isFavorite ? 'var(--iv-amber)' : 'none'}
                                          color={
                                            doc.isFavorite ? 'var(--iv-amber)' : 'currentColor'
                                          }
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        className="iv-btn iv-btn-subtle"
                                        style={{ height: 27, fontSize: 11.5 }}
                                        onClick={() => onExportDocument(doc.id)}
                                      >
                                        Export
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="iv-btn"
                                      style={{ height: 27, fontSize: 11.5 }}
                                      onClick={() => onRestoreDocument(doc.id)}
                                    >
                                      Restore
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    )}

                    {/* BOOKMARKED PAGES IN FAVOURITES */}
                    {section === 'favorites' && bookmarkedPagesAcrossVault.length > 0 && (
                      <section aria-label="Bookmarked Pages">
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'var(--iv-text-secondary)',
                            marginBottom: 10,
                          }}
                        >
                          Bookmarked Pages ({bookmarkedPagesAcrossVault.length})
                        </div>
                        <div className="iv-folder-grid">
                          {bookmarkedPagesAcrossVault.map((bm) => (
                            <button
                              key={`${bm.doc.id}_${bm.pageIndex}`}
                              type="button"
                              className="iv-folder-tile"
                              onClick={() => onOpenDocument(bm.doc.id, bm.pageIndex)}
                              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                            >
                              <Bookmark size={16} color="var(--iv-amber)" fill="var(--iv-amber)" />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{bm.label}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--iv-text-muted)' }}>
                                  {bm.doc.title} · Page {bm.pageIndex + 1}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Create Folder / Subfolder Modal */}
      <Modal
        open={folderModalOpen}
        title="New Folder"
        subtitle={
          (folderParentOverride ?? currentFolderId)
            ? 'Creates a nested subfolder inside the selected folder'
            : 'Organise notebooks into subject, client, or project folders'
        }
        maxWidth={420}
        onClose={() => setFolderModalOpen(false)}
        footer={
          <>
            <button type="button" className="iv-btn" onClick={() => setFolderModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              data-testid="confirm-create-folder"
              onClick={() => {
                if (!newFolderName.trim()) return;
                const parent =
                  folderParentOverride !== undefined
                    ? folderParentOverride
                    : section === 'all'
                    ? currentFolderId
                    : null;
                onCreateFolder(newFolderName.trim(), parent, newFolderColor);
                setFolderModalOpen(false);
              }}
            >
              Create Folder
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Folder Name
            </label>
            <input
              className="iv-input"
              style={{ width: '100%' }}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Semester 2 — Organic Chemistry"
              autoFocus
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Spine Accent</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {FOLDER_ACCENT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.label}
                  onClick={() => setNewFolderColor(c.hex)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: c.hex,
                    border:
                      newFolderColor === c.hex
                        ? '2px solid var(--iv-text-primary)'
                        : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Rename Folder Modal */}
      <Modal
        open={Boolean(renamingFolder)}
        title="Rename Folder"
        maxWidth={400}
        onClose={() => setRenamingFolder(null)}
        footer={
          <>
            <button type="button" className="iv-btn" onClick={() => setRenamingFolder(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              onClick={() => {
                if (renamingFolder && renameFolderText.trim() && onRenameFolder) {
                  onRenameFolder(renamingFolder.id, renameFolderText.trim());
                }
                setRenamingFolder(null);
              }}
            >
              Save
            </button>
          </>
        }
      >
        <input
          className="iv-input"
          style={{ width: '100%' }}
          value={renameFolderText}
          onChange={(e) => setRenameFolderText(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* Rename Notebook Modal */}
      <Modal
        open={Boolean(renamingDoc)}
        title="Rename Notebook"
        maxWidth={420}
        onClose={() => setRenamingDoc(null)}
        footer={
          <>
            <button type="button" className="iv-btn" onClick={() => setRenamingDoc(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              onClick={() => {
                if (renamingDoc && renameText.trim()) {
                  onRenameDocument(renamingDoc.id, renameText.trim());
                }
                setRenamingDoc(null);
              }}
            >
              Save Title
            </button>
          </>
        }
      >
        <input
          className="iv-input"
          style={{ width: '100%' }}
          value={renameText}
          onChange={(e) => setRenameText(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* Custom Collection Tags Modal */}
      <Modal
        open={Boolean(taggingDoc)}
        title={`Collections & Tags — ${taggingDoc?.title ?? ''}`}
        subtitle="Assign custom collection tags to surface this notebook in your sidebar Collections"
        maxWidth={440}
        onClose={() => setTaggingDoc(null)}
        footer={
          <button type="button" className="iv-btn iv-btn-primary" onClick={() => setTaggingDoc(null)}>
            Done
          </button>
        }
      >
        {taggingDoc && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="iv-input"
                style={{ flex: 1 }}
                placeholder="e.g. Exam-Prep, Client-Work, Research"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="iv-btn iv-btn-primary"
                onClick={() => {
                  const clean = tagInput.trim().replace(/^#+/, '');
                  if (!clean || !onUpdateDocumentTags) return;
                  const next = Array.from(new Set([...(taggingDoc.tags ?? []), clean]));
                  onUpdateDocumentTags(taggingDoc.id, next);
                  setTaggingDoc({ ...taggingDoc, tags: next });
                  setTagInput('');
                }}
              >
                Add
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(taggingDoc.tags ?? []).length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--iv-text-muted)' }}>
                  No collection tags assigned yet.
                </span>
              ) : (
                taggingDoc.tags.map((tg) => (
                  <span
                    key={tg}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 9px',
                      borderRadius: 6,
                      background: 'var(--iv-bg-subtle)',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    #{tg}
                    <button
                      type="button"
                      onClick={() => {
                        if (!onUpdateDocumentTags) return;
                        const next = taggingDoc.tags.filter((x) => x !== tg);
                        onUpdateDocumentTags(taggingDoc.id, next);
                        setTaggingDoc({ ...taggingDoc, tags: next });
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--iv-text-muted)',
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Single or Batch Move to Folder Modal */}
      <Modal
        open={Boolean(movingDoc) || batchMoveOpen}
        title="Move to Folder"
        maxWidth={440}
        onClose={() => {
          setMovingDoc(null);
          setBatchMoveOpen(false);
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            className="iv-btn"
            style={{ justifyContent: 'flex-start' }}
            onClick={() => {
              if (movingDoc) {
                onMoveDocumentToFolder(movingDoc.id, null);
              } else if (batchMoveOpen) {
                selectedDocIds.forEach((id) => onMoveDocumentToFolder(id, null));
                setSelectionMode(false);
                setSelectedDocIds(new Set());
              }
              setMovingDoc(null);
              setBatchMoveOpen(false);
            }}
          >
            <BookOpen size={14} />
            Root Library (All Notes)
          </button>
          {activeFolders.map((f) => (
            <button
              key={f.id}
              type="button"
              className="iv-btn"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => {
                if (movingDoc) {
                  onMoveDocumentToFolder(movingDoc.id, f.id);
                } else if (batchMoveOpen) {
                  selectedDocIds.forEach((id) => onMoveDocumentToFolder(id, f.id));
                  setSelectionMode(false);
                  setSelectedDocIds(new Set());
                }
                setMovingDoc(null);
                setBatchMoveOpen(false);
              }}
            >
              <Folder size={14} color={f.color} />
              {f.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* Encrypt Notebook Modal */}
      <Modal
        open={Boolean(encryptingDoc)}
        title="Lock Notebook with AES-256-GCM"
        subtitle="Derives a 256-bit key locally via PBKDF2-SHA256 (100,000 iterations)."
        maxWidth={460}
        onClose={() => setEncryptingDoc(null)}
        footer={
          <>
            <button type="button" className="iv-btn" onClick={() => setEncryptingDoc(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              onClick={async () => {
                if (!encryptingDoc) return;
                try {
                  await onEncryptDocument(
                    encryptingDoc.id,
                    passphraseInput,
                    passphraseHint || undefined
                  );
                  setEncryptingDoc(null);
                } catch (err) {
                  setCryptoError(err instanceof Error ? err.message : 'Encryption failed');
                }
              }}
            >
              <Lock size={14} />
              Encrypt Notebook
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Passphrase
            </label>
            <input
              type="password"
              className="iv-input"
              style={{ width: '100%' }}
              value={passphraseInput}
              onChange={(e) => setPassphraseInput(e.target.value)}
              placeholder="Enter passphrase"
              autoFocus
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Optional Passphrase Hint
            </label>
            <input
              className="iv-input"
              style={{ width: '100%' }}
              value={passphraseHint}
              onChange={(e) => setPassphraseHint(e.target.value)}
              placeholder="Optional reminder"
            />
          </div>
          {cryptoError && <div style={{ color: 'var(--iv-danger)', fontSize: 12 }}>{cryptoError}</div>}
        </div>
      </Modal>

      {/* Unlock Encrypted Notebook Modal */}
      <Modal
        open={Boolean(unlockingDoc)}
        title={`Unlock "${unlockingDoc?.title ?? ''}"`}
        subtitle={
          unlockingDoc?.encryptionEnvelope?.hint
            ? `Hint: ${unlockingDoc.encryptionEnvelope.hint}`
            : 'Enter passphrase to decrypt AES-256-GCM content locally'
        }
        maxWidth={440}
        onClose={() => setUnlockingDoc(null)}
        footer={
          <>
            <button type="button" className="iv-btn" onClick={() => setUnlockingDoc(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              onClick={async () => {
                if (!unlockingDoc) return;
                try {
                  await onUnlockAndOpenDocument(unlockingDoc.id, passphraseInput);
                  setUnlockingDoc(null);
                } catch (err) {
                  setCryptoError(err instanceof Error ? err.message : 'Incorrect passphrase');
                }
              }}
            >
              <Unlock size={14} />
              Decrypt &amp; Open
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            className="iv-input"
            style={{ width: '100%' }}
            value={passphraseInput}
            onChange={(e) => setPassphraseInput(e.target.value)}
            placeholder="Enter passphrase"
            autoFocus
          />
          {cryptoError && <div style={{ color: 'var(--iv-danger)', fontSize: 12 }}>{cryptoError}</div>}
        </div>
      </Modal>

      {/* Share / Collaboration Modal */}
      <Modal
        open={Boolean(sharingDoc)}
        title={`Share & Collaboration — ${sharingDoc?.title ?? ''}`}
        subtitle="Manage shared access metadata or export a portable .inkvault bundle"
        maxWidth={480}
        onClose={() => setSharingDoc(null)}
        footer={
          <button type="button" className="iv-btn" onClick={() => setSharingDoc(null)}>
            Done
          </button>
        }
      >
        {sharingDoc && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Mark as Shared Document</div>
                <div style={{ fontSize: 12, color: 'var(--iv-text-secondary)' }}>
                  Surfaces this notebook in the Shared view
                </div>
              </div>
              <button
                type="button"
                className={sharingDoc.isShared ? 'iv-btn iv-btn-danger' : 'iv-btn iv-btn-primary'}
                onClick={() => {
                  onToggleShareDocument(sharingDoc.id);
                  setSharingDoc({ ...sharingDoc, isShared: !sharingDoc.isShared });
                }}
              >
                {sharingDoc.isShared ? 'Stop Sharing' : 'Enable Shared Access'}
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--iv-border)', paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Add Collaborator Record
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="iv-input"
                  style={{ flex: 1 }}
                  value={collaboratorInput}
                  onChange={(e) => setCollaboratorInput(e.target.value)}
                  placeholder="Collaborator name or email"
                />
                <button
                  type="button"
                  className="iv-btn"
                  onClick={() => {
                    if (!collaboratorInput.trim()) return;
                    onToggleShareDocument(sharingDoc.id, collaboratorInput.trim());
                    setCollaboratorInput('');
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {sharingDoc.collaborators.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sharingDoc.collaborators.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 5,
                      background: 'var(--iv-bg-subtle)',
                      fontSize: 12.5,
                    }}
                  >
                    <span>{c.name}</span>
                    <span className="iv-badge">{c.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* New Study Set Modal */}
      <Modal
        open={newStudyModalOpen}
        title="Create Study Set"
        subtitle="Spaced-repetition active recall deck (SM-2)"
        maxWidth={440}
        onClose={() => setNewStudyModalOpen(false)}
        footer={
          <>
            <button type="button" className="iv-btn" onClick={() => setNewStudyModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              onClick={() => {
                if (!studyTitle.trim()) return;
                onCreateStudySet(studyTitle.trim(), studyDesc.trim());
                setNewStudyModalOpen(false);
              }}
            >
              Create Deck
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="iv-input"
            placeholder="Deck title (e.g. Organic Chemistry Mechanisms)"
            value={studyTitle}
            onChange={(e) => setStudyTitle(e.target.value)}
            autoFocus
          />
          <input
            className="iv-input"
            placeholder="Optional description"
            value={studyDesc}
            onChange={(e) => setStudyDesc(e.target.value)}
          />
        </div>
      </Modal>

      {/* Confirm Empty Trash Modal */}
      <Modal
        open={confirmEmptyTrash}
        title="Empty Trash Permanently?"
        subtitle="All notebooks and folders currently in Trash will be permanently deleted from local storage."
        maxWidth={420}
        onClose={() => setConfirmEmptyTrash(false)}
        footer={
          <>
            <button type="button" className="iv-btn" onClick={() => setConfirmEmptyTrash(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="iv-btn iv-btn-danger"
              onClick={() => {
                onEmptyTrash();
                setConfirmEmptyTrash(false);
              }}
            >
              Empty Trash Forever
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: 'var(--iv-text-secondary)' }}>
          {trashedDocs.length} notebook(s) and {trashedFolders.length} folder(s) will be permanently erased.
        </div>
      </Modal>
    </div>
  );
};
