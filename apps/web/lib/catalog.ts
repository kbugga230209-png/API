import type {
  Cuisine,
  DataSource,
  FoodAlias,
  FoodCategory,
  FoodItem,
  FoodVariant,
  LanguageCode,
  NutritionPer100g,
  PlannerFood,
  ServingSize,
  VerificationStatus,
} from '@bharatbite/core';
import catalogJson from '@bharatbite/foods/generated/catalog.compact.json';
import plannerPoolJson from '@bharatbite/foods/generated/planner-pool.json';

/**
 * The catalog is compiled into the application bundle, not read from disk.
 *
 * A serverless function has no `packages/foods/data` directory and its working
 * directory is not the repository, so `readFileSync` at request time throws.
 * The generated JSON is imported statically and decoded once here, so search,
 * portion maths and planning work even when Postgres is slow or the network is
 * gone.
 *
 * The generated file uses a deliberately compact, stable transport schema
 * (`slug` instead of `id`, `style` instead of `preparationStyle`, the source as
 * a plain string). Decoding is explicit because a blind cast would silently
 * produce items with no `id`, which is exactly how a food page 404s.
 */
interface TransportVariant {
  slug: string;
  label: string;
  style: FoodVariant['preparationStyle'];
  consistency: FoodVariant['consistency'] | null;
  oilLevel: FoodVariant['oilLevel'] | null;
  source: string;
  reference: string | null;
  methodology: DataSource['methodology'];
  nutrition: NutritionPer100g;
  servings: { label: string; grams: number; household: string | null; isDefault: boolean }[];
}

interface TransportFood {
  slug: string;
  name: string;
  nameLocal: string | null;
  cuisine: Cuisine;
  category: FoodCategory;
  defaultVariant: string;
  verification: VerificationStatus;
  tags: string[];
  notes: string | null;
  aliases: { alias: string; language: LanguageCode; kind: FoodAlias['kind'] }[];
  variants: TransportVariant[];
}

interface CatalogFile {
  schemaVersion: number;
  generatedAt: string;
  stats: {
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
  };
  foods: TransportFood[];
}

const catalog = catalogJson as unknown as CatalogFile;

function decodeVariant(variant: TransportVariant): FoodVariant {
  const source: DataSource = {
    source: variant.source,
    reference: variant.reference ?? undefined,
    methodology: variant.methodology,
  };
  return {
    slug: variant.slug,
    label: variant.label,
    preparationStyle: variant.style,
    consistency: variant.consistency ?? undefined,
    oilLevel: variant.oilLevel ?? undefined,
    nutrition: variant.nutrition,
    servings: variant.servings.map(
      (serving): ServingSize => ({
        label: serving.label,
        grams: serving.grams,
        household: serving.household ?? undefined,
        isDefault: serving.isDefault,
      }),
    ),
    source,
  };
}

function decodeFood(food: TransportFood): FoodItem {
  return {
    id: food.slug,
    slug: food.slug,
    name: food.name,
    nameLocal: food.nameLocal ?? undefined,
    cuisine: food.cuisine,
    category: food.category,
    aliases: food.aliases.map((alias) => ({
      alias: alias.alias,
      language: alias.language,
      kind: alias.kind,
    })),
    defaultVariant: food.defaultVariant,
    variants: food.variants.map(decodeVariant),
    verification: food.verification,
    tags: food.tags,
    notes: food.notes ?? undefined,
  };
}

let decoded: FoodItem[] | null = null;

export function getBundledFoods(): readonly FoodItem[] {
  if (!decoded) decoded = catalog.foods.map(decodeFood);
  return decoded;
}

export function findBundledFood(slug: string): FoodItem | undefined {
  return getBundledFoods().find((food) => food.id === slug);
}

export function catalogStats() {
  return catalog.stats;
}

export function catalogGeneratedAt(): string {
  return catalog.generatedAt;
}

/** Pre-computed planner pool (one row per plannable preparation). */
export function getPlannerPool(): readonly PlannerFood[] {
  return plannerPoolJson as unknown as PlannerFood[];
}
