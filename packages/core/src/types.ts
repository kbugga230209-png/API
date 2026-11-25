/**
 * Shared domain types for BharatBite.
 *
 * These mirror the Postgres enums in `supabase/migrations/0001_init_shared.sql`
 * one-for-one. Keep both sides in sync — there is a unit test asserting the
 * catalog of enum values against the migration file.
 */

export const CUISINES = [
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
  'pan_indian',
  'not_regional',
] as const;
export type Cuisine = (typeof CUISINES)[number];

export const FOOD_CATEGORIES = [
  'grain_cereal',
  'roti_bread',
  'dal_legume',
  'vegetable_sabzi',
  'paneer_dairy',
  'non_veg_curry',
  'rice_dish',
  'breakfast',
  'snack_street_food',
  'sweet_dessert',
  'beverage',
  'condiment_chutney',
  'salad_raita',
  'soup',
  'egg',
  'fruit',
  'dry_fruit_nut',
  'oil_fat',
  'spice_masala',
  'raw_ingredient',
  'mixed_meal',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const MEAL_TYPES = [
  'breakfast',
  'mid_morning',
  'lunch',
  'evening_snack',
  'dinner',
  'midnight',
] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const VERIFICATION_STATUSES = [
  'source_verified',
  'calculated_from_recipe',
  'needs_audit',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ENTITLEMENT_STATUSES = [
  'free',
  'pending',
  'active',
  'past_due',
  'cancelled',
  'expired',
  'refunded',
] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const LANGUAGES = [
  'en',
  'hi',
  'gu',
  'mr',
  'pa',
  'bn',
  'ta',
  'te',
  'kn',
  'ml',
  'or',
  'as',
  'ur',
] as const;
export type LanguageCode = (typeof LANGUAGES)[number];

/** Nutritional composition of 100 g of an edible preparation. */
export interface NutritionPer100g {
  readonly kcal: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  readonly sat_fat_g: number;
  readonly fibre_g: number;
  readonly sugar_g: number;
  readonly sodium_mg: number;
}

/** A nutrition total for an arbitrary consumed weight (never per 100 g). */
export interface NutritionTotal extends NutritionPer100g {
  readonly grams: number;
}

export interface ServingSize {
  readonly label: string;
  /** Edible weight in grams for one serving. */
  readonly grams: number;
  /** Household measure, e.g. "1 katori", "1 medium roti". */
  readonly household?: string;
  readonly isDefault?: boolean;
}

export interface IngredientRef {
  readonly foodId: string;
  readonly grams: number;
  readonly note?: string;
}

export interface RecipeSpec {
  readonly id: string;
  readonly name: string;
  readonly servings: number;
  /** Total grams of the cooked dish after water loss / evaporation. */
  readonly cookedYieldGrams: number;
  readonly ingredients: readonly IngredientRef[];
  /** Extra grams of added fat that are implied by cooking method. */
  readonly addedFatGrams?: number;
}

export interface FoodAlias {
  readonly alias: string;
  readonly language: LanguageCode;
  readonly kind?: 'regional_name' | 'transliteration' | 'common_misspelling' | 'english_name' | 'brand';
}

export interface FoodVariant {
  /** Stable slug, e.g. `homemade-low-oil`, `restaurant-style`, `dry`, `gravy`. */
  readonly slug: string;
  readonly label: string;
  readonly preparationStyle: 'homemade' | 'restaurant' | 'packaged' | 'street';
  readonly consistency?: 'dry' | 'semi_gravy' | 'gravy' | 'liquid' | 'solid';
  readonly oilLevel?: 'low' | 'medium' | 'high';
  readonly nutrition: NutritionPer100g;
  readonly servings: readonly ServingSize[];
  readonly source: DataSource;
}

export interface DataSource {
  /** Human-readable provenance, e.g. "IFCT 2017 (NIN Hyderabad), table 5". */
  readonly source: string;
  /** Stable reference: IFCT code, USDA NDB number, or the recipe id. */
  readonly reference?: string;
  readonly methodology:
    | 'ifct_value'
    | 'usda_value'
    | 'standardized_recipe_calculation'
    | 'label_declaration'
    | 'owner_supplied';
  readonly verifiedAt?: string;
}

export interface FoodItem {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly nameLocal?: string;
  readonly cuisine: Cuisine;
  readonly category: FoodCategory;
  readonly aliases: readonly FoodAlias[];
  readonly defaultVariant: string;
  readonly variants: readonly FoodVariant[];
  readonly verification: VerificationStatus;
  readonly recipeId?: string;
  readonly tags?: readonly string[];
  readonly notes?: string;
}

export interface FoodLogEntry {
  readonly id: string;
  readonly userId: string;
  readonly logDate: string; // ISO date (YYYY-MM-DD), user's local day
  readonly mealType: MealType;
  readonly foodId: string;
  readonly variantSlug: string;
  readonly grams: number;
  readonly nutrition: NutritionTotal;
  readonly source: 'ai_scan' | 'manual_search' | 'saved_meal' | 'recipe' | 'barcode';
  readonly confidence?: number;
  readonly clientCreatedAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string | null;
}

export interface DayTargets {
  readonly kcal: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  readonly fibre_g: number;
}

export interface UserProfileInput {
  readonly sex: 'male' | 'female' | 'other';
  readonly ageYears: number;
  readonly heightCm: number;
  readonly weightKg: number;
  readonly activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  readonly goal: 'lose' | 'maintain' | 'gain';
  readonly rateKgPerWeek?: number;
}
