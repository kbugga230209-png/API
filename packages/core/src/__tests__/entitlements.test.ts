import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyEntitlementTransition,
  canUseFeature,
  freeEntitlement,
  graceUntilFrom,
  isPlusActive,
  PLUS_PLANS,
} from '../entitlements.js';
import type { Entitlement } from '../entitlements.js';

const now = new Date('2026-11-25T10:00:00.000Z');

function plus(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    status: 'active',
    planCode: 'plus_monthly',
    currentPeriodEnd: '2026-12-25T10:00:00.000Z',
    graceUntil: null,
    cancelAtPeriodEnd: false,
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

test('free users never get Plus features but keep every free feature', () => {
  const free = freeEntitlement(now);
  assert.equal(isPlusActive(free, now), false);
  assert.equal(canUseFeature(free, 'diet_planner', now), false);
  // Free features are not represented as gateable at all.
  assert.equal(canUseFeature(free, 'exclusive_themes', now), false);
});

test('active Plus grants access until period end', () => {
  assert.equal(isPlusActive(plus(), now), true);
  assert.equal(isPlusActive(plus(), new Date('2026-12-26T00:00:00.000Z')), false);
});

test('cancelled keeps already-paid access until expiry', () => {
  const cancelled = plus({ status: 'cancelled', cancelAtPeriodEnd: true });
  assert.equal(isPlusActive(cancelled, new Date('2026-12-01T00:00:00.000Z')), true);
  assert.equal(isPlusActive(cancelled, new Date('2026-12-26T00:00:00.000Z')), false);
});

test('past_due uses the 3-day grace period then locks', () => {
  const periodEnd = new Date('2026-11-24T10:00:00.000Z');
  const pastDue = plus({
    status: 'past_due',
    currentPeriodEnd: periodEnd.toISOString(),
    graceUntil: graceUntilFrom(periodEnd),
  });
  assert.equal(isPlusActive(pastDue, now), true);
  assert.equal(isPlusActive(pastDue, new Date('2026-11-28T00:00:00.000Z')), false);
});

test('pending checkout never unlocks Plus', () => {
  assert.equal(isPlusActive(plus({ status: 'pending' }), now), false);
});

test('refunded and expired never unlock', () => {
  assert.equal(isPlusActive(plus({ status: 'refunded' }), now), false);
  assert.equal(isPlusActive(plus({ status: 'expired' }), now), false);
});

test('illegal transitions throw instead of silently downgrading', () => {
  const expired = plus({ status: 'expired', currentPeriodEnd: '2026-01-01T00:00:00.000Z' });
  assert.throws(
    () => applyEntitlementTransition(expired, { status: 'past_due', planCode: 'plus_monthly' }, now),
    /illegal entitlement transition/,
  );
});

test('legal transition to free clears paid fields', () => {
  const expired = plus({ status: 'expired' });
  const next = applyEntitlementTransition(expired, { status: 'free', planCode: 'free' }, now);
  assert.equal(next.status, 'free');
  assert.equal(next.planCode, 'free');
  assert.equal(next.currentPeriodEnd, null);
  assert.equal(next.graceUntil, null);
});

test('plan pricing matches the approved India pricing', () => {
  assert.equal(PLUS_PLANS.plus_monthly.priceInr, 49);
  assert.equal(PLUS_PLANS.plus_annual.priceInr, 399);
  assert.equal(PLUS_PLANS.plus_monthly.periodDays, 30);
});
