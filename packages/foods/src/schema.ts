import type { NutritionPer100g } from '@bharatbite/core';

/** Raw ingredient row as authored in `data/ingredients.json`. */
export interface RawIngredient {
  id: string;
  name: string;
  kcal: number;
  p: number;
  c: number;
  fat: number;
  sat: number;
  f: number;
  s: number;
  na: number;
  ref?: string;
  source?: string;
}

export interface RawIngredientFile {
  $schema: string;
  note?: string;
  sourceDefault?: { source: string; methodology: string };
  items: RawIngredient[];
}

/**
 * Composite dish row. `ingredients` is `[ingredientId, grams]` for the *whole*
 * recipe, and `cookedYield` is the total edible weight of the finished dish, so
 * per-100 g values come out of a documented calculation rather than a guess.
 */
export interface RawDish {
  slug: string;
  name: string;
  local?: string;
  lang?: string;
  cuisine: string;
  category: string;
  aliases: [string, string][];
  ingredients: [string, number][];
  cookedYield: number;
  servings: number;
  serving: [string, number, string];
  variantStyles?: ('homemade' | 'restaurant' | 'street')[];
  tags?: string[];
  fatSource?: string;
  notes?: string;
}

export interface RawDishFile {
  $schema: string;
  note?: string;
  items: RawDish[];
}

export interface RawDirect {
  slug: string;
  name: string;
  local?: string;
  lang?: string;
  cuisine: string;
  category: string;
  aliases: [string, string][];
  nutrition: NutritionPer100g;
  serving: [string, number, string];
  source: string;
  methodology: string;
  ref?: string;
  audit?: boolean;
  tags?: string[];
}

export interface RawDirectFile {
  $schema: string;
  note?: string;
  items: RawDirect[];
}
