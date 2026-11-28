export const INKVAULT_SCHEMA_VERSION = '1.0.0';

export type PaperSizeId = 'ipad-standard' | 'a4' | 'us-letter' | 'a5' | 'wide-slide';

export type PaperOrientation = 'portrait' | 'landscape';

export type PageRotation = 0 | 90 | 180 | 270;

export type TemplateId =
  | 'blank'
  | 'ruled-narrow'
  | 'ruled-wide'
  | 'grid'
  | 'dotted'
  | 'cornell'
  | 'planner-daily'
  | 'planner-weekly'
  | 'isometric'
  | 'music-staff';

export type PaperColorId = 'white' | 'cream' | 'sepia' | 'slate-dark' | 'obsidian';

export type CoverStyleId = 'architectural-spine' | 'technical-grid' | 'monograph-linen' | 'bold-index' | 'custom-image';

export type PenInstrument = 'fountain' | 'ballpoint' | 'brush' | 'fineliner' | 'pencil' | 'highlighter';

export type EraserMode = 'stroke' | 'pixel';

export type LassoMode = 'freehand' | 'rectangle';

export type ShapeKind = 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'triangle' | 'diamond';

export type ActiveTool =
  | 'pen'
  | 'highlighter'
  | 'underline'
  | 'pencil'
  | 'eraser'
  | 'lasso'
  | 'shape'
  | 'connector'
  | 'text'
  | 'image'
  | 'sticker'
  | 'tape'
  | 'laser'
  | 'hand';

