import {
  AppSettings,
  CoverStyleId,
  PaperColorId,
  PaperOrientation,
  PaperSizeId,
  PenPreset,
  TemplateId,
} from './types';

export interface PaperSizeSpec {
  id: PaperSizeId;
  label: string;
  subtitle: string;
  width: number;
  height: number;
}

export const PAPER_SIZES: Record<PaperSizeId, PaperSizeSpec> = {
  'ipad-standard': {
    id: 'ipad-standard',
    label: 'iPad Standard',
    subtitle: '4:3 Native (768 × 1024 pt)',
    width: 768,
    height: 1024,
  },
  a4: {
    id: 'a4',
    label: 'ISO A4',
    subtitle: '210 × 297 mm (794 × 1123 px)',
    width: 794,
    height: 1123,
  },
  'us-letter': {
    id: 'us-letter',
    label: 'US Letter',
    subtitle: '8.5 × 11 in (816 × 1056 px)',
    width: 816,
    height: 1056,
  },
  a5: {
    id: 'a5',
    label: 'ISO A5 Journal',
    subtitle: '148 × 210 mm (559 × 794 px)',
    width: 559,
    height: 794,
  },
  'wide-slide': {
    id: 'wide-slide',
    label: '16:9 Lecture Slide',
    subtitle: 'Presentation (1280 × 720 px)',
    width: 1280,
    height: 720,
  },
};

export function getPageDimensions(
  sizeId: PaperSizeId,
  orientation: PaperOrientation
): { width: number; height: number } {
  const spec = PAPER_SIZES[sizeId] ?? PAPER_SIZES['ipad-standard'];
  const baseMin = Math.min(spec.width, spec.height);
  const baseMax = Math.max(spec.width, spec.height);
  return orientation === 'portrait'
    ? { width: baseMin, height: baseMax }
    : { width: baseMax, height: baseMin };
}

export interface PaperColorSpec {
  id: PaperColorId;
  label: string;
  backgroundHex: string;
  lineHex: string;
  marginHex: string;
  isDark: boolean;
  recommendedInkHex: string;
}

export const PAPER_COLORS: Record<PaperColorId, PaperColorSpec> = {
  white: {
    id: 'white',
    label: 'Archival White',
    backgroundHex: '#FFFFFF',
    lineHex: '#DCE2EC',
    marginHex: '#E8A8A8',
    isDark: false,
    recommendedInkHex: '#18181B',
  },
  cream: {
    id: 'cream',
    label: 'Warm Ivory',
    backgroundHex: '#FBF8F1',
    lineHex: '#DFD8C8',
    marginHex: '#DF9B92',
    isDark: false,
    recommendedInkHex: '#1F2937',
  },
  sepia: {
    id: 'sepia',
    label: 'Drafting Vellum',
    backgroundHex: '#F4EFE4',
    lineHex: '#D5CCB9',
    marginHex: '#C98A7B',
    isDark: false,
    recommendedInkHex: '#292524',
  },
  'slate-dark': {
    id: 'slate-dark',
    label: 'Carbon Slate',
    backgroundHex: '#1C1F26',
    lineHex: '#2E3440',
    marginHex: '#6B3A42',
    isDark: true,
    recommendedInkHex: '#F3F4F6',
  },
  obsidian: {
    id: 'obsidian',
    label: 'OLED Obsidian',
    backgroundHex: '#101114',
    lineHex: '#23262E',
    marginHex: '#583138',
    isDark: true,
    recommendedInkHex: '#FAFAFA',
  },
};

export interface TemplateSpec {
  id: TemplateId;
  label: string;
  category: 'Essentials' | 'Academic & Cornell' | 'Planners' | 'Technical';
  defaultSpacing: number;
  description: string;
}

