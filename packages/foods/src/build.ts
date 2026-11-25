import {
  computeRecipePer100g,
  defaultServingGrams,
  isPlausibleComposition,
  macroEnergyKcal,
  scaleNutrition,
} from '@bharatbite/core';
import type {
  Cuisine,
  DataSource,
  FoodAlias,
  FoodCategory,
  FoodItem,
  FoodVariant,
  LanguageCode,
  NutritionPer100g,
  ServingSize,
  VerificationStatus,
} from '@bharatbite/core';
import type { RawDish, RawDirect, RawIngredient, RawIngredientFile, RawDishFile, RawDirectFile } from './schema.js';

export interface CatalogSources {
  ingredients: RawIngredientFile;
  dishes: RawDishFile;
  regional: RawDishFile;
  more: RawDishFile;
  direct: RawDirectFile;
}

export interface CatalogStats {
  ingredients: number;
  compositeDishes: number;
  directFoods: number;
  totalFoods: number;
  totalVariants: number;
  totalAliases: number;
  sourceVerified: number;
  calculated: number;
  needsAudit: number;
  warnings: number;
}

export interface CatalogResult {
  foods: FoodItem[];
  stats: CatalogStats;
  /** Real data problems that must be fixed before shipping. */
  warnings: string[];
  /** Advisory cross-checks recorded in the audit report (not failures). */
  qualityNotes: string[];
}

const FAT_SOURCES = new Set([
  'ghee',
  'butter',
  'mustard_oil',
  'sunflower_oil',
  'groundnut_oil',
  'coconut_oil',
]);

function toNutrition(i: RawIngredient): NutritionPer100g {
  return {
    kcal: i.kcal,
    protein_g: i.p,
    carbs_g: i.c,
    fat_g: i.fat,
    sat_fat_g: i.sat,
    fibre_g: i.f,
    sugar_g: i.s,
    sodium_mg: i.na,
  };
}

function scaleFatVariant(base: NutritionPer100g, fatFactor: number, sodiumFactor: number): NutritionPer100g {
  const fat = Math.round(base.fat_g * fatFactor * 100) / 100;
  const sat = Math.min(fat, Math.round(base.sat_fat_g * fatFactor * 100) / 100);
  const kcal = Math.round((base.kcal + (fat - base.fat_g) * 9) * 10) / 10;
  return {
    kcal,
    protein_g: base.protein_g,
    carbs_g: base.carbs_g,
    fat_g: fat,
    sat_fat_g: sat,
    fibre_g: base.fibre_g,
    sugar_g: base.sugar_g,
    sodium_mg: Math.round(base.sodium_mg * sodiumFactor),
  };
}

function dishServings(dish: RawDish): ServingSize[] {
  const [label, grams, household] = dish.serving;
  return [
    { label, grams, household, isDefault: true },
    { label: '100 g', grams: 100, household: 'weighed' },
  ];
}

/**
 * Cooked-weight standardization.
 *
 * Weights in a recipe are raw edible grams. Water that is fully absorbed (dal,
 * rice, batter) still counts toward the finished dish, while water in thin
 * preparations partially evaporates. These factors encode that, so per-100 g
 * values reflect what a person actually weighs in their katori — this is the
 * step most calorie databases get wrong for Indian food.
 */
const EVAPORATIVE_CATEGORIES = new Set(['beverage', 'soup', 'sweet_dessert']);

const YIELD_FACTOR: Record<string, number> = {
  roti_bread: 1.45, // dough hydration minus evaporation
  breakfast: 2.0, // batters and steamed items are water-heavy
  dal_legume: 2.7, // 1 part dry dal -> ~2.7 parts cooked dal
  rice_dish: 2.7, // 1 part raw rice -> ~2.7 parts cooked rice
  mixed_meal: 2.5,
  vegetable_sabzi: 0.9, // vegetables lose water while cooking
  paneer_dairy: 0.95,
  non_veg_curry: 1.2,
  snack_street_food: 0.95,
  egg: 1.0,
  condiment_chutney: 1.0,
  salad_raita: 1.0,
};

