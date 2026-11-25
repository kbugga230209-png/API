import { buildBundledCatalog } from '@bharatbite/foods';
import type { FoodItem } from '@bharatbite/core';

let cached: FoodItem[] | null = null;

/**
 * The catalog is compiled into the app (226 foods, 352 preparations) so search
 * and planning keep working when the database is slow or the user is offline.
 * The database mirror is used for reference lookups and joins.
 */
export function getBundledFoods(): FoodItem[] {
  if (!cached) cached = buildBundledCatalog().foods;
  return cached;
}

export function catalogStats() {
  return buildBundledCatalog().stats;
}