export const PAPER_TEMPLATES: TemplateSpec[] = [
  {
    id: 'blank',
    label: 'Blank Sheet',
    category: 'Essentials',
    defaultSpacing: 32,
    description: 'Unruled archival drafting sheet',
  },
  {
    id: 'ruled-narrow',
    label: 'Ruled Narrow (7mm)',
    category: 'Essentials',
    defaultSpacing: 26,
    description: 'College-ruled horizontal lines with left margin rule',
  },
  {
    id: 'ruled-wide',
    label: 'Ruled Wide (9mm)',
    category: 'Essentials',
    defaultSpacing: 34,
    description: 'Generous line height for expressive fountain-pen notes',
  },
  {
    id: 'grid',
    label: '5mm Engineering Grid',
    category: 'Essentials',
    defaultSpacing: 24,
    description: 'Crisp orthogonal graph squares for math & schematics',
  },
  {
    id: 'dotted',
    label: '5mm Dot Matrix',
    category: 'Essentials',
    defaultSpacing: 24,
    description: 'Subtle precision dot array for structured freeform layouts',
  },
  {
    id: 'cornell',
    label: 'Cornell Study System',
    category: 'Academic & Cornell',
    defaultSpacing: 28,
    description: 'Header band, left active-recall cue column, notes area & summary box',
  },
  {
    id: 'planner-daily',
    label: 'Daily Timeblock',
    category: 'Planners',
    defaultSpacing: 28,
    description: '06:00–22:00 hourly schedule column + priorities & task notes',
  },
  {
    id: 'planner-weekly',
    label: 'Weekly 7-Day Matrix',
    category: 'Planners',
    defaultSpacing: 28,
    description: 'Balanced Monday–Sunday overview with weekly objectives block',
  },
  {
    id: 'isometric',
    label: 'Isometric 30° Grid',
    category: 'Technical',
    defaultSpacing: 28,
    description: 'Triangular 30°/60° drafting grid for 3D CAD & architecture sketches',
  },
  {
    id: 'music-staff',
    label: '10-Stave Manuscript',
    category: 'Technical',
    defaultSpacing: 8,
    description: 'Standard five-line musical staves with balanced inter-system spacing',
  },
];

export interface CoverPalettePreset {
  id: string;
  label: string;
  color: string;
  accentColor: string;
}

export const COVER_PALETTES: CoverPalettePreset[] = [
  { id: 'graphite', label: 'Graphite Charcoal', color: '#1F232B', accentColor: '#3B82F6' },
  { id: 'cobalt', label: 'Deep Cobalt', color: '#172554', accentColor: '#60A5FA' },
  { id: 'forest', label: 'Archival Pine', color: '#162C25', accentColor: '#34D399' },
  { id: 'burgundy', label: 'Oxblood Cloth', color: '#3B1820', accentColor: '#F87171' },
  { id: 'sandstone', label: 'Warm Linen', color: '#E5DFD3', accentColor: '#1E293B' },
  { id: 'slate', label: 'Mineral Slate', color: '#334155', accentColor: '#F59E0B' },
];

export const COVER_STYLES: { id: CoverStyleId; label: string }[] = [
  { id: 'architectural-spine', label: 'Architectural Spine' },
  { id: 'technical-grid', label: 'Technical Spec' },
  { id: 'monograph-linen', label: 'Monograph Band' },
  { id: 'bold-index', label: 'Index Ledger' },
];

export const FOLDER_ACCENT_COLORS: { id: string; label: string; hex: string }[] = [
  { id: 'slate', label: 'Slate', hex: '#475569' },
  { id: 'cobalt', label: 'Cobalt', hex: '#2563EB' },
  { id: 'emerald', label: 'Emerald', hex: '#059669' },
  { id: 'amber', label: 'Amber', hex: '#D97706' },
  { id: 'crimson', label: 'Crimson', hex: '#DC2626' },
  { id: 'violet', label: 'Indigo', hex: '#4F46E5' },
];