export function derivedCookedYieldGrams(dish: RawDish): number {
  const nonWater = dish.ingredients
    .filter(([id]) => id !== 'water')
    .reduce((sum, [, grams]) => sum + grams, 0);
  const total = dish.ingredients.reduce((sum, [, grams]) => sum + grams, 0);
  // A cooked dish can never weigh more than its inputs minus steam loss.
  const physicalCeiling = Math.max(1, Math.round(total * 0.95));
  if (EVAPORATIVE_CATEGORIES.has(dish.category)) return Math.round(total * 0.92);
  const factor = YIELD_FACTOR[dish.category] ?? 1.2;
  return Math.min(physicalCeiling, Math.round(nonWater * factor));
}

/**
 * Relative cost bands in INR per serving, used only for budget-aware planning
 * guidance. Deliberately coarse: a planner should not pretend to know today's
 * mandi price. Admin can override per food later.
 */
const COST_BANDS: Record<string, number> = {
  roti_bread: 12,
  dal_legume: 28,
  vegetable_sabzi: 30,
  rice_dish: 35,
  mixed_meal: 45,
  breakfast: 25,
  snack_street_food: 30,
  sweet_dessert: 35,
  beverage: 15,
  condiment_chutney: 8,
  salad_raita: 20,
  soup: 18,
  egg: 25,
  paneer_dairy: 60,
  non_veg_curry: 85,
  fruit: 25,
  dry_fruit_nut: 40,
  oil_fat: 10,
  spice_masala: 5,
  raw_ingredient: 20,
};

const PREP_BANDS: Record<string, number> = {
  roti_bread: 20,
  dal_legume: 30,
  vegetable_sabzi: 25,
  rice_dish: 30,
  mixed_meal: 35,
  breakfast: 20,
  snack_street_food: 25,
  sweet_dessert: 30,
  beverage: 10,
  condiment_chutney: 10,
  soup: 20,
  egg: 12,
  paneer_dairy: 25,
  non_veg_curry: 45,
  fruit: 2,
  dry_fruit_nut: 2,
  oil_fat: 1,
  spice_masala: 1,
  raw_ingredient: 10,
};

export function estimateCostInr(category: FoodCategory): number {
  return COST_BANDS[category] ?? 30;
}

export function estimatePrepMinutes(category: FoodCategory): number {
  return PREP_BANDS[category] ?? 25;
}

