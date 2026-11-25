import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bmi, bmiCategoryIndian, computeTargets, dailyKcalTarget, tdeeKcal, idealWeightRangeKg } from '../goals.js';
import { groupByMeal, localDateKey, macroBars, summarizeDay, weightTrendKgPerWeek } from '../diary.js';
import { detectScript, normalizeQuery, phoneticKey, searchFoods, suggestDisambiguation } from '../search.js';
import { generateWeeklyPlan, groceryListFromPlan } from '../diet-plan.js';
import type { PlannerFood } from '../diet-plan.js';
import { isUuidV7, uuidv7 } from '../ids.js';
import type { FoodItem, FoodLogEntry } from '../types.js';

const profile = {
  sex: 'male' as const,
  ageYears: 30,
  heightCm: 172,
  weightKg: 74,
  activityLevel: 'moderate' as const,
  goal: 'lose' as const,
};

test('BMR/TDEE use Mifflin-St Jeor', () => {
  // 10*74 + 6.25*172 - 5*30 + 5 = 740 + 1075 - 150 + 5 = 1670
  const targets = computeTargets(profile);
  assert.ok(dailyKcalTarget(profile) < tdeeKcal(profile));
  assert.ok(targets.kcal > 1200);
  assert.ok(targets.protein_g >= 74);
  assert.ok(targets.carbs_g > 60);
});

test('calorie target respects safety floors', () => {
  const tiny = { ...profile, weightKg: 45, heightCm: 150, ageYears: 60, activityLevel: 'sedentary' as const };
  assert.ok(dailyKcalTarget(tiny) >= 1500);
});

test('BMI categories use Indian cut-offs', () => {
  assert.equal(bmi(74, 172), 25);
  assert.equal(bmiCategoryIndian(22.9), 'normal');
  assert.equal(bmiCategoryIndian(23), 'overweight');
  assert.equal(bmiCategoryIndian(25), 'obese');
  const range = idealWeightRangeKg(172);
  assert.ok(range.min < range.max);
});

const entry = (overrides: Partial<FoodLogEntry>): FoodLogEntry => ({
  id: overrides.id ?? 'e1',
  userId: 'u1',
  logDate: '2026-11-25',
  mealType: 'lunch',
  foodId: 'f1',
  variantSlug: 'homemade',
  grams: 100,
  nutrition: {
    grams: 100,
    kcal: 200,
    protein_g: 5,
    carbs_g: 30,
    fat_g: 6,
    sat_fat_g: 1,
    fibre_g: 3,
    sugar_g: 2,
    sodium_mg: 300,
  },
  source: 'manual_search',
  clientCreatedAt: '2026-11-25T08:00:00Z',
  updatedAt: '2026-11-25T08:00:00Z',
  deletedAt: null,
  ...overrides,
});

test('daily summary groups meals and computes remaining macros', () => {
  const entries = [
    entry({ id: 'a', mealType: 'breakfast', nutrition: { ...entry({}).nutrition, kcal: 300 } }),
    entry({ id: 'b', mealType: 'lunch' }),
    entry({ id: 'c', mealType: 'lunch', deletedAt: '2026-11-25T09:00:00Z' }),
  ];
  const summary = summarizeDay('2026-11-25', entries, {
    kcal: 2000,
    protein_g: 120,
    carbs_g: 250,
    fat_g: 55,
    fibre_g: 30,
  });
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.totals.kcal, 500);
  assert.equal(summary.meals.length, 2);
  assert.equal(groupByMeal(entries).find((m) => m.mealType === 'lunch')?.entries.length, 1);
  assert.equal(summary.remaining?.kcal, 1500);
  const bars = macroBars(summary.totals, summary.targets);
  assert.ok(bars.energySplit.protein + bars.energySplit.carbs + bars.energySplit.fat >= 99);
});

test('weight trend computes kg per week', () => {
  const trend = weightTrendKgPerWeek([
    { measuredOn: '2026-11-01', weightKg: 76 },
    { measuredOn: '2026-11-15', weightKg: 75 },
  ]);
  assert.equal(trend, -0.5);
  assert.equal(weightTrendKgPerWeek([{ measuredOn: '2026-11-01', weightKg: 76 }]), null);
});

test('local date key does not shift across midnight', () => {
  assert.equal(localDateKey(new Date('2026-11-25T18:30:00.000Z'), 330), '2026-11-26');
});

const thepla: FoodItem = {
  id: 'thepla',
  slug: 'thepla',
  name: 'Thepla',
  nameLocal: 'થેપલા',
  cuisine: 'gujarati',
  category: 'roti_bread',
  aliases: [
    { alias: 'Methi thepla', language: 'en' },
    { alias: 'થેપલું', language: 'gu' },
    { alias: 'thepala', language: 'en', kind: 'common_misspelling' },
  ],
  defaultVariant: 'homemade',
  variants: [
    {
      slug: 'homemade',
      label: 'Homemade',
      preparationStyle: 'homemade',
      nutrition: { kcal: 240, protein_g: 6, carbs_g: 33, fat_g: 9, sat_fat_g: 3, fibre_g: 3, sugar_g: 1, sodium_mg: 320 },
      servings: [{ label: '1 thepla', grams: 45, isDefault: true }],
      source: { source: 'test', methodology: 'standardized_recipe_calculation' },
    },
  ],
  verification: 'calculated_from_recipe',
  tags: ['roti_bread'],
};

