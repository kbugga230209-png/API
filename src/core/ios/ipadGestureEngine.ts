export interface TouchSample {
  pointerId: number;
  pointerType: 'pen' | 'touch' | 'mouse' | string;
  clientX: number;
  clientY: number;
  timestampMs: number;
}

export interface IPadGestureCallbacks {
  onPinchAndPan?: (params: {
    scaleFactor: number;
    targetZoom: number;
    panDeltaX: number;
    panDeltaY: number;
    focalClientX: number;
    focalClientY: number;
  }) => void;
  onTwoFingerTapUndo?: () => void;
  onThreeFingerTapRedo?: () => void;
  onPageSwipe?: (direction: 'next' | 'prev') => void;
  onLongPressContextMenu?: (pos: { clientX: number; clientY: number }) => void;
}

interface TrackedTouch {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  downAtMs: number;
  maxMovePx: number;
}

const PALM_REJECTION_COOLDOWN_MS = 320;
const MULTI_TAP_MAX_DURATION_MS = 275;
const TWO_FINGER_TAP_SLOP_PX = 14;
const THREE_FINGER_TAP_SLOP_PX = 16;
const MIN_PINCH_SPAN_PX = 24;

/**
 * Conflict-free iPadOS Multi-Touch & Apple Pencil Gesture Recognizer.
 *
 * Guarantees:
 * - Active Apple Pencil contact (`pointerType === 'pen'`) immediately suppresses all finger gestures
 *   (no accidental palm Undo, pinch, or pan while writing).
 * - Supports 2-finger pinch-to-zoom, 2-finger pan, 2-finger tap Undo, 3-finger tap Redo,
 *   and single-finger page swipe (when stylus-only or read-only mode is active).
 */
export class IPadGestureRecognizer {
  private callbacks: IPadGestureCallbacks;
  private activeTouches = new Map<number, TrackedTouch>();
  private activePenIds = new Set<number>();
  private lastPenLiftAtMs = -10_000;

  // Cluster tracking for 2-finger / 3-finger quick taps
  private clusterPeakTouchCount = 0;
  private clusterFirstDownMs = 0;
  private clusterMaxMovePx = 0;
  private clusterCancelledByPen = false;
  private clusterPinchedOrPanned = false;

  // Pinch / Pan baseline
  private initialPinchDistance: number | null = null;
  private initialZoom = 1;
  private lastMidpoint: { x: number; y: number } | null = null;

