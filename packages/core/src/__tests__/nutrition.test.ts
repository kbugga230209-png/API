import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeRecipePer100g,
  energyDeviationPct,
  isPlausibleComposition,
  scaleByServings,
  scaleNutrition,
  sumNutrition,
  toPer100g,
} from '../nutrition.js';
import type { NutritionPer100g, RecipeSpec } from '../types.js';

const rice: NutritionPer100g = {
  kcal: 356,
  protein_g: 7.9,
  carbs_g: 78.2,
  fat_g: 0.5,
  sat_fat_g: 0.1,
  fibre_g: 1.0,
  sugar_g: 0.1,
  sodium_mg: 5,
};
const toorDal: NutritionPer100g = {
  kcal: 343,
  protein_g: 22.3,
  carbs_g: 57.2,
  fat_g: 1.7,
  sat_fat_g: 0.3,
  fibre_g: 10.8,
  sugar_g: 2.5,
  sodium_mg: 20,
};
const ghee: NutritionPer100g = {
  kcal: 900,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 100,
  sat_fat_g: 62,
  fibre_g: 0,
  sugar_g: 0,
  sodium_mg: 2,
};

test('scaleNutrition multiplies per-100g values and rounds once', () => {
  const total = scaleNutrition(rice, 150);
  assert.equal(total.grams, 150);
  assert.equal(total.kcal, 534);
  assert.equal(total.protein_g, 11.85);
  assert.equal(total.carbs_g, 117.3);
});

test('scaleNutrition rejects negative weight', () => {
  assert.throws(() => scaleNutrition(rice, -5), RangeError);
});

test('scaleByServings uses the serving gram weight', () => {
  const total = scaleByServings(toorDal, { label: '1 katori', grams: 30, household: '1 katori' }, 2);
  assert.equal(total.grams, 60);
  assert.equal(total.kcal, 205.8);
});

test('sumNutrition accumulates without drift', () => {
  const a = scaleNutrition(rice, 100);
  const b = scaleNutrition(toorDal, 30);
  const c = scaleNutrition(ghee, 5);
  const sum = sumNutrition([a, b, c]);
  assert.equal(sum.grams, 135);
  assert.equal(sum.kcal, Math.round((356 + 102.9 + 45) * 10) / 10);
});

test('recipe calculation divides by cooked yield, not raw weight', () => {
  const recipe: RecipeSpec = {
    id: 'test-dal-chawal',
    name: 'Dal chawal',
    servings: 2,
    cookedYieldGrams: 500,
    ingredients: [
      { foodId: 'rice_raw', grams: 100 },
      { foodId: 'toor_dal_raw', grams: 50 },
      { foodId: 'ghee', grams: 10 },
    ],
  };
  const per100g = computeRecipePer100g(
    recipe,
    new Map([
      ['rice_raw', rice],
      ['toor_dal_raw', toorDal],
      ['ghee', ghee],
    ]),
  );
  // raw energy = 356 + 171.5 + 90 = 617.5 kcal over 500 g cooked => 123.5 per 100 g
  assert.equal(per100g.kcal, 123.5);
  assert.ok(per100g.protein_g > 3);
  assert.ok(isPlausibleComposition(per100g));
});

test('recipe calculation fails loudly on unknown ingredients', () => {
  const recipe: RecipeSpec = {
    id: 'broken',
    name: 'Broken',
    servings: 1,
    cookedYieldGrams: 200,
    ingredients: [{ foodId: 'mystery', grams: 100 }],
  };
  assert.throws(() => computeRecipePer100g(recipe, new Map()), /unknown ingredient/);
});

test('toPer100g round-trips a total', () => {
  const total = scaleNutrition(rice, 250);
  const roundTrip = toPer100g(total);
  assert.equal(roundTrip.kcal, rice.kcal);
  assert.equal(roundTrip.carbs_g, rice.carbs_g);
});

test('implausible compositions are rejected', () => {
  const impossible: NutritionPer100g = {
    kcal: 500,
    protein_g: 60,
    carbs_g: 70,
    fat_g: 50,
    sat_fat_g: 10,
    fibre_g: 2,
    sugar_g: 1,
    sodium_mg: 300,
  };
  assert.equal(isPlausibleComposition(impossible), false);
  assert.ok(energyDeviationPct(rice) < 0.05);
  assert.equal(isPlausibleComposition(rice), true);
});

test('saturated fat above total fat is rejected', () => {
  assert.equal(
    isPlausibleComposition({ ...rice, sat_fat_g: 9 }),
    false,
  );
});
