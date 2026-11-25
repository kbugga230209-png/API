import type { DayTargets, UserProfileInput } from './types.js';

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

const KCAL_PER_KG_FAT = 7700;

/**
 * Mifflin–St Jeor resting metabolic rate. Chosen over Harris–Benedict because it
 * is the better-validated equation for modern Indian adult populations and is
 * what most clinical dietetics references in India use.
 */
export function bmrKcal(input: UserProfileInput): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  if (input.sex === 'male') return base + 5;
  if (input.sex === 'female') return base - 161;
  return base - 78; // midpoint of the male/female constants
}

export function tdeeKcal(input: UserProfileInput): number {
  return bmrKcal(input) * ACTIVITY_FACTORS[input.activityLevel];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Evidence-based daily energy target.
 *
 * Safety rails: never below 1200 kcal (female) / 1500 kcal (male) without a
 * clinician, and never above a 1 %/week body-weight change rate. This is
 * nutrition guidance, not medical treatment.
 */
export function dailyKcalTarget(input: UserProfileInput): number {
  const tdee = tdeeKcal(input);
  const floor = input.sex === 'female' ? 1200 : 1500;
  if (input.goal === 'maintain') return Math.round(clamp(tdee, floor, 6000));

  const requestedRate = input.rateKgPerWeek ?? (input.goal === 'lose' ? 0.5 : 0.25);
  const maxRate = input.weightKg * 0.01;
  const rate = clamp(requestedRate, 0.1, Math.max(0.1, maxRate));
  const dailyDelta = (rate * KCAL_PER_KG_FAT) / 7;

  const raw = input.goal === 'lose' ? tdee - dailyDelta : tdee + dailyDelta;
  return Math.round(clamp(raw, floor, 6000));
}

export interface MacroSplit {
  /** Share of energy from protein. */
  readonly protein: number;
  readonly fat: number;
  readonly carbs: number;
}

/**
 * Protein is set per kg of body weight (1.6 g/kg for fat loss preserves lean
 * mass, 1.2 g/kg for maintenance), fat at 25 % of energy, carbohydrate fills the
 * remainder — which is the practical pattern of Indian diets (roti/rice-forward)
 * while staying inside ICMR-NIN acceptable macronutrient ranges.
 */
export function computeTargets(input: UserProfileInput): DayTargets {
  const kcal = dailyKcalTarget(input);
  const proteinPerKg = input.goal === 'lose' ? 1.6 : input.goal === 'gain' ? 1.8 : 1.2;
  const protein_g = Math.round(clamp(input.weightKg * proteinPerKg, 45, 2.2 * input.weightKg));
  const fat_g = Math.round((kcal * 0.25) / 9);
  const carbs_g = Math.max(60, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  const fibre_g = Math.round(clamp(kcal / 1000 * 14, 20, 40)); // 14 g per 1000 kcal (ICMR/USDA aligned)

  return { kcal, protein_g, carbs_g, fat_g, fibre_g };
}

export function bmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) throw new RangeError('height must be positive');
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** WHO Asian-Indian cut-offs (ICMR 2009): >=23 overweight, >=25 obese. */
export function bmiCategoryIndian(value: number): 'underweight' | 'normal' | 'overweight' | 'obese' {
  if (value < 18.5) return 'underweight';
  if (value < 23) return 'normal';
  if (value < 25) return 'overweight';
  return 'obese';
}

export function idealWeightRangeKg(heightCm: number): { min: number; max: number } {
  const m = heightCm / 100;
  return {
    min: Math.round(18.5 * m * m * 10) / 10,
    max: Math.round(22.9 * m * m * 10) / 10,
  };
}