  // Long press timer
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: IPadGestureCallbacks) {
    this.callbacks = callbacks;
  }

  public updateCallbacks(callbacks: IPadGestureCallbacks): void {
    this.callbacks = callbacks;
  }

  public isStylusCurrentlyActive(nowMs = performance.now()): boolean {
    if (this.activePenIds.size > 0) return true;
    return nowMs - this.lastPenLiftAtMs < PALM_REJECTION_COOLDOWN_MS;
  }

  public getActiveTouchCount(): number {
    return this.activeTouches.size;
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  public onPointerDown(
    sample: TouchSample,
    currentZoom: number,
    allowSingleFingerSwipeAndLongPress = false
  ): void {
    if (sample.pointerType === 'pen') {
      this.activePenIds.add(sample.pointerId);
      this.clusterCancelledByPen = true;
      this.clearLongPressTimer();
      // Purge any resting palm touches captured right before the stylus tip landed
      this.activeTouches.clear();
      this.initialPinchDistance = null;
      this.lastMidpoint = null;
      return;
    }

    if (sample.pointerType !== 'touch') {
      return;
    }

    // Reject palm contact during active Apple Pencil writing or cooldown window
    if (this.isStylusCurrentlyActive(sample.timestampMs)) {
      this.clusterCancelledByPen = true;
      return;
    }

    if (this.activeTouches.size === 0) {
      this.clusterPeakTouchCount = 0;
      this.clusterFirstDownMs = sample.timestampMs;
      this.clusterMaxMovePx = 0;
      this.clusterCancelledByPen = false;
      this.clusterPinchedOrPanned = false;
    }

    this.activeTouches.set(sample.pointerId, {
      pointerId: sample.pointerId,
      startX: sample.clientX,
      startY: sample.clientY,
      currentX: sample.clientX,
      currentY: sample.clientY,
      downAtMs: sample.timestampMs,
      maxMovePx: 0,
    });

    this.clusterPeakTouchCount = Math.max(
      this.clusterPeakTouchCount,
      this.activeTouches.size
    );

    if (this.activeTouches.size === 1 && allowSingleFingerSwipeAndLongPress) {
      this.clearLongPressTimer();
      const startX = sample.clientX;
      const startY = sample.clientY;
      const pid = sample.pointerId;
      this.longPressTimer = setTimeout(() => {
        const tracked = this.activeTouches.get(pid);
        if (
          tracked &&
          this.activeTouches.size === 1 &&
          !this.isStylusCurrentlyActive() &&
          tracked.maxMovePx <= 10
        ) {
          this.clusterPinchedOrPanned = true;
          this.callbacks.onLongPressContextMenu?.({
            clientX: startX,
            clientY: startY,
          });
        }
      }, 480);
    } else {
      this.clearLongPressTimer();
    }

    if (this.activeTouches.size === 2) {
      const [t1, t2] = Array.from(this.activeTouches.values());
      const dist = Math.hypot(t2.currentX - t1.currentX, t2.currentY - t1.currentY);
      this.initialPinchDistance = Math.max(MIN_PINCH_SPAN_PX, dist);
      this.initialZoom = currentZoom;
      this.lastMidpoint = {
        x: (t1.currentX + t2.currentX) / 2,
        y: (t1.currentY + t2.currentY) / 2,
      };
    } else if (this.activeTouches.size > 2) {
      this.initialPinchDistance = null;
      this.lastMidpoint = null;
    }
  }

  public onPointerMove(sample: TouchSample): void {
    if (sample.pointerType === 'pen') {
      return;
    }
    if (sample.pointerType !== 'touch') {
      return;
    }
    const tracked = this.activeTouches.get(sample.pointerId);
    if (!tracked) return;

    if (this.isStylusCurrentlyActive(sample.timestampMs)) {
      this.activeTouches.delete(sample.pointerId);
      this.clearLongPressTimer();
      return;
    }

    tracked.currentX = sample.clientX;
    tracked.currentY = sample.clientY;
    const moved = Math.hypot(sample.clientX - tracked.startX, sample.clientY - tracked.startY);
    tracked.maxMovePx = Math.max(tracked.maxMovePx, moved);
    this.clusterMaxMovePx = Math.max(this.clusterMaxMovePx, tracked.maxMovePx);

    if (moved > 10) {
      this.clearLongPressTimer();
    }

    // 2-Finger Simultaneous Pinch-to-Zoom & Pan
    if (
      this.activeTouches.size === 2 &&
      this.initialPinchDistance !== null &&
      this.lastMidpoint !== null
    ) {
      const [t1, t2] = Array.from(this.activeTouches.values());
      const currentDist = Math.max(
        MIN_PINCH_SPAN_PX,
        Math.hypot(t2.currentX - t1.currentX, t2.currentY - t1.currentY)
      );
      const midX = (t1.currentX + t2.currentX) / 2;
      const midY = (t1.currentY + t2.currentY) / 2;
      const scaleFactor = currentDist / this.initialPinchDistance;
      const panDeltaX = midX - this.lastMidpoint.x;
      const panDeltaY = midY - this.lastMidpoint.y;

      if (Math.abs(scaleFactor - 1) > 0.035 || Math.hypot(panDeltaX, panDeltaY) > 6) {
        this.clusterPinchedOrPanned = true;
        const targetZoom = Number(
          Math.max(0.4, Math.min(3.5, this.initialZoom * scaleFactor)).toFixed(3)
        );
        this.callbacks.onPinchAndPan?.({
          scaleFactor,
          targetZoom,
          panDeltaX,
          panDeltaY,
          focalClientX: midX,
          focalClientY: midY,
        });
        this.lastMidpoint = { x: midX, y: midY };
      }
    }
  }

  public onPointerUpOrCancel(
    sample: TouchSample,
    allowSingleFingerSwipe = false
  ): void {
    this.clearLongPressTimer();

    if (sample.pointerType === 'pen') {
      this.activePenIds.delete(sample.pointerId);
      this.lastPenLiftAtMs = sample.timestampMs;
      return;
    }

    if (sample.pointerType !== 'touch') {
      return;
    }

    const lifted = this.activeTouches.get(sample.pointerId);
    this.activeTouches.delete(sample.pointerId);

    if (this.activeTouches.size < 2) {
      this.initialPinchDistance = null;
      this.lastMidpoint = null;
    }

    // Evaluate multi-finger tap or single-finger swipe once all touches in the cluster lift
    if (this.activeTouches.size === 0 && !this.clusterCancelledByPen) {
      const totalDuration = sample.timestampMs - this.clusterFirstDownMs;

      if (
        this.clusterPeakTouchCount === 2 &&
        !this.clusterPinchedOrPanned &&
        totalDuration <= MULTI_TAP_MAX_DURATION_MS &&
        this.clusterMaxMovePx <= TWO_FINGER_TAP_SLOP_PX
      ) {
        this.callbacks.onTwoFingerTapUndo?.();
        return;
      }

      if (
        this.clusterPeakTouchCount === 3 &&
        !this.clusterPinchedOrPanned &&
        totalDuration <= MULTI_TAP_MAX_DURATION_MS + 25 &&
        this.clusterMaxMovePx <= THREE_FINGER_TAP_SLOP_PX
      ) {
        this.callbacks.onThreeFingerTapRedo?.();
        return;
      }

      if (
        allowSingleFingerSwipe &&
        this.clusterPeakTouchCount === 1 &&
        lifted &&
        totalDuration <= 420
      ) {
        const dx = sample.clientX - lifted.startX;
        const dy = sample.clientY - lifted.startY;
        if (Math.abs(dx) >= 72 && Math.abs(dx) > Math.abs(dy) * 2.1) {
          this.callbacks.onPageSwipe?.(dx < 0 ? 'next' : 'prev');
        }
      }
    }
  }

  public reset(): void {
    this.clearLongPressTimer();
    this.activeTouches.clear();
    this.activePenIds.clear();
    this.initialPinchDistance = null;
    this.lastMidpoint = null;
  }
}