const dhokla: FoodItem = {
  ...thepla,
  id: 'dhokla',
  slug: 'dhokla',
  name: 'Dhokla',
  nameLocal: 'ઢોકળા',
  category: 'breakfast',
  aliases: [{ alias: 'Khaman dhokla', language: 'en' }],
};

test('search matches aliases, scripts and misspellings', () => {
  const hits = searchFoods([thepla, dhokla], 'thepala');
  assert.equal(hits[0]?.food.id, 'thepla');
  assert.ok((hits[0]?.score ?? 0) > 0.5);

  const gujarati = searchFoods([thepla, dhokla], 'થેપલા');
  assert.equal(gujarati[0]?.food.id, 'thepla');
  assert.equal(gujarati[0]?.matchedLanguage, 'gu');

  assert.equal(searchFoods([thepla, dhokla], 'dhokla')[0]?.food.id, 'dhokla');
  assert.equal(searchFoods([thepla], '').length, 0);
});

test('script detection and phonetic normalisation', () => {
  assert.equal(detectScript('થેપલા'), 'gu');
  assert.equal(detectScript('रोटी'), 'hi');
  assert.equal(detectScript('roti'), null);
  assert.equal(phoneticKey('Chapati'), phoneticKey('chappathi'));
  assert.equal(normalizeQuery('  Dal   Tadka!! '), 'dal tadka');
});

test('disambiguation surfaces similar dishes from the same family', () => {
  const options = suggestDisambiguation(thepla, [thepla, dhokla]);
  assert.equal(options.length, 1);
  assert.equal(options[0]?.foodId, 'dhokla');
});

const pool: PlannerFood[] = [
  {
    foodId: 'poha',
    name: 'Poha',
    cuisine: 'maharashtrian',
    category: 'breakfast',
    nutrition: { kcal: 160, protein_g: 3.5, carbs_g: 28, fat_g: 4, sat_fat_g: 1, fibre_g: 2, sugar_g: 2, sodium_mg: 350 },
    servingGrams: 200,
    costPerServingInr: 25,
    prepMinutes: 15,
    mealSlots: ['breakfast'],
    dietTags: ['vegetarian', 'vegan'],
  },
  {
    foodId: 'roti_sabzi',
    name: 'Roti with mixed sabzi',
    cuisine: 'pan_indian',
    category: 'mixed_meal',
    nutrition: { kcal: 180, protein_g: 5, carbs_g: 30, fat_g: 4, sat_fat_g: 1, fibre_g: 4, sugar_g: 3, sodium_mg: 400 },
    servingGrams: 250,
    costPerServingInr: 35,
    prepMinutes: 30,
    mealSlots: ['lunch', 'dinner'],
    dietTags: ['vegetarian', 'vegan'],
  },
];

test('weekly planner produces 7 days, respects diet filters and stays in budget', () => {
  const plan = generateWeeklyPlan(
    pool,
    { kcal: 1800, protein_g: 90, carbs_g: 220, fat_g: 50, fibre_g: 28 },
    {
      cuisinePreference: 'mixed',
      dietTags: ['vegetarian'],
      allergies: [],
      maxPrepMinutes: 45,
      dailyBudgetInr: 150,
      mealSlots: ['breakfast', 'lunch', 'dinner'],
    },
  );
  assert.equal(plan.days.length, 7);
  assert.ok(plan.days.every((d) => d.items.length === 3));
  assert.ok(plan.days.every((d) => d.totals.costInr <= 200));
  const grocery = groceryListFromPlan(plan);
  assert.ok(grocery.length >= 2);
});

test('planner returns an explanatory note when filters exclude everything', () => {
  const plan = generateWeeklyPlan(
    pool,
    { kcal: 1800, protein_g: 90, carbs_g: 220, fat_g: 50, fibre_g: 28 },
    {
      cuisinePreference: 'kashmiri',
      dietTags: [],
      allergies: [],
      maxPrepMinutes: 5,
      dailyBudgetInr: null,
      mealSlots: ['lunch'],
    },
  );
  assert.equal(plan.days.length, 0);
  assert.ok(plan.notes[0]?.includes('No dishes'));
});

test('uuidv7 is time ordered and well formed', () => {
  const first = uuidv7({ now: () => 1_700_000_000_000, randomBytes: (n) => new Uint8Array(n).fill(1) });
  const second = uuidv7({ now: () => 1_700_000_001_000, randomBytes: (n) => new Uint8Array(n).fill(2) });
  assert.ok(isUuidV7(first));
  assert.ok(isUuidV7(second));
  assert.ok(first < second);
});
