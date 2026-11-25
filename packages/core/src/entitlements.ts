import type { EntitlementStatus } from './types.js';

export interface Entitlement {
  status: EntitlementStatus;
  planCode: 'free' | 'plus_monthly' | 'plus_annual';
  /** ISO timestamp when the paid period ends. Null for free. */
  currentPeriodEnd: string | null;
  /** ISO timestamp until which access continues after a failed renewal. */
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
}

export const GRACE_PERIOD_DAYS = 3;

export const PLUS_PLANS = {
  plus_monthly: { priceInr: 49, periodDays: 30, razorpayPlanEnvKey: 'RAZORPAY_PLAN_MONTHLY_ID' },
  plus_annual: { priceInr: 399, periodDays: 365, razorpayPlanEnvKey: 'RAZORPAY_PLAN_ANNUAL_ID' },
} as const;

export function freeEntitlement(now = new Date()): Entitlement {
  return {
    status: 'free',
    planCode: 'free',
    currentPeriodEnd: null,
    graceUntil: null,
    cancelAtPeriodEnd: false,
    updatedAt: now.toISOString(),
  };
}

function parse(value: string | null): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

/**
 * The single source of truth for "does this user have Plus right now".
 *
 * Rules:
 * - `active` grants access until `currentPeriodEnd`.
 * - `cancelled` keeps access until `currentPeriodEnd` (already-paid time is never clawed back).
 * - `past_due` grants access until `graceUntil` (default 3 days after period end).
 * - `pending` grants nothing — a checkout that has not been captured is not a purchase.
 * - `refunded` / `expired` / `free` grant nothing.
 */
export function isPlusActive(entitlement: Entitlement | null | undefined, now = new Date()): boolean {
  if (!entitlement) return false;
  if (entitlement.planCode === 'free') return false;
  const nowTs = now.getTime();
  const periodEnd = parse(entitlement.currentPeriodEnd);
  const graceEnd = parse(entitlement.graceUntil);

  switch (entitlement.status) {
    case 'active':
    case 'cancelled':
      return periodEnd !== null && nowTs < periodEnd;
    case 'past_due':
      return (graceEnd ?? periodEnd) !== null && nowTs < (graceEnd ?? periodEnd ?? 0);
    case 'free':
    case 'pending':
    case 'expired':
    case 'refunded':
      return false;
    default:
      return false;
  }
}

export function graceUntilFrom(periodEnd: Date, days = GRACE_PERIOD_DAYS): string {
  return new Date(periodEnd.getTime() + days * 86_400_000).toISOString();
}

export interface EntitlementTransitionInput {
  status: EntitlementStatus;
  planCode: Entitlement['planCode'];
  currentPeriodEnd?: string | null;
  graceUntil?: string | null;
  cancelAtPeriodEnd?: boolean;
}

const ALLOWED: Record<EntitlementStatus, readonly EntitlementStatus[]> = {
  free: ['pending', 'active', 'free'],
  pending: ['active', 'free', 'expired', 'pending'],
  active: ['active', 'past_due', 'cancelled', 'expired', 'refunded'],
  past_due: ['active', 'expired', 'cancelled', 'refunded'],
  cancelled: ['expired', 'active', 'refunded'],
  expired: ['active', 'pending', 'expired', 'free'],
  refunded: ['free', 'active', 'pending'],
};

export function canTransition(from: EntitlementStatus, to: EntitlementStatus): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * Pure reducer used by both the Edge Function and tests. Returns a new
 * entitlement; throws on an illegal transition so a bad webhook cannot silently
 * downgrade an account.
 */
export function applyEntitlementTransition(
  current: Entitlement,
  input: EntitlementTransitionInput,
  now = new Date(),
): Entitlement {
  if (!canTransition(current.status, input.status)) {
    throw new Error(`illegal entitlement transition ${current.status} -> ${input.status}`);
  }
  const next: Entitlement = {
    status: input.status,
    planCode: input.planCode,
    currentPeriodEnd: input.currentPeriodEnd ?? current.currentPeriodEnd,
    graceUntil: input.graceUntil ?? current.graceUntil,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? current.cancelAtPeriodEnd,
    updatedAt: now.toISOString(),
  };
  if (next.status === 'free') {
    next.planCode = 'free';
    next.currentPeriodEnd = null;
    next.graceUntil = null;
    next.cancelAtPeriodEnd = false;
  }
  return next;
}

export type PlusFeature =
  | 'exclusive_themes'
  | 'dashboard_layouts'
  | 'diet_planner'
  | 'weekly_meal_plan'
  | 'grocery_list'
  | 'smart_adaptation';

/** Free nutrition features are intentionally absent from this list: they never gate. */
export const PLUS_FEATURES: Record<PlusFeature, string> = {
  exclusive_themes: 'Exclusive themes and advanced appearance controls',
  dashboard_layouts: 'Custom dashboard cards and layouts',
  diet_planner: 'Personalised Indian diet planner',
  weekly_meal_plan: 'Weekly regional meal plans',
  grocery_list: 'Automatic grocery list from your meal plan',
  smart_adaptation: 'Budget, cooking-time and schedule aware adaptation',
};

export function canUseFeature(entitlement: Entitlement | null, feature: PlusFeature, now = new Date()): boolean {
  return isPlusActive(entitlement, now);
}