export interface InkPoint {
  x: number;
  y: number;
  /** Pressure 0.0 - 1.0 */
  p: number;
  /** Stylus tilt X in degrees (-90..90) */
  tx?: number;
  /** Stylus tilt Y in degrees (-90..90) */
  ty?: number;
  /** Relative timestamp in ms from stroke start */
  t: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BasePageObject {
  id: string;
  layerId: string;
  zIndex: number;
  groupId?: string;
  locked?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InkStroke extends BasePageObject {
  kind: 'stroke';
  instrument: PenInstrument;
  color: string;
  width: number;
  opacity: number;
  smoothing: number;
  pressureSensitivity: number;
  tipSharpness: number;
  points: InkPoint[];
  /** Linked audio recording session ID if recorded simultaneously */
  audioSessionId?: string;
  /** Offset in ms from start of linked audio recording */
  audioOffsetMs?: number;
}

export interface ShapeObject extends BasePageObject {
  kind: 'shape';
  shapeType: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Explicit endpoints for lines/arrows */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  rotation: number;
  strokeColor: string;
  fillColor: string;
  fillOpacity: number;
  strokeWidth: number;
  label?: string;
}

export interface ConnectorObject extends BasePageObject {
  kind: 'connector';
  fromObjectId?: string;
  toObjectId?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidth: number;
  routing: 'straight' | 'elbow' | 'curved';
  arrowEnd: boolean;
  arrowStart?: boolean;
  label?: string;
}

export interface TextBoxObject extends BasePageObject {
  kind: 'textbox';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | '600' | '700';
  fontStyle: 'normal' | 'italic';
  underline?: boolean;
  color: string;
  backgroundColor: string;
  borderColor: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}

export interface ImageObject extends BasePageObject {
  kind: 'image';
  assetId: string;
  dataUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  naturalWidth: number;
  naturalHeight: number;
  ocrText?: string;
}

export interface StickerObject extends BasePageObject {
  kind: 'sticker';
  stickerId: string;
  category: string;
  label: string;
  svgMarkup?: string;
  dataUrl?: string;
  assetId?: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface TapeObject extends BasePageObject {
  kind: 'tape';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
  revealed: boolean;
  promptHint?: string;
}

export type EditablePageObject =
  | InkStroke
  | ShapeObject
  | ConnectorObject
  | TextBoxObject
  | ImageObject
  | StickerObject
  | TapeObject;

export interface PageLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export interface PageBackground {
  type: 'template' | 'pdf' | 'custom-image';
  templateId: TemplateId;
  paperColor: PaperColorId;
  lineSpacing: number;
  pdfAssetId?: string;
  pdfPageNumber?: number;
  customTemplateId?: string;
  imageAssetId?: string;
}

export interface OcrWordToken {
  text: string;
  bbox: BoundingBox;
  confidence: number;
}

export interface InkVaultPage {
  id: string;
  width: number;
  height: number;
  sizeId: PaperSizeId;
  orientation: PaperOrientation;
  rotation: PageRotation;
  isCoverPage?: boolean;
  background: PageBackground;
  layers: PageLayer[];
  strokes: InkStroke[];
  shapes: ShapeObject[];
  connectors: ConnectorObject[];
  textBoxes: TextBoxObject[];
  images: ImageObject[];
  stickers: StickerObject[];
  tapes: TapeObject[];
  bookmarked: boolean;
  bookmarkLabel?: string;
  pdfText?: string;
  ocrText?: string;
  ocrTokens?: OcrWordToken[];
  ocrUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface OutlineNode {
  id: string;
  title: string;
  pageId: string;
  level: number;
  children?: OutlineNode[];
}

export interface AudioSessionMeta {
  id: string;
  title: string;
  assetId: string;
  mimeType: string;
  durationMs: number;
  createdAt: number;
  pageIdAtStart: string;
  transcript?: string;
}

export interface NotebookCoverConfig {
  enabled: boolean;
  style: CoverStyleId;
  color: string;
  accentColor: string;
  subtitle?: string;
  customImageAssetId?: string;
}

export interface EncryptionEnvelope {
  encrypted: true;
  algorithm: 'AES-GCM-256';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltBase64: string;
  ivBase64: string;
  ciphertextBase64: string;
  hint?: string;
}

export interface MigrationReportItem {
  category: string;
  status: 'preserved' | 'partial' | 'warning' | 'unsupported';
  detail: string;
}

export interface MigrationReport {
  id: string;
  sourceFileName: string;
  sourceFormat: 'goodnotes-native' | 'goodnotes-pdf' | 'goodnotes-zip' | 'standard-pdf' | 'study-csv';
  importedAt: number;
  sourceHashSha256: string;
  pagesImported: number;
  editableStrokesReconstructed: number;
  embeddedPdfsExtracted: number;
  imagesExtracted: number;
  audioClipsExtracted: number;
  outlinesPreserved: number;
  isFlattenedPdf: boolean;
  duplicateDetected: boolean;
  summary: string;
  items: MigrationReportItem[];
}

export interface CollaboratorInfo {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: number;
}

export interface InkVaultDocument {
  id: string;
  schemaVersion: string;
  title: string;
  folderId: string | null;
  tags: string[];
  isFavorite: boolean;
  isShared: boolean;
  collaborators: CollaboratorInfo[];
  trashedAt: number | null;
  lastOpenedAt: number | null;
  cover: NotebookCoverConfig;
  pages: InkVaultPage[];
  activePageIndex: number;
  outline: OutlineNode[];
  audioSessions: AudioSessionMeta[];
  migrationReport?: MigrationReport;
  isEncrypted?: boolean;
  encryptionEnvelope?: EncryptionEnvelope;
  revision: number;
  deviceId: string;
  createdAt: number;
  updatedAt: number;
}

export interface InkVaultFolder {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  isFavorite: boolean;
  trashedAt: number | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface BinaryAssetRecord {
  id: string;
  mimeType: string;
  fileName?: string;
  sizeBytes: number;
  sha256?: string;
  /** Stored as ArrayBuffer or Base64 for portable cross-platform serialization */
  dataBase64: string;
  createdAt: number;
}

export interface DocumentVersionSnapshot {
  id: string;
  documentId: string;
  label: string;
  trigger: 'auto' | 'manual' | 'pre-restore' | 'migration';
  revision: number;
  pageCount: number;
  createdAt: number;
  documentSnapshot: InkVaultDocument;
}

export interface FlashcardItem {
  id: string;
  studySetId: string;
  front: string;
  back: string;
  imageDataUrl?: string;
  sourceDocumentId?: string;
  sourcePageId?: string;
  tags: string[];
  /** SM-2 Spaced Repetition state */
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  lapses: number;
  createdAt: number;
  updatedAt: number;
}

export interface StudySet {
  id: string;
  title: string;
  description: string;
  folderId: string | null;
  linkedDocumentId?: string;
  cards: FlashcardItem[];
  createdAt: number;
  updatedAt: number;
}

export interface CustomTemplateRecord {
  id: string;
  name: string;
  kind: 'paper' | 'cover';
  assetId: string;
  previewDataUrl: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface CustomStickerRecord {
  id: string;
  label: string;
  collection: string;
  svgMarkup?: string;
  previewDataUrl?: string;
  createdAt: number;
}

export interface PenPreset {
  id: string;
  name: string;
  instrument: PenInstrument;
  color: string;
  width: number;
  opacity: number;
  smoothing: number;
  pressureSensitivity: number;
  tipSharpness: number;
}

export interface EraserFilter {
  pen: boolean;
  pencil: boolean;
  highlighter: boolean;
  shapes: boolean;
  tape: boolean;
}

export interface LassoFilter {
  strokes: boolean;
  shapes: boolean;
  textBoxes: boolean;
  images: boolean;
  stickers: boolean;
  tapes: boolean;
}

export interface SyncConflictRecord {
  id: string;
  documentId: string;
  documentTitle: string;
  localDoc: InkVaultDocument;
  remoteDoc: InkVaultDocument;
  detectedAt: number;
}

export type PencilDoubleTapAction =
  | 'switch-eraser'
  | 'switch-previous'
  | 'toggle-ruler'
  | 'ignore';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  palmRejection: boolean;
  stylusOnlyDrawing: boolean;
  drawAndHoldShapes: boolean;
  straightHighlighter: boolean;
  eraserAutoDeselect: boolean;
  keepStrokeWidthOnResize: boolean;
  pencilDoubleTapAction?: PencilDoubleTapAction;
  pencilHoverPreview?: boolean;
  autosaveDebounceMs: number;
  autoVersionIntervalMin: number;
  backgroundOcrEnabled: boolean;
  defaultPaperSize: PaperSizeId;
  defaultTemplate: TemplateId;
  defaultPaperColor: PaperColorId;
  penSmoothing: number;
  pressureSensitivity: number;
  tipSharpness: number;
  syncEnabled: boolean;
  syncEndpointUrl: string;
  lastSyncAt: number | null;
  lastBackupAt: number | null;
  accountDisplayName: string;
  penPresets: PenPreset[];
  quickWidths: number[];
  quickColors: string[];
}
