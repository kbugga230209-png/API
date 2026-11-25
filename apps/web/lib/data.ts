import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeTargets,
  graceUntilFrom,
  isPlusActive,
  summarizeDay,
  weightTrendKgPerWeek,
  type DayTargets,
  type Entitlement,
  type FoodLogEntry,
  type MealType,
  type NutritionTotal,
  searchFoods,
  type FoodItem,
  type UserProfileInput,
} from '@bharatbite/core';
import { getBundledFoods } from './catalog';

export interface FoodSearchResult {
  slug: string;
  name: string;
  name_local: string | null;
  cuisine: string;
  category: string;
  matched_alias: string;
  score: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface VariantDetail {
  id: string;
  slug: string;
  label: string;
  preparation_style: string;
  consistency: string | null;
  oil_level: string | null;
  source: string;
  methodology: string;
  nutrition: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sat_fat_g: number;
    fibre_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  servings: { label: string; grams: number; household: string | null; is_default: boolean }[];
}

export interface FoodDetail {
  slug: string;
  name: string;
  name_local: string | null;
  cuisine: string;
  category: string;
  verification: string;
  notes: string | null;
  tags: string[];
  variants: VariantDetail[];
  aliases: { alias: string; language: string }[];
}

type Db = SupabaseClient;

/**
 * Search order: Postgres (`search_foods`, trigram + alias aware) first, then the
 * catalog compiled into the app. The fallback keeps search working when the
 * network is down, which on a phone in a kitchen is a normal condition.
 */
export async function searchCatalog(db: Db, query: string, limit = 20): Promise<FoodSearchResult[]> {
  const { data, error } = await db.rpc('search_foods', { q: query, lim: limit });
  if (!error && data && data.length > 0) {
    return (data as FoodSearchResult[]).map((row) => ({
      ...row,
      kcal: Number(row.kcal),
      protein_g: Number(row.protein_g),
      carbs_g: Number(row.carbs_g),
      fat_g: Number(row.fat_g),
    }));
  }
  return searchBundled(query, limit);
}

export function searchBundled(query: string, limit = 20): FoodSearchResult[] {
  return searchFoods(getBundledFoods(), query, { limit }).map((hit) => {
    const variant = hit.food.variants.find((v) => v.slug === hit.food.defaultVariant) ?? hit.food.variants[0];
    return {
      slug: hit.food.id,
      name: hit.food.name,
      name_local: hit.food.nameLocal ?? null,
      cuisine: hit.food.cuisine,
      category: hit.food.category,
      matched_alias: hit.matchedAlias,
      score: hit.score,
      kcal: variant?.nutrition.kcal ?? 0,
      protein_g: variant?.nutrition.protein_g ?? 0,
      carbs_g: variant?.nutrition.carbs_g ?? 0,
      fat_g: variant?.nutrition.fat_g ?? 0,
    };
  });
}

function bundledDetail(slug: string): FoodDetail | null {
  const food: FoodItem | undefined = getBundledFoods().find((f) => f.id === slug);
  if (!food) return null;
  return {
    slug: food.id,
    name: food.name,
    name_local: food.nameLocal ?? null,
    cuisine: food.cuisine,
    category: food.category,
    verification: food.verification,
    notes: food.notes ?? null,
    tags: [...(food.tags ?? [])],
    variants: food.variants.map((variant) => ({
      id: `${food.id}:${variant.slug}`,
      slug: variant.slug,
      label: variant.label,
      preparation_style: variant.preparationStyle ?? '',
      consistency: variant.consistency ?? null,
      oil_level: variant.oilLevel ?? null,
      source: variant.source?.source ?? '',
      methodology: variant.source?.methodology ?? '',
      nutrition: {
        kcal: variant.nutrition.kcal,
        protein_g: variant.nutrition.protein_g,
        carbs_g: variant.nutrition.carbs_g,
        fat_g: variant.nutrition.fat_g,
        sat_fat_g: variant.nutrition.sat_fat_g,
        fibre_g: variant.nutrition.fibre_g,
        sugar_g: variant.nutrition.sugar_g,
        sodium_mg: variant.nutrition.sodium_mg,
      },
      servings: variant.servings.map((serving) => ({
        label: serving.label,
        grams: serving.grams,
        household: serving.household ?? null,
        is_default: Boolean(serving.isDefault),
      })),
    })),
    aliases: food.aliases.map((alias) => ({ alias: alias.alias, language: alias.language })),
  };
}

export async function listFoodsByCategory(db: Db, category: string, limit = 12) {
  const { data } = await db
    .from('food_items')
    .select('slug, name, name_local, cuisine, category, verification')
    .eq('category', category)
    .order('name')
    .limit(limit);
  if (data && data.length > 0) return data;
  return getBundledFoods()
    .filter((food) => food.category === category)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((food) => ({
      slug: food.id,
      name: food.name,
      name_local: food.nameLocal ?? null,
      cuisine: food.cuisine,
      category: food.category,
      verification: food.verification,
    }));
}

export async function getFoodDetail(db: Db, slug: string): Promise<FoodDetail | null> {
  const { data: food } = await db
    .from('food_items')
    .select('slug, name, name_local, cuisine, category, verification, notes, tags')
    .eq('slug', slug)
    .maybeSingle();
  if (!food) return bundledDetail(slug);

  const { data: variants } = await db
    .from('food_variants')
    .select(
      'id, slug, label, preparation_style, consistency, oil_level, source, methodology, food_nutrition(kcal, protein_g, carbs_g, fat_g, sat_fat_g, fibre_g, sugar_g, sodium_mg), food_servings(label, grams, household, is_default)',
    )
    .eq('food_slug', slug)
    .order('is_default', { ascending: false });

  const { data: aliases } = await db.from('food_aliases').select('alias, language').eq('food_slug', slug);

  return {
    ...(food as Omit<FoodDetail, 'variants' | 'aliases'>),
    variants: (variants ?? []).map((v) => {
      const nutritionRaw = (v as { food_nutrition?: unknown }).food_nutrition;
      const nutrition = Array.isArray(nutritionRaw) ? nutritionRaw[0] : nutritionRaw;
      return {
        id: v.id,
        slug: v.slug,
        label: v.label,
        preparation_style: v.preparation_style,
        consistency: v.consistency,
        oil_level: v.oil_level,
        source: v.source,
        methodology: v.methodology,
        nutrition: {
          kcal: Number((nutrition as { kcal?: number } | null)?.kcal ?? 0),
          protein_g: Number((nutrition as { protein_g?: number } | null)?.protein_g ?? 0),
          carbs_g: Number((nutrition as { carbs_g?: number } | null)?.carbs_g ?? 0),
          fat_g: Number((nutrition as { fat_g?: number } | null)?.fat_g ?? 0),
          sat_fat_g: Number((nutrition as { sat_fat_g?: number } | null)?.sat_fat_g ?? 0),
          fibre_g: Number((nutrition as { fibre_g?: number } | null)?.fibre_g ?? 0),
          sugar_g: Number((nutrition as { sugar_g?: number } | null)?.sugar_g ?? 0),
          sodium_mg: Number((nutrition as { sodium_mg?: number } | null)?.sodium_mg ?? 0),
        },
        servings: ((v as { food_servings?: VariantDetail['servings'] }).food_servings ?? []).map((s) => ({
          ...s,
          grams: Number(s.grams),
        })),
      };
    }),
    aliases: aliases ?? [],
  };
}

export interface EntitlementRow {
  status: string;
  plan_code: string;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
}

export function toEntitlement(row: EntitlementRow | null): Entitlement {
  if (!row) {
    return {
      status: 'free',
      planCode: 'free',
      currentPeriodEnd: null,
      graceUntil: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(0).toISOString(),
    };
  }
  return {
    status: row.status as Entitlement['status'],
    planCode: row.plan_code as Entitlement['planCode'],
    currentPeriodEnd: row.current_period_end,
    graceUntil: row.grace_until,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    updatedAt: row.updated_at,
  };
}

export async function getEntitlement(db: Db, userId: string) {
  const { data } = await db
    .from('entitlements')
    .select('status, plan_code, current_period_start, current_period_end, grace_until, cancel_at_period_end, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  const entitlement = toEntitlement(data as EntitlementRow | null);
  return { entitlement, plusActive: isPlusActive(entitlement) };
}

export interface PreferencesRow {
  theme_mode: 'light' | 'dark' | 'system';
  theme_id: string;
  accent_color: string;
  diet_type: string;
  cuisine_preference: string;
  allergies: string[];
  restrictions: string[];
  monthly_budget_inr: number | null;
  prep_time_minutes: number;
  meal_frequency: number;
  height_cm: number | null;
  sex: string | null;
  birth_year: number | null;
  activity_level: UserProfileInput['activityLevel'];
  goal: UserProfileInput['goal'];
  target_weight_kg: number | null;
  daily_kcal_target: number | null;
  protein_target_g: number | null;
  carb_target_g: number | null;
  fat_target_g: number | null;
  fibre_target_g: number | null;
}

export async function getPreferences(db: Db, userId: string) {
  const { data } = await db.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
  return (data as PreferencesRow | null) ?? null;
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  onboarding_completed: boolean;
  ai_model_installed: boolean;
  ai_model_version: string | null;
  timezone: string;
}

export async function getProfile(db: Db, userId: string) {
  const { data } = await db
    .from('profiles')
    .select('id, display_name, onboarding_completed, ai_model_installed, ai_model_version, timezone')
    .eq('id', userId)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export function deriveTargets(
  preferences: PreferencesRow | null,
  latestWeightKg: number | null,
): DayTargets | null {
  if (preferences?.daily_kcal_target && preferences.protein_target_g && preferences.carb_target_g && preferences.fat_target_g) {
    return {
      kcal: preferences.daily_kcal_target,
      protein_g: preferences.protein_target_g,
      carbs_g: preferences.carb_target_g,
      fat_g: preferences.fat_target_g,
      fibre_g: preferences.fibre_target_g ?? Math.round((preferences.daily_kcal_target / 1000) * 14),
    };
  }
  const weight = latestWeightKg ?? 70;
  const age = preferences?.birth_year ? new Date().getFullYear() - preferences.birth_year : 30;
  if (!preferences?.height_cm) return null;
  return computeTargets({
    sex: (preferences.sex as UserProfileInput['sex']) || 'other',
    ageYears: Math.min(100, Math.max(14, age)),
    heightCm: Number(preferences.height_cm),
    weightKg: weight,
    activityLevel: preferences.activity_level,
    goal: preferences.goal,
  });
}

export interface LoggedEntry extends FoodLogEntry {
  foodName: string;
  variantLabel: string;
}

export async function getDayEntries(db: Db, userId: string, date: string): Promise<LoggedEntry[]> {
  const { data } = await db
    .from('food_logs')
    .select(
      'id, user_id, log_date, meal_type, food_slug, variant_slug, grams, kcal, protein_g, carbs_g, fat_g, sat_fat_g, fibre_g, sugar_g, sodium_mg, source, confidence, client_created_at, updated_at, deleted_at',
    )
    .eq('user_id', userId)
    .eq('log_date', date)
    .is('deleted_at', null)
    .order('client_created_at', { ascending: true });

  const rows = data ?? [];
  const slugs = [...new Set(rows.map((r) => r.food_slug))];
  let names = new Map<string, { name: string; variantLabel: string }>();
  if (slugs.length) {
    const { data: foods } = await db.from('food_items').select('slug, name').in('slug', slugs);
    const { data: variants } = await db
      .from('food_variants')
      .select('food_slug, slug, label')
      .in('food_slug', slugs);
    names = new Map(
      (foods ?? []).map((f) => [
        f.slug,
        {
          name: f.name,
          variantLabel:
            (variants ?? []).find((v) => v.food_slug === f.slug && v.slug === (rows.find((r) => r.food_slug === f.slug)?.variant_slug ?? ''))?.label ?? '',
        },
      ]),
    );
  }

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    logDate: row.log_date,
    mealType: row.meal_type as MealType,
    foodId: row.food_slug,
    variantSlug: row.variant_slug,
    grams: Number(row.grams),
    nutrition: {
      grams: Number(row.grams),
      kcal: Number(row.kcal),
      protein_g: Number(row.protein_g),
      carbs_g: Number(row.carbs_g),
      fat_g: Number(row.fat_g),
      sat_fat_g: Number(row.sat_fat_g),
      fibre_g: Number(row.fibre_g),
      sugar_g: Number(row.sugar_g),
      sodium_mg: Number(row.sodium_mg),
    } satisfies NutritionTotal,
    source: row.source,
    confidence: row.confidence ? Number(row.confidence) : undefined,
    clientCreatedAt: row.client_created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    foodName: names.get(row.food_slug)?.name ?? row.food_slug,
    variantLabel: names.get(row.food_slug)?.variantLabel ?? row.variant_slug,
  }));
}

