import type { DayTargets, FoodLogEntry, MealType, NutritionTotal } from './types.js';
import { MEAL_TYPES } from './types.js';
import { sumNutrition } from './nutrition.js';

export interface MealGroup {
  readonly mealType: MealType;
  readonly entries: readonly FoodLogEntry[];
  readonly totals: NutritionTotal;
}

export interface DaySummary {
  readonly logDate: string;
  readonly meals: readonly MealGroup[];
  readonly totals: NutritionTotal;
  readonly targets: DayTargets | null;
  readonly remaining: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fibre_g: number } | null;
  readonly entryCount: number;
}

export function localDateKey(date: Date, timeZoneOffsetMinutes = -date.getTimezoneOffset()): string {
  const shifted = new Date(date.getTime() + timeZoneOffsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function groupByMeal(entries: readonly FoodLogEntry[]): MealGroup[] {
  return MEAL_TYPES.map((mealType) => {
    const mealEntries = entries
      .filter((e) => e.mealType === mealType && !e.deletedAt)
      .sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));
    return { mealType, entries: mealEntries, totals: sumNutrition(mealEntries.map((e) => e.nutrition)) };
  }).filter((group) => group.entries.length > 0);
}

export function summarizeDay(
  logDate: string,
  entries: readonly FoodLogEntry[],
  targets: DayTargets | null,
): DaySummary {
  const live = entries.filter((e) => e.logDate === logDate && !e.deletedAt);
  const totals = sumNutrition(live.map((e) => e.nutrition));
  const remaining = targets
    ? {
        kcal: Math.round(targets.kcal - totals.kcal),
        protein_g: Math.round((targets.protein_g - totals.protein_g) * 10) / 10,
        carbs_g: Math.round((targets.carbs_g - totals.carbs_g) * 10) / 10,
        fat_g: Math.round((targets.fat_g - totals.fat_g) * 10) / 10,
        fibre_g: Math.round((targets.fibre_g - totals.fibre_g) * 10) / 10,
      }
    : null;
  return { logDate, meals: groupByMeal(live), totals, targets, remaining, entryCount: live.length };
}

export function calorieShare(totalKcal: number, targets: DayTargets | null): number {
  if (!targets || targets.kcal <= 0) return 0;
  return Math.min(1.5, totalKcal / targets.kcal);
}

export interface MacroBars {
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
  /** Energy contribution of each macro, in percent, summing to ~100. */
  readonly energySplit: { protein: number; carbs: number; fat: number };
}

export function macroBars(totals: NutritionTotal, targets: DayTargets | null): MacroBars {
  const p = totals.protein_g * 4;
  const c = totals.carbs_g * 4;
  const f = totals.fat_g * 9;
  const sum = p + c + f;
  return {
    protein: targets ? Math.min(1, totals.protein_g / Math.max(1, targets.protein_g)) : 0,
    carbs: targets ? Math.min(1, totals.carbs_g / Math.max(1, targets.carbs_g)) : 0,
    fat: targets ? Math.min(1, totals.fat_g / Math.max(1, targets.fat_g)) : 0,
    energySplit: {
      protein: sum > 0 ? Math.round((p / sum) * 100) : 0,
      carbs: sum > 0 ? Math.round((c / sum) * 100) : 0,
      fat: sum > 0 ? Math.round((f / sum) * 100) : 0,
    },
  };
}

/** Weight trend over the last N readings, expressed as kg/week. */
export function weightTrendKgPerWeek(
  history: readonly { measuredOn: string; weightKg: number }[],
): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;
  const days = (Date.parse(last.measuredOn) - Date.parse(first.measuredOn)) / 86_400_000;
  if (days < 1) return null;
  return Math.round(((last.weightKg - first.weightKg) / days) * 7 * 100) / 100;
}
