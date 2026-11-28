import { createId, getNextZIndex } from '../model/documentModel';
import {
  BoundingBox,
  ConnectorObject,
  EditablePageObject,
  EraserFilter,
  ImageObject,
  InkPoint,
  InkStroke,
  InkVaultPage,
  LassoFilter,
  PenInstrument,
  ShapeKind,
  ShapeObject,
  StickerObject,
  TapeObject,
  TextBoxObject,
} from '../model/types';

export interface RulerState {
  visible: boolean;
  x: number;
  y: number;
  angleDeg: number;
  length: number;
  thickness: number;
}

export interface AlignmentGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
  label?: string;
}

/**
 * Smooths raw pointer samples with Chaikin / Catmull-Rom weighted averaging
 * while preserving endpoints and pressure/tilt/timestamp channels.
 */
export function smoothInkPoints(points: InkPoint[], smoothing: number): InkPoint[] {
  if (points.length <= 2 || smoothing <= 0.02) {
    return points;
  }
  const weight = Math.min(0.85, Math.max(0, smoothing)) * 0.45;
  const pass1: InkPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    pass1.push({
      x: curr.x * (1 - 2 * weight) + (prev.x + next.x) * weight,
      y: curr.y * (1 - 2 * weight) + (prev.y + next.y) * weight,
      p: curr.p * 0.7 + (prev.p + next.p) * 0.15,
      tx: curr.tx,
      ty: curr.ty,
      t: curr.t,
    });
  }
  pass1.push(points[points.length - 1]);
  return pass1;
}

/**
 * Computes instantaneous stroke radius at sample index `i` based on instrument physics,
 * hardware stylus pressure, tiltX/tiltY, velocity, tipSharpness, and pressureSensitivity.
 */
export function computePointWidth(
  points: InkPoint[],
  index: number,
  baseWidth: number,
  instrument: PenInstrument,
  pressureSensitivity: number,
  tipSharpness: number
): number {
  const pt = points[index];
  const p = Number.isFinite(pt.p) && pt.p > 0 ? Math.min(1, Math.max(0.05, pt.p)) : 0.5;
  const sens = Math.min(1, Math.max(0, pressureSensitivity));

  if (instrument === 'fineliner') {
    return Math.max(0.5, baseWidth * (1 + (p - 0.5) * 0.08 * sens));
  }

  if (instrument === 'highlighter') {
    const tiltFactor =
      pt.tx !== undefined && pt.ty !== undefined
        ? 1 + (Math.hypot(pt.tx, pt.ty) / 90) * 0.25
        : 1;
    return Math.max(4, baseWidth * tiltFactor);
  }

  if (instrument === 'pencil') {
    const tiltMag =
      pt.tx !== undefined && pt.ty !== undefined ? Math.hypot(pt.tx, pt.ty) : 0;
    // Tilting Apple Pencil shades with side of lead (up to 2.1x wider)
    const tiltMultiplier = 1 + Math.min(1.1, (tiltMag / 75) * 1.1);
    const pressureFactor = 1 - sens * 0.35 + p * sens * 0.7;
    return Math.max(0.8, baseWidth * pressureFactor * tiltMultiplier);
  }

  // Velocity dampening for Fountain / Brush / Ballpoint
  let velocity = 0;
  if (index > 0) {
    const prev = points[index - 1];
    const dt = Math.max(1, pt.t - prev.t);
    velocity = Math.hypot(pt.x - prev.x, pt.y - prev.y) / dt;
  }
  const velFactor = Math.max(0.65, 1 - Math.min(0.35, velocity * 0.09 * tipSharpness));

  // Taper start/end for fountain & brush
  let taper = 1;
  const taperLen = instrument === 'brush' ? 6 : instrument === 'fountain' ? 4 : 2;
  if (points.length > taperLen * 2) {
    if (index < taperLen) {
      taper = 0.45 + 0.55 * ((index + 1) / taperLen) * (1 - tipSharpness * 0.35);
    } else if (index >= points.length - taperLen) {
      const rem = points.length - index;
      taper = 0.35 + 0.65 * (rem / taperLen) * (1 - tipSharpness * 0.45);
    }
  }

  if (instrument === 'ballpoint') {
    const pMod = 1 - sens * 0.22 + p * sens * 0.44;
    return Math.max(0.6, baseWidth * pMod);
  }

  if (instrument === 'brush') {
    const pMod = Math.max(0.18, 0.25 + p * (0.75 + sens * 0.95));
    return Math.max(0.6, baseWidth * pMod * taper);
  }

  // Fountain Pen: calligraphic nib angle modulation + pressure + velocity
  let nibFactor = 1;
  if (index > 0) {
    const prev = points[index - 1];
    const strokeAngle = Math.atan2(pt.y - prev.y, pt.x - prev.x);
    const nibAngle = ((pt.tx ?? 35) * Math.PI) / 180;
    nibFactor = 0.72 + 0.48 * Math.abs(Math.sin(strokeAngle - nibAngle)) * tipSharpness;
  }
  const pMod = 1 - sens * 0.45 + p * sens * 0.95;
  return Math.max(0.5, baseWidth * pMod * velFactor * nibFactor * taper);
}

let cachedPencilPatternCanvas: HTMLCanvasElement | null = null;
function getPencilGrainAlpha(x: number, y: number): number {
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return 0.65 + 0.35 * (hash - Math.floor(hash));
}