export async function getDaySummary(db: Db, userId: string, date: string, targets: DayTargets | null) {
  const entries = await getDayEntries(db, userId, date);
  return { entries, summary: summarizeDay(date, entries, targets) };
}

export async function getWeightHistory(db: Db, userId: string, limit = 30) {
  const { data } = await db
    .from('weight_history')
    .select('measured_on, weight_kg')
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .limit(limit);
  const history = (data ?? []).map((r) => ({ measuredOn: r.measured_on as string, weightKg: Number(r.weight_kg) }));
  return { history, trend: weightTrendKgPerWeek(history) };
}

export async function getRecentFrequencies(db: Db, userId: string, days = 21) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await db
    .from('food_logs')
    .select('food_slug')
    .eq('user_id', userId)
    .gte('log_date', since)
    .is('deleted_at', null)
    .limit(500);
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.food_slug as string, (counts.get(row.food_slug as string) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

export async function getDietPlan(db: Db, userId: string, weekStart: string) {
  const { data: plan } = await db
    .from('diet_plans')
    .select('id, week_start, title, notes, estimated_cost_inr, preferences_snapshot, targets_snapshot')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (!plan) return null;
  const [{ data: meals }, { data: groceries }] = await Promise.all([
    db.from('diet_plan_meals').select('*').eq('plan_id', plan.id).order('day_index'),
    db.from('grocery_items').select('*').eq('plan_id', plan.id).order('name'),
  ]);
  return { plan, meals: meals ?? [], groceries: groceries ?? [] };
}

export function weekStartOf(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function graceUntil(periodEnd: string): string {
  return graceUntilFrom(new Date(periodEnd));
}