export function buildCatalog(sources: CatalogSources, options: { auditTolerance?: number } = {}): CatalogResult {
  const warnings: string[] = [];
  const qualityNotes: string[] = [];
  const tolerance = options.auditTolerance ?? 0.2;

  const ingredientNutrition = new Map<string, NutritionPer100g>();
  const foods: FoodItem[] = [];

  for (const ingredient of sources.ingredients.items) {
    const nutrition = toNutrition(ingredient);
    ingredientNutrition.set(ingredient.id, nutrition);
    if (!isPlausibleComposition(nutrition, 0.6)) {
      warnings.push(`ingredient ${ingredient.id} has an implausible composition`);
    }
    const source: DataSource = {
      source: ingredient.source ?? sources.ingredients.sourceDefault?.source ?? 'IFCT 2017',
      reference: ingredient.ref,
      methodology: 'ifct_value',
    };
    foods.push({
      id: ingredient.id,
      slug: ingredient.id,
      name: ingredient.name,
      cuisine: 'not_regional',
      category: 'raw_ingredient',
      aliases: [],
      defaultVariant: 'raw',
      variants: [
        {
          slug: 'raw',
          label: 'Raw / as purchased',
          preparationStyle: 'homemade',
          nutrition,
          servings: [{ label: '100 g', grams: 100, household: 'weighed', isDefault: true }],
          source,
        },
      ],
      verification: 'source_verified',
      tags: ['raw_ingredient'],
    });
  }

  const dishFiles = [sources.dishes, sources.regional, sources.more];
  for (const file of dishFiles) {
    for (const dish of file.items) {
      const cookedYieldGrams = dish.cookedYield > 0 ? dish.cookedYield : derivedCookedYieldGrams(dish);
      const standardized = derivedCookedYieldGrams(dish);
      if (dish.cookedYield > 0 && Math.abs(standardized - dish.cookedYield) / dish.cookedYield > 0.35) {
        qualityNotes.push(
          `dish ${dish.slug}: authored cookedYield ${dish.cookedYield} g differs from standardized ${standardized} g`,
        );
      }
      const servingGrams = dish.serving[1];
      const derivedServings = Math.max(1, Math.round(cookedYieldGrams / Math.max(1, servingGrams)));
      const base = computeRecipePer100g(
        {
          id: dish.slug,
          name: dish.name,
          servings: derivedServings,
          cookedYieldGrams,
          ingredients: dish.ingredients.map(([foodId, grams]) => ({ foodId, grams })),
        },
        ingredientNutrition,
      );
      if (!isPlausibleComposition(base, tolerance)) {
        warnings.push(
          `dish ${dish.slug} fails plausibility (kcal ${base.kcal}, macros imply ${Math.round(macroEnergyKcal(base))})`,
        );
      }
      const servings = dishServings(dish);
      const source: DataSource = {
        source: `Standardized recipe calculation from IFCT 2017 ingredient values (${dish.ingredients.length} ingredients)`,
        reference: `recipe:${dish.slug}`,
        methodology: 'standardized_recipe_calculation',
      };

      const variants: FoodVariant[] = [
        {
          slug: 'homemade',
          label: 'Homemade',
          preparationStyle: 'homemade',
          consistency: dish.category === 'rice_dish' || dish.category === 'soup' ? 'liquid' : undefined,
          nutrition: base,
          servings,
          source,
        },
      ];

      const variantFriendly = !['sweet_dessert', 'beverage', 'roti_bread', 'fruit'].includes(dish.category);
      const styles = dish.variantStyles ?? (variantFriendly ? ['homemade', 'restaurant'] : ['homemade']);
      if (styles.includes('restaurant')) {
        const restaurant = scaleFatVariant(base, 1.9, 1.3);
        if (isPlausibleComposition(restaurant, 0.35)) {
          variants.push({
            slug: 'restaurant',
            label: 'Restaurant / dhaba style (more oil)',
            preparationStyle: 'restaurant',
            oilLevel: 'high',
            nutrition: restaurant,
            servings,
            source: { ...source, source: `${source.source}; restaurant variant applies 1.9x added-fat and 1.3x salt` },
          });
        }
      }
      if (styles.includes('street')) {
        const street = scaleFatVariant(base, 1.35, 1.2);
        variants.push({
          slug: 'street',
          label: 'Street vendor style',
          preparationStyle: 'street',
          oilLevel: 'medium',
          nutrition: street,
          servings,
          source: { ...source, source: `${source.source}; street variant applies 1.35x added-fat` },
        });
      }

      const hasFatSource = dish.ingredients.some(([id]) => FAT_SOURCES.has(id));
      if (hasFatSource && base.fat_g >= 4) {
        const lowOil = scaleFatVariant(base, 0.55, 1.0);
        if (isPlausibleComposition(lowOil, 0.35)) {
          variants.push({
            slug: 'homemade-low-oil',
            label: 'Homemade, low oil',
            preparationStyle: 'homemade',
            oilLevel: 'low',
            nutrition: lowOil,
            servings,
            source: { ...source, source: `${source.source}; low-oil variant scales added fat to 55%` },
          });
        }
      }

      const aliases: FoodAlias[] = [
        ...dish.aliases.map(([alias, language]) => ({
          alias,
          language: language as LanguageCode,
          kind: 'regional_name' as const,
        })),
      ];
      if (dish.local && dish.lang) {
        aliases.unshift({ alias: dish.local, language: dish.lang as LanguageCode, kind: 'regional_name' });
      }

      const verification: VerificationStatus = dish.notes ? 'needs_audit' : 'calculated_from_recipe';

      foods.push({
        id: dish.slug,
        slug: dish.slug,
        name: dish.name,
        nameLocal: dish.local,
        cuisine: dish.cuisine as Cuisine,
        category: dish.category as FoodCategory,
        aliases,
        defaultVariant: 'homemade',
        variants,
        verification,
        tags: dish.tags ?? [dish.category],
        notes: dish.notes,
      });
    }
  }

  for (const direct of sources.direct.items) {
    const nutrition: NutritionPer100g = direct.nutrition;
    if (!isPlausibleComposition(nutrition, 0.35)) {
      warnings.push(`direct food ${direct.slug} has an implausible composition`);
    }
    const verification: VerificationStatus = direct.audit ? 'needs_audit' : 'source_verified';
    const [label, grams, household] = direct.serving;
    const aliases: FoodAlias[] = direct.aliases.map(([alias, language]) => ({
      alias,
      language: language as LanguageCode,
      kind: 'regional_name' as const,
    }));

    foods.push({
      id: direct.slug,
      slug: direct.slug,
      name: direct.name,
      nameLocal: direct.local,
      cuisine: direct.cuisine as Cuisine,
      category: direct.category as FoodCategory,
      aliases,
      defaultVariant: 'standard',
      variants: [
        {
          slug: 'standard',
          label: 'Standard preparation',
          preparationStyle: 'packaged',
          nutrition,
          servings: [
            { label, grams, household, isDefault: true },
            { label: '100 g', grams: 100, household: 'weighed' },
          ],
          source: {
            source: direct.source,
            reference: direct.ref,
            methodology: direct.methodology as DataSource['methodology'],
          },
        },
      ],
      verification,
      tags: direct.tags ?? [direct.category],
    });
  }

  const seen = new Set<string>();
  for (const food of foods) {
    if (seen.has(food.id)) warnings.push(`duplicate food id ${food.id}`);
    seen.add(food.id);
  }

  const totalVariants = foods.reduce((sum, f) => sum + f.variants.length, 0);
  const totalAliases = foods.reduce((sum, f) => sum + f.aliases.length, 0);

  const stats: CatalogStats = {
    ingredients: sources.ingredients.items.length,
    compositeDishes: sources.dishes.items.length + sources.regional.items.length + sources.more.items.length,
    directFoods: sources.direct.items.length,
    totalFoods: foods.length,
    totalVariants,
    totalAliases,
    sourceVerified: foods.filter((f) => f.verification === 'source_verified').length,
    calculated: foods.filter((f) => f.verification === 'calculated_from_recipe').length,
    needsAudit: foods.filter((f) => f.verification === 'needs_audit').length,
    warnings: warnings.length,
  };

  return { foods, stats, warnings, qualityNotes };
}