export const DEFAULT_PEN_PRESETS: PenPreset[] = [
  {
    id: 'preset-fountain-ink',
    name: 'Obsidian Fountain',
    instrument: 'fountain',
    color: '#18181B',
    width: 2.6,
    opacity: 1,
    smoothing: 0.55,
    pressureSensitivity: 0.65,
    tipSharpness: 0.5,
  },
  {
    id: 'preset-ballpoint-cobalt',
    name: 'Cobalt Lecture Pen',
    instrument: 'ballpoint',
    color: '#1D4ED8',
    width: 2.0,
    opacity: 1,
    smoothing: 0.45,
    pressureSensitivity: 0.25,
    tipSharpness: 0.2,
  },
  {
    id: 'preset-fineliner-red',
    name: 'Vermilion Markup',
    instrument: 'fineliner',
    color: '#DC2626',
    width: 1.8,
    opacity: 1,
    smoothing: 0.4,
    pressureSensitivity: 0.05,
    tipSharpness: 0.1,
  },
  {
    id: 'preset-highlighter-amber',
    name: 'Warm Study Highlight',
    instrument: 'highlighter',
    color: '#FACC15',
    width: 20,
    opacity: 0.36,
    smoothing: 0.7,
    pressureSensitivity: 0.1,
    tipSharpness: 0,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  palmRejection: true,
  stylusOnlyDrawing: false,
  drawAndHoldShapes: true,
  straightHighlighter: false,
  eraserAutoDeselect: false,
  keepStrokeWidthOnResize: false,
  autosaveDebounceMs: 350,
  autoVersionIntervalMin: 10,
  backgroundOcrEnabled: true,
  defaultPaperSize: 'ipad-standard',
  defaultTemplate: 'ruled-narrow',
  defaultPaperColor: 'white',
  penSmoothing: 0.5,
  pressureSensitivity: 0.55,
  tipSharpness: 0.45,
  pencilDoubleTapAction: 'switch-eraser',
  pencilHoverPreview: true,
  syncEnabled: false,
  syncEndpointUrl: '',
  lastSyncAt: null,
  lastBackupAt: null,
  accountDisplayName: 'Local Vault Owner',
  penPresets: DEFAULT_PEN_PRESETS,
  quickWidths: [1.2, 2.2, 3.8, 6.5, 14],
  quickColors: [
    '#18181B',
    '#1D4ED8',
    '#DC2626',
    '#047857',
    '#7C3AED',
    '#D97706',
    '#0EA5E9',
    '#F8FAFC',
  ],
};

export interface BuiltInStickerSpec {
  id: string;
  label: string;
  category: 'Academic' | 'Review' | 'Diagrams';
  color: string;
  svgMarkup: string;
}

export const BUILTIN_STICKERS: BuiltInStickerSpec[] = [
  {
    id: 'stk-exam-key',
    label: 'EXAM KEY',
    category: 'Academic',
    color: '#DC2626',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 44"><rect x="2" y="2" width="136" height="40" rx="6" fill="#FEF2F2" stroke="#DC2626" stroke-width="2.5"/><circle cx="22" cy="22" r="6" fill="#DC2626"/><text x="38" y="27" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#991B1B">EXAM KEY</text></svg>`,
  },
  {
    id: 'stk-definition',
    label: 'DEFINITION',
    category: 'Academic',
    color: '#2563EB',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 44"><rect x="2" y="2" width="146" height="40" rx="6" fill="#EFF6FF" stroke="#2563EB" stroke-width="2.5"/><rect x="12" y="11" width="5" height="22" rx="2" fill="#2563EB"/><text x="26" y="27" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#1E40AF">DEFINITION</text></svg>`,
  },
  {
    id: 'stk-formula',
    label: 'FORMULA',
    category: 'Academic',
    color: '#7C3AED',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 44"><rect x="2" y="2" width="136" height="40" rx="6" fill="#F5F3FF" stroke="#7C3AED" stroke-width="2.5"/><text x="16" y="28" font-family="Georgia,serif" font-size="18" font-style="italic" font-weight="700" fill="#6D28D9">∑ f(x)</text><text x="68" y="27" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#5B21B6"> CORE</text></svg>`,
  },
  {
    id: 'stk-verified',
    label: 'APPROVED',
    category: 'Review',
    color: '#059669',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 146 44"><rect x="2" y="2" width="142" height="40" rx="6" fill="#ECFDF5" stroke="#059669" stroke-width="2.5"/><path d="M16 22l5 5 10-11" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="40" y="27" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#065F46">VERIFIED</text></svg>`,
  },
  {
    id: 'stk-revise',
    label: 'REVISE',
    category: 'Review',
    color: '#D97706',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 44"><rect x="2" y="2" width="128" height="40" rx="6" fill="#FFFBEB" stroke="#D97706" stroke-width="2.5"/><text x="18" y="27" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#92400E">! REVISE</text></svg>`,
  },
  {
    id: 'stk-axes',
    label: 'XY Axes',
    category: 'Diagrams',
    color: '#334155',
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><line x1="20" y1="80" x2="144" y2="80" stroke="#334155" stroke-width="2.2"/><polygon points="148,80 138,75 138,85" fill="#334155"/><line x1="80" y1="144" x2="80" y2="16" stroke="#334155" stroke-width="2.2"/><polygon points="80,12 75,22 85,22" fill="#334155"/><text x="142" y="96" font-family="Georgia,serif" font-size="14" font-style="italic" fill="#334155">x</text><text x="88" y="22" font-family="Georgia,serif" font-size="14" font-style="italic" fill="#334155">y</text></svg>`,
  },
];
