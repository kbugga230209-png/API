const ZERO = {
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    sat_fat_g: 0,
    fibre_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
};
/** Atwater factors (kcal/g). Used only to sanity-check provenance, not to derive values. */
export const ATWATER = { protein: 4, carbs: 4, fat: 9 };
export function emptyNutrition() {
    return { ...ZERO };
}
export function nutritionFields() {
    return ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'sat_fat_g', 'fibre_g', 'sugar_g', 'sodium_mg'];
}
function round(value, decimals) {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}
/**
 * Scale a per-100 g composition to an arbitrary edible weight.
 * Rounding happens once, at the end, to avoid accumulation drift.
 */
export function scaleNutrition(per100g, grams) {
    if (!Number.isFinite(grams) || grams < 0) {
        throw new RangeError(`grams must be a finite non-negative number, received ${grams}`);
    }
    const factor = grams / 100;
    return {
        grams: round(grams, 1),
        kcal: round(per100g.kcal * factor, 1),
        protein_g: round(per100g.protein_g * factor, 2),
        carbs_g: round(per100g.carbs_g * factor, 2),
        fat_g: round(per100g.fat_g * factor, 2),
        sat_fat_g: round(per100g.sat_fat_g * factor, 2),
        fibre_g: round(per100g.fibre_g * factor, 2),
        sugar_g: round(per100g.sugar_g * factor, 2),
        sodium_mg: round(per100g.sodium_mg * factor, 1),
    };
}
/** Scale by number of servings where a serving has a known gram weight. */
export function scaleByServings(per100g, serving, servings) {
    if (!Number.isFinite(servings) || servings < 0) {
        throw new RangeError(`servings must be a finite non-negative number, received ${servings}`);
    }
    return scaleNutrition(per100g, serving.grams * servings);
}
export function addNutrition(a, b) {
    return {
        grams: round(a.grams + b.grams, 1),
        kcal: round(a.kcal + b.kcal, 1),
        protein_g: round(a.protein_g + b.protein_g, 2),
        carbs_g: round(a.carbs_g + b.carbs_g, 2),
        fat_g: round(a.fat_g + b.fat_g, 2),
        sat_fat_g: round(a.sat_fat_g + b.sat_fat_g, 2),
        fibre_g: round(a.fibre_g + b.fibre_g, 2),
        sugar_g: round(a.sugar_g + b.sugar_g, 2),
        sodium_mg: round(a.sodium_mg + b.sodium_mg, 1),
    };
}
export function sumNutrition(items) {
    return items.reduce((acc, item) => addNutrition(acc, item), { ...ZERO, grams: 0 });
}
export function toPer100g(total) {
    if (total.grams <= 0)
        throw new RangeError('cannot derive per-100g values from a zero-weight total');
    const factor = 100 / total.grams;
    return {
        kcal: round(total.kcal * factor, 1),
        protein_g: round(total.protein_g * factor, 2),
        carbs_g: round(total.carbs_g * factor, 2),
        fat_g: round(total.fat_g * factor, 2),
        sat_fat_g: round(total.sat_fat_g * factor, 2),
        fibre_g: round(total.fibre_g * factor, 2),
        sugar_g: round(total.sugar_g * factor, 2),
        sodium_mg: round(total.sodium_mg * factor, 1),
    };
}
/**
 * Standardized recipe calculation.
 *
 * The cooked dish weight (`cookedYieldGrams`) drives the per-100 g result, which
 * is what the app stores in `food_nutrition`. This is the same methodology used
 * by IFCT for composite dishes: sum raw ingredient nutrients, divide by the
 * cooked edible yield.
 */
export function computeRecipePer100g(recipe, ingredientNutrition) {
    if (recipe.ingredients.length === 0)
        throw new Error(`recipe ${recipe.id} has no ingredients`);
    if (recipe.cookedYieldGrams <= 0)
        throw new RangeError(`recipe ${recipe.id} needs a positive cooked yield`);
    let total = { ...ZERO, grams: 0 };
    for (const ingredient of recipe.ingredients) {
        const per100g = ingredientNutrition.get(ingredient.foodId);
        if (!per100g) {
            throw new Error(`recipe ${recipe.id} references unknown ingredient "${ingredient.foodId}"`);
        }
        total = addNutrition(total, scaleNutrition(per100g, ingredient.grams));
    }
    if (recipe.addedFatGrams && recipe.addedFatGrams > 0) {
        const ghee = ingredientNutrition.get('ghee');
        if (!ghee)
            throw new Error('recipe declares added fat but no "ghee" composition is available');
        total = addNutrition(total, scaleNutrition(ghee, recipe.addedFatGrams));
    }
    const factor = 100 / recipe.cookedYieldGrams;
    return {
        kcal: round(total.kcal * factor, 1),
        protein_g: round(total.protein_g * factor, 2),
        carbs_g: round(total.carbs_g * factor, 2),
        fat_g: round(total.fat_g * factor, 2),
        sat_fat_g: round(total.sat_fat_g * factor, 2),
        fibre_g: round(total.fibre_g * factor, 2),
        sugar_g: round(total.sugar_g * factor, 2),
        sodium_mg: round(total.sodium_mg * factor, 1),
    };
}
/**
 * Energy implied by the declared macros. A large gap usually means a typo in a
 * data row or missing alcohol/organic-acid energy, so the seed pipeline fails
 * the build on it rather than shipping a wrong number.
 */
export function macroEnergyKcal(n) {
    return n.protein_g * ATWATER.protein + n.carbs_g * ATWATER.carbs + n.fat_g * ATWATER.fat;
}
export function energyDeviationPct(n) {
    if (n.kcal <= 0)
        return 0;
    return Math.abs(macroEnergyKcal(n) - n.kcal) / n.kcal;
}
export function isPlausibleComposition(n, tolerance = 0.2) {
    if (n.kcal < 0 || n.protein_g < 0 || n.carbs_g < 0 || n.fat_g < 0)
        return false;
    if (n.protein_g + n.carbs_g + n.fat_g > 100.5)
        return false;
    if (n.sat_fat_g > n.fat_g + 0.05)
        return false;
    if (n.sugar_g > n.carbs_g + 0.05)
        return false;
    // Salt and leavening agents legitimately carry ~27-39 g sodium per 100 g.
    if (n.sodium_mg > 40000)
        return false;
    // Very low-energy foods (water, black coffee) legitimately deviate.
    if (n.kcal > 20 && energyDeviationPct(n) > tolerance)
        return false;
    return true;
}
/** Grams in one serving, preferring the explicit default serving. */
export function defaultServingGrams(servings, fallback = 100) {
    if (servings.length === 0)
        return fallback;
    const preferred = servings.find((s) => s.isDefault) ?? servings[0];
    return preferred ? preferred.grams : fallback;
}
//# sourceMappingURL=nutrition.js.map