/**
 * Renders a single vector InkStroke onto a 2D canvas context without flattening source data.
 */
export function renderInkStrokeToCanvas(
  ctx: CanvasRenderingContext2D,
  stroke: InkStroke,
  overrideOpacity?: number
): void {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.save();
  const alpha = overrideOpacity !== undefined ? overrideOpacity : stroke.opacity;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = stroke.instrument === 'highlighter' ? 'butt' : 'round';
  ctx.lineJoin = 'round';

  if (pts.length === 1) {
    const r = Math.max(0.75, stroke.width * 0.5);
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Uniform-width fast path for Highlighter & Fineliner
  if (stroke.instrument === 'highlighter' || stroke.instrument === 'fineliner') {
    ctx.lineWidth = computePointWidth(
      pts,
      Math.floor(pts.length / 2),
      stroke.width,
      stroke.instrument,
      stroke.pressureSensitivity,
      stroke.tipSharpness
    );
    if (stroke.instrument === 'highlighter') {
      ctx.lineCap = 'round';
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) * 0.5;
      const midY = (pts[i].y + pts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Variable-width quadratic segment rendering for Fountain, Brush, Ballpoint & Pencil
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const w = computePointWidth(
      pts,
      i,
      stroke.width,
      stroke.instrument,
      stroke.pressureSensitivity,
      stroke.tipSharpness
    );
    ctx.lineWidth = w;
    if (stroke.instrument === 'pencil') {
      const grain = getPencilGrainAlpha(p1.x, p1.y);
      ctx.globalAlpha = Math.max(0.15, alpha * 0.82 * grain);
    }
    ctx.beginPath();
    if (i >= 2) {
      const prevMidX = (pts[i - 2].x + p0.x) * 0.5;
      const prevMidY = (pts[i - 2].y + p0.y) * 0.5;
      const currMidX = (p0.x + p1.x) * 0.5;
      const currMidY = (p0.y + p1.y) * 0.5;
      ctx.moveTo(prevMidX, prevMidY);
      ctx.quadraticCurveTo(p0.x, p0.y, currMidX, currMidY);
    } else {
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo((p0.x + p1.x) * 0.5, (p0.y + p1.y) * 0.5);
    }
    ctx.stroke();
  }

  // Complete terminal half-segment
  if (pts.length >= 2) {
    const penult = pts[pts.length - 2];
    const last = pts[pts.length - 1];
    ctx.lineWidth = computePointWidth(
      pts,
      pts.length - 1,
      stroke.width,
      stroke.instrument,
      stroke.pressureSensitivity,
      stroke.tipSharpness
    );
    ctx.beginPath();
    ctx.moveTo((penult.x + last.x) * 0.5, (penult.y + last.y) * 0.5);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  void cachedPencilPatternCanvas;
  ctx.restore();
}

/**
 * Renders geometric ShapeObject onto a 2D canvas context.
 */
export function renderShapeToCanvas(ctx: CanvasRenderingContext2D, shape: ShapeObject): void {
  ctx.save();
  ctx.strokeStyle = shape.strokeColor;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (shape.shapeType === 'line' || shape.shapeType === 'arrow') {
    const x1 = shape.x1 ?? shape.x;
    const y1 = shape.y1 ?? shape.y;
    const x2 = shape.x2 ?? shape.x + shape.width;
    const y2 = shape.y2 ?? shape.y + shape.height;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (shape.shapeType === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = Math.max(10, shape.strokeWidth * 4.2);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  ctx.translate(cx, cy);
  if (shape.rotation) {
    ctx.rotate((shape.rotation * Math.PI) / 180);
  }

  const hw = shape.width / 2;
  const hh = shape.height / 2;

  ctx.beginPath();
  if (shape.shapeType === 'rectangle') {
    ctx.rect(-hw, -hh, shape.width, shape.height);
  } else if (shape.shapeType === 'ellipse') {
    ctx.ellipse(0, 0, Math.abs(hw), Math.abs(hh), 0, 0, Math.PI * 2);
  } else if (shape.shapeType === 'triangle') {
    ctx.moveTo(0, -hh);
    ctx.lineTo(hw, hh);
    ctx.lineTo(-hw, hh);
    ctx.closePath();
  } else if (shape.shapeType === 'diamond') {
    ctx.moveTo(0, -hh);
    ctx.lineTo(hw, 0);
    ctx.lineTo(0, hh);
    ctx.lineTo(-hw, 0);
    ctx.closePath();
  }

  if (shape.fillOpacity > 0 && shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.save();
    ctx.globalAlpha = shape.fillOpacity;
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
    ctx.restore();
  }
  ctx.stroke();

  if (shape.label) {
    ctx.fillStyle = shape.strokeColor;
    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shape.label, 0, 0, Math.max(24, Math.abs(shape.width) - 12));
  }

  ctx.restore();
}

/**
 * Renders a Diagram ConnectorObject onto a 2D canvas context.
 */
export function renderConnectorToCanvas(
  ctx: CanvasRenderingContext2D,
  conn: ConnectorObject,
  page?: InkVaultPage
): void {
  let { x1, y1, x2, y2 } = conn;
  if (page && conn.fromObjectId) {
    const fromObj = findObjectOnPage(page, conn.fromObjectId);
    if (fromObj) {
      const b = getObjectBounds(fromObj);
      x1 = (b.minX + b.maxX) / 2;
      y1 = (b.minY + b.maxY) / 2;
    }
  }
  if (page && conn.toObjectId) {
    const toObj = findObjectOnPage(page, conn.toObjectId);
    if (toObj) {
      const b = getObjectBounds(toObj);
      x2 = (b.minX + b.maxX) / 2;
      y2 = (b.minY + b.maxY) / 2;
    }
  }

  ctx.save();
  ctx.strokeStyle = conn.strokeColor;
  ctx.lineWidth = conn.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  let endAngle = Math.atan2(y2 - y1, x2 - x1);

  if (conn.routing === 'elbow') {
    const midX = (x1 + x2) / 2;
    ctx.lineTo(midX, y1);
    ctx.lineTo(midX, y2);
    ctx.lineTo(x2, y2);
    endAngle = x2 >= midX ? 0 : Math.PI;
  } else if (conn.routing === 'curved') {
    const midX = (x1 + x2) / 2;
    ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
    endAngle = Math.atan2(y2 - y1, x2 - midX);
  } else {
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  if (conn.arrowEnd) {
    const headLen = Math.max(9, conn.strokeWidth * 4);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(endAngle - Math.PI / 6),
      y2 - headLen * Math.sin(endAngle - Math.PI / 6)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(endAngle + Math.PI / 6),
      y2 - headLen * Math.sin(endAngle + Math.PI / 6)
    );
    ctx.stroke();
  }

  if (conn.label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.fillStyle = '#FFFFFF';
    const w = conn.label.length * 7 + 10;
    ctx.fillRect(mx - w / 2, my - 10, w, 20);
    ctx.fillStyle = conn.strokeColor;
    ctx.font = '600 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(conn.label, mx, my);
  }

  ctx.restore();
}

/**
 * Renders Active Recall TapeObject onto a 2D canvas context.
 */
export function renderTapeToCanvas(ctx: CanvasRenderingContext2D, tape: TapeObject): void {
  ctx.save();
  ctx.strokeStyle = tape.color;
  ctx.lineWidth = tape.width;
  ctx.lineCap = 'butt';
  ctx.globalAlpha = tape.revealed ? 0.17 : 0.96;

  ctx.beginPath();
  ctx.moveTo(tape.x1, tape.y1);
  ctx.lineTo(tape.x2, tape.y2);
  ctx.stroke();

  // Subtle hatched study-tape indicator border so user knows it is interactive
  ctx.globalAlpha = tape.revealed ? 0.35 : 0.25;
  ctx.strokeStyle = '#18181B';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const angle = Math.atan2(tape.y2 - tape.y1, tape.x2 - tape.x1);
  const nx = (-Math.sin(angle) * tape.width) / 2;
  const ny = (Math.cos(angle) * tape.width) / 2;
  ctx.beginPath();
  ctx.moveTo(tape.x1 + nx, tape.y1 + ny);
  ctx.lineTo(tape.x2 + nx, tape.y2 + ny);
  ctx.moveTo(tape.x1 - nx, tape.y1 - ny);
  ctx.lineTo(tape.x2 - nx, tape.y2 - ny);
  ctx.stroke();
  ctx.restore();
}

// --- Geometry & Erasers ---

export function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function strokeAllowedByFilter(stroke: InkStroke, filter: EraserFilter): boolean {
  if (stroke.locked) return false;
  if (stroke.instrument === 'highlighter') return filter.highlighter;
  if (stroke.instrument === 'pencil') return filter.pencil;
  return filter.pen;
}

export function doesCircleHitStroke(
  cx: number,
  cy: number,
  radius: number,
  stroke: InkStroke
): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  const threshold = radius + stroke.width * 0.5;
  if (pts.length === 1) {
    return Math.hypot(cx - pts[0].x, cy - pts[0].y) <= threshold;
  }
  for (let i = 1; i < pts.length; i++) {
    if (
      distancePointToSegment(cx, cy, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <=
      threshold
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Stroke Eraser: removes entire unlocked strokes, shapes, or tape masks intersected by `(cx, cy, radius)`.
 */
export function applyStrokeEraser(
  page: InkVaultPage,
  cx: number,
  cy: number,
  radius: number,
  filter: EraserFilter
): { nextPage: InkVaultPage; changed: boolean } {
  const lockedLayers = new Set(page.layers.filter((l) => l.locked || !l.visible).map((l) => l.id));
  let changed = false;

  const strokes = page.strokes.filter((s) => {
    if (lockedLayers.has(s.layerId) || !strokeAllowedByFilter(s, filter)) return true;
    if (doesCircleHitStroke(cx, cy, radius, s)) {
      changed = true;
      return false;
    }
    return true;
  });

  const shapes = filter.shapes
    ? page.shapes.filter((sh) => {
        if (sh.locked || lockedLayers.has(sh.layerId)) return true;
        const b = getObjectBounds(sh);
        const hit =
          cx + radius >= b.minX &&
          cx - radius <= b.maxX &&
          cy + radius >= b.minY &&
          cy - radius <= b.maxY;
        if (hit) {
          changed = true;
          return false;
        }
        return true;
      })
    : page.shapes;

  const tapes = filter.tape
    ? page.tapes.filter((tp) => {
        if (tp.locked || lockedLayers.has(tp.layerId)) return true;
        const dist = distancePointToSegment(cx, cy, tp.x1, tp.y1, tp.x2, tp.y2);
        if (dist <= radius + tp.width * 0.5) {
          changed = true;
          return false;
        }
        return true;
      })
    : page.tapes;

  if (!changed) return { nextPage: page, changed: false };
  return {
    nextPage: {
      ...page,
      strokes,
      shapes,
      tapes,
      updatedAt: Date.now(),
    },
    changed: true,
  };
}

/**
 * Vector-Splitting Pixel Eraser:
 * Geometrically subdivides dense stroke segments and removes points inside the eraser circle,
 * splitting one vector stroke cleanly into 0, 1, or N independent editable vector sub-strokes.
 * Never flattens handwriting into bitmaps!
 */
export function applyPixelEraser(
  page: InkVaultPage,
  cx: number,
  cy: number,
  radius: number,
  filter: EraserFilter
): { nextPage: InkVaultPage; changed: boolean } {
  const lockedLayers = new Set(page.layers.filter((l) => l.locked || !l.visible).map((l) => l.id));
  let changed = false;
  const nextStrokes: InkStroke[] = [];

  for (const stroke of page.strokes) {
    if (
      lockedLayers.has(stroke.layerId) ||
      !strokeAllowedByFilter(stroke, filter) ||
      !doesCircleHitStroke(cx, cy, radius, stroke)
    ) {
      nextStrokes.push(stroke);
      continue;
    }

    changed = true;
    const threshold = radius + stroke.width * 0.35;
    // Densify segments near eraser so long straight segments split accurately at circle boundary
    const dense: InkPoint[] = [];
    for (let i = 0; i < stroke.points.length; i++) {
      const curr = stroke.points[i];
      if (i > 0) {
        const prev = stroke.points[i - 1];
        const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        const steps = Math.max(1, Math.ceil(segLen / 4));
        for (let s = 1; s < steps; s++) {
          const frac = s / steps;
          dense.push({
            x: prev.x + (curr.x - prev.x) * frac,
            y: prev.y + (curr.y - prev.y) * frac,
            p: prev.p + (curr.p - prev.p) * frac,
            tx: curr.tx,
            ty: curr.ty,
            t: prev.t + (curr.t - prev.t) * frac,
          });
        }
      }
      dense.push(curr);
    }

    let currentRun: InkPoint[] = [];
    const runs: InkPoint[][] = [];
    for (const pt of dense) {
      const inside = Math.hypot(pt.x - cx, pt.y - cy) <= threshold;
      if (inside) {
        if (currentRun.length >= 2) {
          runs.push(currentRun);
        }
        currentRun = [];
      } else {
        currentRun.push(pt);
      }
    }
    if (currentRun.length >= 2) {
      runs.push(currentRun);
    }

    runs.forEach((pts, idx) => {
      nextStrokes.push({
        ...stroke,
        id: idx === 0 ? stroke.id : createId('stk'),
        points: pts,
        updatedAt: Date.now(),
      });
    });
  }

  if (!changed) return { nextPage: page, changed: false };
  return {
    nextPage: {
      ...page,
      strokes: nextStrokes,
      updatedAt: Date.now(),
    },
    changed: true,
  };
}

// --- Shape Recognition (Draw-and-Hold & Shape Tool) ---

function rdpSimplify(points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = distancePointToSegment(points[i].x, points[i].y, first.x, first.y, last.x, last.y);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, index + 1), epsilon);
    const right = rdpSimplify(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

/**
 * Recognizes hand-drawn geometric primitives (`line`, `arrow`, `rectangle`, `ellipse`, `triangle`, `diamond`)
 * from a freehand `InkPoint[]` stroke.
 */
export function recognizeShapeFromPoints(
  points: InkPoint[],
  layerId: string,
  zIndex: number,
  color: string,
  strokeWidth: number
): ShapeObject | null {
  if (points.length < 4) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pathLength = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      pathLength += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const diag = Math.hypot(width, height);
  if (diag < 18) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const endToEnd = Math.hypot(last.x - first.x, last.y - first.y);

  // Straight line test
  if (endToEnd / Math.max(1, pathLength) > 0.91) {
    const now = Date.now();
    return {
      id: createId('shp'),
      kind: 'shape',
      shapeType: 'line',
      layerId,
      zIndex,
      x: Math.min(first.x, last.x),
      y: Math.min(first.y, last.y),
      width: Math.abs(last.x - first.x),
      height: Math.abs(last.y - first.y),
      x1: first.x,
      y1: first.y,
      x2: last.x,
      y2: last.y,
      rotation: 0,
      strokeColor: color,
      fillColor: 'transparent',
      fillOpacity: 0,
      strokeWidth,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Closed shape check
  const isClosed = endToEnd < diag * 0.36;
  if (!isClosed) return null;

  // Check radial variance for ellipse/circle vs polygonal corners
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(8, width / 2);
  const ry = Math.max(8, height / 2);
  let normalizedRadialError = 0;
  for (const p of points) {
    const normDist = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
    normalizedRadialError += Math.abs(normDist - 1);
  }
  normalizedRadialError /= points.length;

  const simplified = rdpSimplify(points, diag * 0.065);
  // Closed RDP path has start & end near same vertex, so unique vertices ~ simplified.length - 1
  const vertexCount = Math.max(2, simplified.length - 1);

  let shapeType: ShapeKind = 'rectangle';
  if (normalizedRadialError < 0.14 && vertexCount >= 5) {
    shapeType = 'ellipse';
  } else if (vertexCount === 3) {
    shapeType = 'triangle';
  } else if (vertexCount === 4) {
    // Distinguish axis-aligned rectangle vs 45-degree diamond
    const cornerDistToMidEdges = simplified.slice(0, 4).reduce((acc, v) => {
      const dTop = Math.hypot(v.x - cx, v.y - minY);
      const dBot = Math.hypot(v.x - cx, v.y - maxY);
      const dLeft = Math.hypot(v.x - minX, v.y - cy);
      const dRight = Math.hypot(v.x - maxX, v.y - cy);
      return acc + Math.min(dTop, dBot, dLeft, dRight);
    }, 0);
    shapeType = cornerDistToMidEdges / 4 < diag * 0.14 ? 'diamond' : 'rectangle';
  } else {
    shapeType = normalizedRadialError < 0.22 ? 'ellipse' : 'rectangle';
  }

  const now = Date.now();
  return {
    id: createId('shp'),
    kind: 'shape',
    shapeType,
    layerId,
    zIndex,
    x: minX,
    y: minY,
    width: Math.max(16, width),
    height: Math.max(16, height),
    rotation: 0,
    strokeColor: color,
    fillColor: color,
    fillOpacity: 0.06,
    strokeWidth,
    createdAt: now,
    updatedAt: now,
  };
}

// --- Ruler Edge Projection ---

export function projectPointOntoRulerIfNear(
  x: number,
  y: number,
  ruler: RulerState,
  snapTolerance = 26
): { x: number; y: number; snapped: boolean } {
  if (!ruler.visible) return { x, y, snapped: false };
  const rad = (ruler.angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Transform point into ruler-local coordinates
  const dx = x - ruler.x;
  const dy = y - ruler.y;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;

  const halfLen = ruler.length / 2;
  const halfThick = ruler.thickness / 2;
  if (Math.abs(localX) > halfLen + 20) {
    return { x, y, snapped: false };
  }

  const distTop = Math.abs(localY + halfThick);
  const distBottom = Math.abs(localY - halfThick);

  if (distTop <= snapTolerance && distTop <= distBottom) {
    const targetLocalY = -halfThick - 1;
    return {
      x: ruler.x + localX * cos - targetLocalY * sin,
      y: ruler.y + localX * sin + targetLocalY * cos,
      snapped: true,
    };
  }
  if (distBottom <= snapTolerance) {
    const targetLocalY = halfThick + 1;
    return {
      x: ruler.x + localX * cos - targetLocalY * sin,
      y: ruler.y + localX * sin + targetLocalY * cos,
      snapped: true,
    };
  }
  return { x, y, snapped: false };
}

// --- Object Bounds, Lasso Selection & Transform ---

export function getObjectBounds(obj: EditablePageObject): BoundingBox {
  switch (obj.kind) {
    case 'stroke': {
      if (obj.points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const pad = obj.width * 0.5;
      for (const p of obj.points) {
        if (p.x - pad < minX) minX = p.x - pad;
        if (p.y - pad < minY) minY = p.y - pad;
        if (p.x + pad > maxX) maxX = p.x + pad;
        if (p.y + pad > maxY) maxY = p.y + pad;
      }
      return { minX, minY, maxX, maxY };
    }
    case 'shape': {
      if (obj.shapeType === 'line' || obj.shapeType === 'arrow') {
        const x1 = obj.x1 ?? obj.x;
        const y1 = obj.y1 ?? obj.y;
        const x2 = obj.x2 ?? obj.x + obj.width;
        const y2 = obj.y2 ?? obj.y + obj.height;
        return {
          minX: Math.min(x1, x2) - 4,
          minY: Math.min(y1, y2) - 4,
          maxX: Math.max(x1, x2) + 4,
          maxY: Math.max(y1, y2) + 4,
        };
      }
      return {
        minX: Math.min(obj.x, obj.x + obj.width),
        minY: Math.min(obj.y, obj.y + obj.height),
        maxX: Math.max(obj.x, obj.x + obj.width),
        maxY: Math.max(obj.y, obj.y + obj.height),
      };
    }
    case 'connector':
      return {
        minX: Math.min(obj.x1, obj.x2) - 4,
        minY: Math.min(obj.y1, obj.y2) - 4,
        maxX: Math.max(obj.x1, obj.x2) + 4,
        maxY: Math.max(obj.y1, obj.y2) + 4,
      };
    case 'textbox':
    case 'image':
    case 'sticker':
      return {
        minX: obj.x,
        minY: obj.y,
        maxX: obj.x + obj.width,
        maxY: obj.y + obj.height,
      };
    case 'tape': {
      const pad = obj.width * 0.5;
      return {
        minX: Math.min(obj.x1, obj.x2) - pad,
        minY: Math.min(obj.y1, obj.y2) - pad,
        maxX: Math.max(obj.x1, obj.x2) + pad,
        maxY: Math.max(obj.y1, obj.y2) + pad,
      };
    }
  }
}

export function getCombinedBounds(objects: EditablePageObject[]): BoundingBox | null {
  if (objects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const obj of objects) {
    const b = getObjectBounds(obj);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return { minX, minY, maxX, maxY };
}

export function isPointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function selectObjectsWithLasso(
  page: InkVaultPage,
  lassoPoints: { x: number; y: number }[],
  mode: 'freehand' | 'rectangle',
  filter: LassoFilter
): string[] {
  if (lassoPoints.length < 2) return [];
  const hiddenOrLockedLayers = new Set(
    page.layers.filter((l) => !l.visible || l.locked).map((l) => l.id)
  );

  let rectBounds: BoundingBox | null = null;
  if (mode === 'rectangle') {
    const first = lassoPoints[0];
    const last = lassoPoints[lassoPoints.length - 1];
    rectBounds = {
      minX: Math.min(first.x, last.x),
      minY: Math.min(first.y, last.y),
      maxX: Math.max(first.x, last.x),
      maxY: Math.max(first.y, last.y),
    };
  }

  const hitsObject = (obj: EditablePageObject): boolean => {
    if (hiddenOrLockedLayers.has(obj.layerId)) return false;
    if (obj.kind === 'stroke' && !filter.strokes) return false;
    if ((obj.kind === 'shape' || obj.kind === 'connector') && !filter.shapes) return false;
    if (obj.kind === 'textbox' && !filter.textBoxes) return false;
    if (obj.kind === 'image' && !filter.images) return false;
    if (obj.kind === 'sticker' && !filter.stickers) return false;
    if (obj.kind === 'tape' && !filter.tapes) return false;

    const b = getObjectBounds(obj);
    if (rectBounds) {
      return !(
        b.maxX < rectBounds.minX ||
        b.minX > rectBounds.maxX ||
        b.maxY < rectBounds.minY ||
        b.minY > rectBounds.maxY
      );
    }

    if (obj.kind === 'stroke') {
      // Selected if any sample point lies inside polygon
      return obj.points.some((pt) => isPointInPolygon(pt.x, pt.y, lassoPoints));
    }

    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    return (
      isPointInPolygon(cx, cy, lassoPoints) ||
      isPointInPolygon(b.minX, b.minY, lassoPoints) ||
      isPointInPolygon(b.maxX, b.maxY, lassoPoints)
    );
  };

  const candidates: EditablePageObject[] = [
    ...page.strokes,
    ...page.shapes,
    ...page.connectors,
    ...page.textBoxes,
    ...page.images,
    ...page.stickers,
    ...page.tapes,
  ];

  const initialMatched = candidates.filter(hitsObject);
  // Expand selection automatically to include grouped siblings (`groupId`)
  const matchedGroupIds = new Set(
    initialMatched.map((o) => o.groupId).filter((g): g is string => Boolean(g))
  );

  const finalIds = new Set(initialMatched.map((o) => o.id));
  if (matchedGroupIds.size > 0) {
    for (const c of candidates) {
      if (c.groupId && matchedGroupIds.has(c.groupId)) {
        finalIds.add(c.id);
      }
    }
  }
  return Array.from(finalIds);
}

export function findObjectOnPage(page: InkVaultPage, id: string): EditablePageObject | undefined {
  return (
    page.strokes.find((x) => x.id === id) ||
    page.shapes.find((x) => x.id === id) ||
    page.connectors.find((x) => x.id === id) ||
    page.textBoxes.find((x) => x.id === id) ||
    page.images.find((x) => x.id === id) ||
    page.stickers.find((x) => x.id === id) ||
    page.tapes.find((x) => x.id === id)
  );
}

export function getSelectedObjectsOnPage(
  page: InkVaultPage,
  selectedIds: string[]
): EditablePageObject[] {
  const set = new Set(selectedIds);
  return [
    ...page.strokes,
    ...page.shapes,
    ...page.connectors,
    ...page.textBoxes,
    ...page.images,
    ...page.stickers,
    ...page.tapes,
  ].filter((o) => set.has(o.id));
}

export interface TransformParams {
  dx?: number;
  dy?: number;
  scaleX?: number;
  scaleY?: number;
  anchorX?: number;
  anchorY?: number;
  rotateDeg?: number;
  keepStrokeWidth?: boolean;
}

/**
 * Applies translation, scaling, and/or rotation to all unlocked selected objects on a page.
 */
export function transformPageObjects(
  page: InkVaultPage,
  objectIds: string[],
  params: TransformParams
): InkVaultPage {
  const idSet = new Set(objectIds);
  const dx = params.dx ?? 0;
  const dy = params.dy ?? 0;
  const sx = params.scaleX ?? 1;
  const sy = params.scaleY ?? 1;
  const ax = params.anchorX ?? 0;
  const ay = params.anchorY ?? 0;
  const rotRad = ((params.rotateDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  const xformPt = (x: number, y: number) => {
    let nx = ax + (x - ax) * sx;
    let ny = ay + (y - ay) * sy;
    if (rotRad !== 0) {
      const rx = nx - ax;
      const ry = ny - ay;
      nx = ax + rx * cos - ry * sin;
      ny = ay + rx * sin + ry * cos;
    }
    return { x: nx + dx, y: ny + dy };
  };

  const avgScale = (Math.abs(sx) + Math.abs(sy)) * 0.5;
  const now = Date.now();

  const strokes = page.strokes.map((s): InkStroke => {
    if (!idSet.has(s.id) || s.locked) return s;
    return {
      ...s,
      width: params.keepStrokeWidth ? s.width : Math.max(0.5, s.width * avgScale),
      points: s.points.map((pt) => {
        const np = xformPt(pt.x, pt.y);
        return { ...pt, x: np.x, y: np.y };
      }),
      updatedAt: now,
    };
  });

  const shapes = page.shapes.map((sh): ShapeObject => {
    if (!idSet.has(sh.id) || sh.locked) return sh;
    if (sh.shapeType === 'line' || sh.shapeType === 'arrow') {
      const p1 = xformPt(sh.x1 ?? sh.x, sh.y1 ?? sh.y);
      const p2 = xformPt(sh.x2 ?? sh.x + sh.width, sh.y2 ?? sh.y + sh.height);
      return {
        ...sh,
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        width: Math.abs(p2.x - p1.x),
        height: Math.abs(p2.y - p1.y),
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        updatedAt: now,
      };
    }
    const center = xformPt(sh.x + sh.width / 2, sh.y + sh.height / 2);
    const nw = Math.max(10, sh.width * Math.abs(sx));
    const nh = Math.max(10, sh.height * Math.abs(sy));
    return {
      ...sh,
      x: center.x - nw / 2,
      y: center.y - nh / 2,
      width: nw,
      height: nh,
      rotation: sh.rotation + (params.rotateDeg ?? 0),
      strokeWidth: params.keepStrokeWidth ? sh.strokeWidth : Math.max(0.75, sh.strokeWidth * avgScale),
      updatedAt: now,
    };
  });

  const connectors = page.connectors.map((c): ConnectorObject => {
    if (!idSet.has(c.id) || c.locked) return c;
    const p1 = xformPt(c.x1, c.y1);
    const p2 = xformPt(c.x2, c.y2);
    return { ...c, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, updatedAt: now };
  });

  const textBoxes = page.textBoxes.map((tb): TextBoxObject => {
    if (!idSet.has(tb.id) || tb.locked) return tb;
    const center = xformPt(tb.x + tb.width / 2, tb.y + tb.height / 2);
    const nw = Math.max(48, tb.width * Math.abs(sx));
    const nh = Math.max(24, tb.height * Math.abs(sy));
    return {
      ...tb,
      x: center.x - nw / 2,
      y: center.y - nh / 2,
      width: nw,
      height: nh,
      rotation: tb.rotation + (params.rotateDeg ?? 0),
      updatedAt: now,
    };
  });

  const images = page.images.map((im): ImageObject => {
    if (!idSet.has(im.id) || im.locked) return im;
    const center = xformPt(im.x + im.width / 2, im.y + im.height / 2);
    const nw = Math.max(24, im.width * Math.abs(sx));
    const nh = Math.max(24, im.height * Math.abs(sy));
    return {
      ...im,
      x: center.x - nw / 2,
      y: center.y - nh / 2,
      width: nw,
      height: nh,
      rotation: im.rotation + (params.rotateDeg ?? 0),
      updatedAt: now,
    };
  });

  const stickers = page.stickers.map((st): StickerObject => {
    if (!idSet.has(st.id) || st.locked) return st;
    const center = xformPt(st.x + st.width / 2, st.y + st.height / 2);
    const nw = Math.max(20, st.width * Math.abs(sx));
    const nh = Math.max(20, st.height * Math.abs(sy));
    return {
      ...st,
      x: center.x - nw / 2,
      y: center.y - nh / 2,
      width: nw,
      height: nh,
      rotation: st.rotation + (params.rotateDeg ?? 0),
      updatedAt: now,
    };
  });

  const tapes = page.tapes.map((tp): TapeObject => {
    if (!idSet.has(tp.id) || tp.locked) return tp;
    const p1 = xformPt(tp.x1, tp.y1);
    const p2 = xformPt(tp.x2, tp.y2);
    return { ...tp, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, updatedAt: now };
  });

  return {
    ...page,
    strokes,
    shapes,
    connectors,
    textBoxes,
    images,
    stickers,
    tapes,
    updatedAt: now,
  };
}

/**
 * Clones selected objects onto a target page with fresh persistent IDs and subtle offset.
 */
export function pasteObjectsOntoPage(
  page: InkVaultPage,
  clipboardObjects: EditablePageObject[],
  offsetX = 18,
  offsetY = 18
): { nextPage: InkVaultPage; newIds: string[] } {
  const defaultLayerId = page.layers[0]?.id ?? createId('lyr');
  let z = getNextZIndex(page);
  const now = Date.now();
  const groupMap = new Map<string, string>();
  const mapGroup = (g?: string) => {
    if (!g) return undefined;
    if (!groupMap.has(g)) groupMap.set(g, createId('grp'));
    return groupMap.get(g);
  };

  const newIds: string[] = [];
  const nextPage: InkVaultPage = {
    ...page,
    strokes: [...page.strokes],
    shapes: [...page.shapes],
    connectors: [...page.connectors],
    textBoxes: [...page.textBoxes],
    images: [...page.images],
    stickers: [...page.stickers],
    tapes: [...page.tapes],
    updatedAt: now,
  };

  for (const raw of clipboardObjects) {
    const obj = structuredClone(raw);
    const validLayer = page.layers.some((l) => l.id === obj.layerId) ? obj.layerId : defaultLayerId;
    const groupId = mapGroup(obj.groupId);

    switch (obj.kind) {
      case 'stroke': {
        const id = createId('stk');
        newIds.push(id);
        nextPage.strokes.push({
          ...obj,
          id,
          layerId: validLayer,
          groupId,
          zIndex: z++,
          points: obj.points.map((p) => ({ ...p, x: p.x + offsetX, y: p.y + offsetY })),
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
      case 'shape': {
        const id = createId('shp');
        newIds.push(id);
        nextPage.shapes.push({
          ...obj,
          id,
          layerId: validLayer,
          groupId,
          zIndex: z++,
          x: obj.x + offsetX,
          y: obj.y + offsetY,
          x1: obj.x1 !== undefined ? obj.x1 + offsetX : undefined,
          y1: obj.y1 !== undefined ? obj.y1 + offsetY : undefined,
          x2: obj.x2 !== undefined ? obj.x2 + offsetX : undefined,
          y2: obj.y2 !== undefined ? obj.y2 + offsetY : undefined,
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
      case 'connector': {
        const id = createId('con');
        newIds.push(id);
        nextPage.connectors.push({
          ...obj,
          id,
          layerId: validLayer,
          groupId,
          zIndex: z++,
          x1: obj.x1 + offsetX,
          y1: obj.y1 + offsetY,
          x2: obj.x2 + offsetX,
          y2: obj.y2 + offsetY,
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
      case 'textbox': {
        const id = createId('txt');
        newIds.push(id);
        nextPage.textBoxes.push({
          ...obj,
          id,
          layerId: validLayer,
          groupId,
          zIndex: z++,
          x: obj.x + offsetX,
          y: obj.y + offsetY,
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
      case 'image': {
        const id = createId('img');
        newIds.push(id);
        nextPage.images.push({
          ...obj,
          id,
          layerId: validLayer,
          groupId,
          zIndex: z++,
          x: obj.x + offsetX,
          y: obj.y + offsetY,
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
      case 'sticker': {
        const id = createId('el');
        newIds.push(id);
        nextPage.stickers.push({
          ...obj,
          id,
          layerId: validLayer,
          groupId,
          zIndex: z++,
          x: obj.x + offsetX,
          y: obj.y + offsetY,
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
      case 'tape': {
        const id = createId('tap');
        newIds.push(id);
        nextPage.tapes.push({
          ...obj,
          id,
          layerId: validLayer,
          groupId,
          zIndex: z++,
          x1: obj.x1 + offsetX,
          y1: obj.y1 + offsetY,
          x2: obj.x2 + offsetX,
          y2: obj.y2 + offsetY,
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
    }
  }

  return { nextPage, newIds };
}

/**
 * Computes live magnetic Alignment Guides (page center, margins, and sibling object edges/centers)
 * when dragging selected objects.
 */
export function computeAlignmentGuides(
  page: InkVaultPage,
  movingBounds: BoundingBox,
  excludedIds: Set<string>,
  snapDistance = 6
): { guides: AlignmentGuide[]; snapDx: number; snapDy: number } {
  const guides: AlignmentGuide[] = [];
  let snapDx = 0;
  let snapDy = 0;

  const movingCx = (movingBounds.minX + movingBounds.maxX) / 2;
  const movingCy = (movingBounds.minY + movingBounds.maxY) / 2;

  const verticalTargets: { x: number; label?: string }[] = [
    { x: page.width / 2, label: 'Center' },
    { x: 74, label: 'Margin' },
    { x: page.width - 74 },
  ];
  const horizontalTargets: { y: number; label?: string }[] = [
    { y: page.height / 2, label: 'Middle' },
    { y: 68 },
  ];

  const others = [
    ...page.shapes,
    ...page.textBoxes,
    ...page.images,
    ...page.stickers,
  ].filter((o) => !excludedIds.has(o.id));

  for (const o of others) {
    const b = getObjectBounds(o);
    verticalTargets.push({ x: b.minX }, { x: (b.minX + b.maxX) / 2 }, { x: b.maxX });
    horizontalTargets.push({ y: b.minY }, { y: (b.minY + b.maxY) / 2 }, { y: b.maxY });
  }

  for (const vt of verticalTargets) {
    if (Math.abs(movingCx - vt.x) <= snapDistance) {
      snapDx = vt.x - movingCx;
      guides.push({ orientation: 'vertical', position: vt.x, label: vt.label });
      break;
    }
    if (Math.abs(movingBounds.minX - vt.x) <= snapDistance) {
      snapDx = vt.x - movingBounds.minX;
      guides.push({ orientation: 'vertical', position: vt.x, label: vt.label });
      break;
    }
  }

  for (const ht of horizontalTargets) {
    if (Math.abs(movingCy - ht.y) <= snapDistance) {
      snapDy = ht.y - movingCy;
      guides.push({ orientation: 'horizontal', position: ht.y, label: ht.label });
      break;
    }
    if (Math.abs(movingBounds.minY - ht.y) <= snapDistance) {
      snapDy = ht.y - movingBounds.minY;
      guides.push({ orientation: 'horizontal', position: ht.y, label: ht.label });
      break;
    }
  }

  return { guides, snapDx, snapDy };
}
