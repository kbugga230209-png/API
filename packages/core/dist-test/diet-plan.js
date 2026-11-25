import { MEAL_TYPES } from './types.js';
import { scaleNutrition } from './nutrition.js';
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a += 0x6d2b79f5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function conflicts(food, prefs) {
    if (prefs.excludeFoodIds?.includes(food.foodId))
        return true;
    if (food.prepMinutes > prefs.maxPrepMinutes)
        return true;
    if (prefs.dietTags.some((tag) => !food.dietTags.includes(tag)))
        return true;
    const name = food.name.toLowerCase();
    if (prefs.allergies.some((allergy) => name.includes(allergy.toLowerCase())))
        return true;
    return false;
}
/** Meal energy split used across Indian meal patterns (3 meals + 1 snack). */
const SLOT_SHARE = {
    breakfast: 0.25,
    mid_morning: 0.1,
    lunch: 0.32,
    evening_snack: 0.13,
    dinner: 0.3,
    midnight: 0.08,
};
export function defaultMealSlots() {
    return ['breakfast', 'lunch', 'evening_snack', 'dinner'];
}
/**
 * Generates a 7-day plan. Deterministic for a given `seed` so a user can
 * regenerate and get a fresh plan, while tests remain stable.
 *
 * Approach: for every slot pick a dish from the eligible pool for that slot,
 * scale its portion so the slot hits its share of the daily calorie target, and
 * keep dishes from repeating within the week more than twice.
 */
export function generateWeeklyPlan(pool, targets, prefs, seed = 20261125) {
    const rand = mulberry32(seed);
    const slots = prefs.mealSlots.length > 0 ? prefs.mealSlots : defaultMealSlots();
    const shareSum = slots.reduce((sum, slot) => sum + (SLOT_SHARE[slot] ?? 0.25), 0);
    const eligible = pool.filter((food) => {
        if (conflicts(food, prefs))
            return false;
        if (prefs.cuisinePreference !== 'mixed' && food.cuisine !== prefs.cuisinePreference && food.cuisine !== 'pan_indian') {
            return false;
        }
        return true;
    });
    const notes = [];
    if (eligible.length === 0) {
        return { days: [], notes: ['No dishes matched your cuisine, diet and cooking-time filters.'] };
    }
    const usage = new Map();
    const days = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const items = [];
        let cost = 0;
        for (const slot of slots) {
            const slotShare = (SLOT_SHARE[slot] ?? 0.25) / shareSum;
            const slotKcal = targets.kcal * slotShare;
            const slotCostCap = prefs.dailyBudgetInr ? (prefs.dailyBudgetInr * slotShare) : Infinity;
            const slotPool = eligible
                .filter((food) => food.mealSlots.includes(slot))
                .filter((food) => food.costPerServingInr <= slotCostCap || !prefs.dailyBudgetInr);
            // Prefer dishes this person has not eaten three times yet, but a small
            // catalog must still be able to fill every slot rather than leave a gap.
            const varied = slotPool.filter((food) => (usage.get(food.foodId) ?? 0) < 3);
            const candidates = (varied.length > 0 ? varied : slotPool).sort((a, b) => (usage.get(a.foodId) ?? 0) - (usage.get(b.foodId) ?? 0));
            const pick = candidates[Math.floor(rand() * Math.max(1, candidates.length))];
            if (!pick)
                continue;
            const kcalPerGram = pick.nutrition.kcal / 100;
            const rawGrams = kcalPerGram > 0 ? slotKcal / kcalPerGram : pick.servingGrams;
            // Keep portions realistic: never less than half a serving, never more than 2.5.
            const grams = Math.round(Math.min(pick.servingGrams * 2.5, Math.max(pick.servingGrams * 0.5, rawGrams)) / 5) * 5;
            const nutrition = scaleNutrition(pick.nutrition, grams);
            const itemCost = Math.round((pick.costPerServingInr * (grams / pick.servingGrams)) * 10) / 10;
            cost += itemCost;
            items.push({
                mealType: slot,
                foodId: pick.foodId,
                name: pick.name,
                grams,
                nutrition: pick.nutrition,
                costInr: itemCost,
            });
            usage.set(pick.foodId, (usage.get(pick.foodId) ?? 0) + 1);
        }
        const totals = items.reduce((acc, item) => {
            const scaled = scaleNutrition(item.nutrition, item.grams);
            return {
                kcal: Math.round(acc.kcal + scaled.kcal),
                protein_g: Math.round((acc.protein_g + scaled.protein_g) * 10) / 10,
                carbs_g: Math.round((acc.carbs_g + scaled.carbs_g) * 10) / 10,
                fat_g: Math.round((acc.fat_g + scaled.fat_g) * 10) / 10,
                costInr: Math.round((acc.costInr + item.costInr) * 10) / 10,
            };
        }, { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, costInr: 0 });
        days.push({ dayIndex, items, totals });
    }
    if (prefs.dailyBudgetInr) {
        const avgCost = days.reduce((s, d) => s + d.totals.costInr, 0) / Math.max(1, days.length);
        if (avgCost > prefs.dailyBudgetInr) {
            notes.push(`Average planned cost is ₹${avgCost.toFixed(0)}/day, above your ₹${prefs.dailyBudgetInr} budget. Reduce portions or swap in more dal/roti meals.`);
        }
    }
    notes.push('Portion sizes are starting points. Adjust grams in the diary after cooking.');
    return { days, notes };
}
export function groceryListFromPlan(plan) {
    const acc = new Map();
    for (const day of plan.days) {
        for (const item of day.items) {
            const existing = acc.get(item.foodId);
            if (existing) {
                existing.grams += item.grams;
                existing.costInr = Math.round((existing.costInr + item.costInr) * 10) / 10;
            }
            else {
                acc.set(item.foodId, { name: item.name, grams: item.grams, costInr: item.costInr });
            }
        }
    }
    return [...acc.values()].sort((a, b) => b.grams - a.grams);
}
export function mealTypesOrdered() {
    return MEAL_TYPES;
}
//# sourceMappingURL=diet-plan.js.map