export interface PlannerCandidate {
  foodId: string;
  name: string;
  cuisine: Cuisine;
  category: string;
  nutrition: NutritionPer100g;
  servingGrams: number;
  costPerServingInr: number;
  prepMinutes: number;
  mealSlots: string[];
  dietTags: string[];
}

const SLOT_MAP: Record<string, string[]> = {
  breakfast: ['breakfast', 'egg', 'roti_bread'],
  lunch: ['rice_dish', 'dal_legume', 'vegetable_sabzi', 'mixed_meal', 'roti_bread'],
  dinner: ['roti_bread', 'dal_legume', 'vegetable_sabzi', 'soup', 'paneer_dairy', 'non_veg_curry'],
  evening_snack: ['snack_street_food', 'beverage', 'fruit', 'condiment_chutney', 'dry_fruit_nut'],
};

/** Builds the pool the diet planner selects from. Pure function of the catalog. */
export function plannerPool(foods: readonly FoodItem[]): PlannerCandidate[] {
  const pool: PlannerCandidate[] = [];
  for (const food of foods) {
    if (food.category === 'raw_ingredient' || food.category === 'spice_masala' || food.category === 'oil_fat') continue;
    const variant = food.variants.find((v) => v.slug === food.defaultVariant) ?? food.variants[0];
    if (!variant) continue;

    const slots = Object.entries(SLOT_MAP)
      .filter(([, categories]) => categories.includes(food.category))
      .map(([slot]) => slot);
    if (slots.length === 0) continue;

    const dietTags = ['vegetarian'];
    if (food.category !== 'paneer_dairy' && food.category !== 'egg' && food.category !== 'non_veg_curry') {
      dietTags.push('vegan');
    }
    if (food.tags?.includes('gluten_free')) dietTags.push('gluten_free');
    if (food.tags?.includes('high_protein') || (variant.nutrition.protein_g ?? 0) >= 12) dietTags.push('high_protein');

    pool.push({
      foodId: food.id,
      name: food.name,
      cuisine: food.cuisine,
      category: food.category,
      nutrition: variant.nutrition,
      servingGrams: defaultServingGrams(variant.servings, 150),
      costPerServingInr: estimateCostInr(food.category),
      prepMinutes: estimatePrepMinutes(food.category),
      mealSlots: slots,
      dietTags,
    });
  }
  return pool;
}

export function foodPortionSummary(food: FoodItem, grams: number): string {
  const variant = food.variants.find((v) => v.slug === food.defaultVariant) ?? food.variants[0];
  if (!variant) return `${grams} g`;
  const scaled = scaleNutrition(variant.nutrition, grams);
  return `${food.name} ${grams} g · ${Math.round(scaled.kcal)} kcal`;
}

export type { RawDish, RawDirect, RawIngredient };
