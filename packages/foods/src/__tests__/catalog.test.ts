import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPlausibleComposition, searchFoods } from '@bharatbite/core';
import { buildBundledCatalog, loadSources } from '../load.js';
import { buildCatalog, plannerPool, estimateCostInr } from '../build.js';

const sources = loadSources();
const catalog = buildBundledCatalog();
const foodById = new Map(catalog.foods.map((f) => [f.id, f]));

test('every dish references only defined ingredients', () => {
  const ingredientIds = new Set(sources.ingredients.items.map((i) => i.id));
  for (const file of [sources.dishes, sources.regional]) {
    for (const dish of file.items) {
      for (const [id] of dish.ingredients) {
        assert.ok(ingredientIds.has(id), `${dish.slug} references missing ingredient ${id}`);
      }
      assert.ok(dish.cookedYield > 0, `${dish.slug} needs a cooked yield`);
    }
  }
});

test('no unknown ingredient ids and no duplicate food slugs', () => {
  assert.deepEqual(catalog.warnings.filter((w) => w.includes('unknown')), []);
  const ids = catalog.foods.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('catalog composition is plausible for every variant', () => {
  for (const food of catalog.foods) {
    for (const variant of food.variants) {
      assert.ok(
        isPlausibleComposition(variant.nutrition, 0.35),
        `${food.id}/${variant.slug} implausible: ${JSON.stringify(variant.nutrition)}`,
      );
      assert.ok(variant.nutrition.kcal >= 0);
      assert.ok(variant.servings.length > 0, `${food.id}/${variant.slug} has no serving`);
      assert.ok(variant.servings.some((s) => s.grams > 0));
    }
  }
});

test('catalog size is a real Indian food database, not a demo stub', () => {
  assert.ok(catalog.stats.totalFoods >= 200, `only ${catalog.stats.totalFoods} foods`);
  assert.ok(catalog.stats.compositeDishes >= 100, `only ${catalog.stats.compositeDishes} composite dishes`);
  assert.ok(catalog.stats.totalAliases >= 150, `only ${catalog.stats.totalAliases} aliases`);
  assert.ok(catalog.stats.sourceVerified >= 80);
});

test('rotis and dals land in a believable calorie range', () => {
  const roti = foodById.get('roti-chapati');
  const variant = roti?.variants.find((v) => v.slug === 'homemade');
  assert.ok(variant);
  assert.ok(variant.nutrition.kcal > 200 && variant.nutrition.kcal < 320, `roti kcal ${variant.nutrition.kcal}`);

  const dal = foodById.get('dal-tadka')?.variants.find((v) => v.slug === 'homemade');
  assert.ok(dal);
  assert.ok(dal.nutrition.kcal > 60 && dal.nutrition.kcal < 160, `dal kcal ${dal.nutrition.kcal}`);
  assert.ok(dal.nutrition.protein_g > 2);
});

test('restaurant variants carry more fat than homemade ones', () => {
  const chicken = foodById.get('chicken-curry');
  assert.ok(chicken);
  const homemade = chicken.variants.find((v) => v.slug === 'homemade');
  const restaurant = chicken.variants.find((v) => v.slug === 'restaurant');
  assert.ok(homemade && restaurant);
  assert.ok(restaurant.nutrition.fat_g > homemade.nutrition.fat_g);
  assert.ok(restaurant.nutrition.kcal > homemade.nutrition.kcal);
});

test('every composite dish and direct food has at least one Indian-language alias', () => {
  const missing: string[] = [];
  for (const food of catalog.foods) {
    if (food.category === 'raw_ingredient') continue;
    const indian = food.aliases.filter((a) => a.language !== 'en');
    const local = food.nameLocal ? [food.nameLocal] : [];
    if (indian.length === 0 && local.length === 0) missing.push(food.id);
  }
  assert.deepEqual(missing, []);
});

test('local-language search works across scripts', () => {
  const byHindi = searchFoods(catalog.foods, 'रोटी');
  assert.ok(byHindi.length > 0);
  const byGujarati = searchFoods(catalog.foods, 'થેપલા');
  assert.equal(byGujarati[0]?.food.id, 'thepla');
  const byBengali = searchFoods(catalog.foods, 'মাছের ঝোল');
  assert.equal(byBengali[0]?.food.id, 'machher-jhol');
  const byTamil = searchFoods(catalog.foods, 'சாம்பார்');
  assert.equal(byTamil[0]?.food.id, 'sambar');
});

test('regional cuisines are represented', () => {
  const cuisines = new Set(catalog.foods.map((f) => f.cuisine));
  for (const required of [
    'gujarati',
    'punjabi',
    'rajasthani',
    'maharashtrian',
    'bengali',
    'south_indian',
    'north_indian',
    'kashmiri',
    'bihari',
    'odia',
    'northeastern',
    'street_food',
  ]) {
    assert.ok(cuisines.has(required as never), `missing cuisine ${required}`);
  }
});

test('planner pool excludes raw ingredients and carries cost/time estimates', () => {
  const pool = plannerPool(catalog.foods);
  assert.ok(pool.length > 60);
  for (const candidate of pool) {
    assert.notEqual(candidate.category, 'raw_ingredient');
    assert.ok(candidate.servingGrams > 0);
    assert.ok(candidate.costPerServingInr > 0);
    assert.ok(candidate.prepMinutes > 0);
    assert.ok(candidate.mealSlots.length > 0);
  }
  assert.equal(estimateCostInr('non_veg_curry') > estimateCostInr('dal_legume'), true);
});

test('build is deterministic', () => {
  const again = buildCatalog(sources);
  assert.deepEqual(again.stats, catalog.stats);
  assert.deepEqual(
    again.foods.map((f) => f.id),
    catalog.foods.map((f) => f.id),
  );
});
