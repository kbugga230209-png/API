'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  computeTargets,
  generateWeeklyPlan,
  groceryListFromPlan,
  scaleNutrition,
  type MealType,
  type PlannerPreferences,
} from '@bharatbite/core';
import { createServerSupabase } from './supabase/server';
import { getEntitlement, getFoodDetail, getPreferences, getWeightHistory, weekStartOf } from './data';
import { getPlannerPool } from './catalog';

const MEALS: MealType[] = ['breakfast', 'mid_morning', 'lunch', 'evening_snack', 'dinner', 'midnight'];

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function requireUser() {
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect('/login?next=/app');
  return { supabase, user };
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/app');
  if (!email.includes('@') || password.length < 6) {
    redirect(`/login?error=${encodeURIComponent('Enter a valid email and a password of at least 6 characters.')}`);
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(next.startsWith('/') ? next : '/app');
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('display_name') ?? '').trim();
  if (!email.includes('@') || password.length < 8) {
    redirect(`/login?mode=signup&error=${encodeURIComponent('Use a valid email and a password of at least 8 characters.')}`);
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email.split('@')[0] } },
  });
  if (error) redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  if (!data.session) {
    redirect(
      `/login?notice=${encodeURIComponent('Account created. Check your inbox to confirm your email, then sign in.')}`,
    );
  }
  redirect('/app/onboarding');
}

export async function signOutAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/');
}

export async function logFoodAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const slug = String(formData.get('slug') ?? '');
  const variantSlug = String(formData.get('variant') ?? '');
  const mealType = String(formData.get('meal') ?? 'lunch') as MealType;
  const grams = Number(formData.get('grams') ?? 0);
  const date = String(formData.get('date') ?? new Date().toISOString().slice(0, 10));
  const returnTo = String(formData.get('returnTo') ?? '/app/diary');

  if (!MEALS.includes(mealType)) fail(returnTo, 'Choose a valid meal.');
  if (!Number.isFinite(grams) || grams <= 0 || grams > 2000) fail(returnTo, 'Enter a portion between 1 and 2000 g.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(returnTo, 'Invalid date.');

  const detail = await getFoodDetail(supabase, slug);
  if (!detail) fail(returnTo, 'That food is not in the database.');
  const variant = detail.variants.find((v) => v.slug === variantSlug) ?? detail.variants[0];
  if (!variant) fail(returnTo, 'That preparation is not available.');

  const scaled = scaleNutrition(variant.nutrition, grams);
  const { error } = await supabase.from('food_logs').insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    log_date: date,
    meal_type: mealType,
    food_slug: slug,
    variant_slug: variant.slug,
    grams,
    kcal: scaled.kcal,
    protein_g: scaled.protein_g,
    carbs_g: scaled.carbs_g,
    fat_g: scaled.fat_g,
    sat_fat_g: scaled.sat_fat_g,
    fibre_g: scaled.fibre_g,
    sugar_g: scaled.sugar_g,
    sodium_mg: scaled.sodium_mg,
    source: 'manual_search',
  });
  if (error) fail(returnTo, error.message);

  revalidatePath('/app');
  revalidatePath('/app/diary');
  redirect(`${returnTo}?ok=${encodeURIComponent(`Added ${detail.name} (${grams} g)`)}`);
}

export async function deleteLogAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get('id') ?? '');
  const returnTo = String(formData.get('returnTo') ?? '/app/diary');
  if (!id) fail(returnTo, 'Missing entry.');
  const { error } = await supabase
    .from('food_logs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) fail(returnTo, error.message);
  revalidatePath('/app');
  revalidatePath('/app/diary');
  redirect(`${returnTo}?ok=${encodeURIComponent('Entry removed')}`);
}

export async function saveWeightAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const weight = Number(formData.get('weight_kg') ?? 0);
  const measuredOn = String(formData.get('measured_on') ?? new Date().toISOString().slice(0, 10));
  if (!Number.isFinite(weight) || weight < 20 || weight > 300) fail('/app', 'Enter a weight between 20 and 300 kg.');
  const { error } = await supabase.from('weight_history').upsert(
    { user_id: user.id, measured_on: measuredOn, weight_kg: weight },
    { onConflict: 'user_id,measured_on' },
  );
  if (error) fail('/app', error.message);
  revalidatePath('/app');
  redirect(`/app?ok=${encodeURIComponent('Weight logged')}`);
}

export async function savePreferencesAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const heightCm = Number(formData.get('height_cm') ?? 0);
  const weightKg = Number(formData.get('weight_kg') ?? 0);
  const age = Number(formData.get('age') ?? 0);
  const sex = String(formData.get('sex') ?? 'other');
  const activityLevel = String(formData.get('activity_level') ?? 'moderate');
  const goal = String(formData.get('goal') ?? 'maintain');
  const dietType = String(formData.get('diet_type') ?? 'vegetarian');
  const cuisine = String(formData.get('cuisine_preference') ?? 'mixed');
  const budgetRaw = String(formData.get('monthly_budget_inr') ?? '').trim();
  const prepMinutes = Number(formData.get('prep_time_minutes') ?? 30);
  const mealFrequency = Number(formData.get('meal_frequency') ?? 4);
  const themeMode = String(formData.get('theme_mode') ?? 'system');

  if (!['light', 'dark', 'system'].includes(themeMode)) fail('/app/settings', 'Invalid theme.');
  if (heightCm < 100 || heightCm > 230) fail('/app/settings', 'Height must be between 100 and 230 cm.');
  if (weightKg < 25 || weightKg > 300) fail('/app/settings', 'Weight must be between 25 and 300 kg.');
  if (age < 13 || age > 100) fail('/app/settings', 'Age must be between 13 and 100.');

  const targets = computeTargets({
    sex: sex as 'male' | 'female' | 'other',
    ageYears: age,
    heightCm,
    weightKg,
    activityLevel: activityLevel as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
    goal: goal as 'lose' | 'maintain' | 'gain',
  });

  const { error } = await supabase
    .from('user_preferences')
    .update({
      theme_mode: themeMode,
      diet_type: dietType,
      cuisine_preference: cuisine,
      monthly_budget_inr: budgetRaw ? Number(budgetRaw) : null,
      prep_time_minutes: Math.min(240, Math.max(5, prepMinutes)),
      meal_frequency: Math.min(8, Math.max(1, mealFrequency)),
      height_cm: heightCm,
      sex,
      birth_year: new Date().getFullYear() - age,
      activity_level: activityLevel,
      goal,
      daily_kcal_target: targets.kcal,
      protein_target_g: targets.protein_g,
      carb_target_g: targets.carbs_g,
      fat_target_g: targets.fat_g,
      fibre_target_g: targets.fibre_g,
    })
    .eq('user_id', user.id);
  if (error) fail('/app/settings', error.message);

  await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
  await supabase.from('weight_history').upsert(
    { user_id: user.id, measured_on: new Date().toISOString().slice(0, 10), weight_kg: weightKg },
    { onConflict: 'user_id,measured_on' },
  );

  revalidatePath('/app');
  revalidatePath('/app/settings');
  redirect(`/app/settings?ok=${encodeURIComponent('Preferences saved')}`);
}

export async function generatePlanAction() {
  const { supabase, user } = await requireUser();
  const { plusActive } = await getEntitlement(supabase, user.id);
  if (!plusActive) {
    redirect(`/app/plus?reason=${encodeURIComponent('The diet planner is a BharatBite Plus feature.')}`);
  }

  const preferences = await getPreferences(supabase, user.id);
  const { history } = await getWeightHistory(supabase, user.id, 1);
  const latestWeight = history[0]?.weightKg ?? 70;
  const age = preferences?.birth_year ? new Date().getFullYear() - preferences.birth_year : 30;
  if (!preferences?.height_cm) {
    redirect('/app/settings?error=' + encodeURIComponent('Add your height and weight before generating a plan.'));
  }

  const targets = computeTargets({
    sex: (preferences.sex as 'male' | 'female' | 'other') || 'other',
    ageYears: Math.min(100, Math.max(14, age)),
    heightCm: Number(preferences.height_cm),
    weightKg: latestWeight,
    activityLevel: preferences.activity_level,
    goal: preferences.goal,
  });

  const plannerPrefs: PlannerPreferences = {
    cuisinePreference: (preferences.cuisine_preference as PlannerPreferences['cuisinePreference']) ?? 'mixed',
    dietTags: preferences.diet_type === 'vegan' ? ['vegan'] : preferences.diet_type === 'non_vegetarian' ? [] : ['vegetarian'],
    allergies: preferences.allergies ?? [],
    maxPrepMinutes: preferences.prep_time_minutes ?? 45,
    dailyBudgetInr: preferences.monthly_budget_inr ? Math.round(preferences.monthly_budget_inr / 30) : null,
    mealSlots: ['breakfast', 'lunch', 'evening_snack', 'dinner'],
  };

  // The pool is compiled in, so planning never depends on a database round-trip.
  const pool = getPlannerPool();
  const plan = generateWeeklyPlan(pool, targets, plannerPrefs, Date.now() % 100000);

  if (plan.days.length === 0) {
    redirect('/app/planner?error=' + encodeURIComponent(plan.notes[0] ?? 'No dishes matched your filters.'));
  }

  const weekStart = weekStartOf(new Date());
  const totalCost = Math.round(plan.days.reduce((sum, d) => sum + d.totals.costInr, 0) * 100) / 100;

  await supabase.from('diet_plans').delete().eq('user_id', user.id).eq('week_start', weekStart);
  const { data: inserted, error } = await supabase
    .from('diet_plans')
    .insert({
      user_id: user.id,
      week_start: weekStart,
      title: 'Your Indian week',
      status: 'active',
      preferences_snapshot: plannerPrefs as unknown as Record<string, unknown>,
      targets_snapshot: targets as unknown as Record<string, unknown>,
      notes: plan.notes,
      estimated_cost_inr: totalCost,
    })
    .select('id')
    .single();
  if (error || !inserted) redirect('/app/planner?error=' + encodeURIComponent(error?.message ?? 'Could not save plan.'));

  const mealRows = plan.days.flatMap((day) =>
    day.items.map((item) => ({
      plan_id: inserted.id,
      day_index: day.dayIndex,
      meal_type: item.mealType,
      food_slug: item.foodId,
      grams: item.grams,
      kcal: Math.round(item.nutrition.kcal * (item.grams / 100) * 10) / 10,
      protein_g: Math.round(item.nutrition.protein_g * (item.grams / 100) * 10) / 10,
      carbs_g: Math.round(item.nutrition.carbs_g * (item.grams / 100) * 10) / 10,
      fat_g: Math.round(item.nutrition.fat_g * (item.grams / 100) * 10) / 10,
      cost_inr: item.costInr,
    })),
  );
  if (mealRows.length) await supabase.from('diet_plan_meals').insert(mealRows);

  const grocery = groceryListFromPlan(plan);
  if (grocery.length) {
    await supabase.from('grocery_items').insert(
      grocery.map((g) => ({
        plan_id: inserted.id,
        name: g.name,
        grams: Math.round(g.grams),
        cost_inr: g.costInr,
      })),
    );
  }

  revalidatePath('/app/planner');
  redirect(`/app/planner?ok=${encodeURIComponent('New 7-day plan created')}`);
}

/** Logging a planned meal counts it in the diary without retyping grams. */
export async function logPlannedMealAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const slug = String(formData.get('slug') ?? '');
  const grams = Number(formData.get('grams') ?? 0);
  const mealType = String(formData.get('meal') ?? 'lunch') as MealType;
  if (!slug || !Number.isFinite(grams) || grams <= 0) fail('/app/planner', 'Invalid planned meal.');

  const detail = await getFoodDetail(supabase, slug);
  if (!detail) fail('/app/planner', 'Food missing from the catalog.');
  const variant = detail.variants.find((v) => v.slug === 'homemade') ?? detail.variants[0];
  if (!variant) fail('/app/planner', 'Preparation missing.');

  const scaled = scaleNutrition(variant.nutrition, grams);
  const { error } = await supabase.from('food_logs').insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    log_date: new Date().toISOString().slice(0, 10),
    meal_type: mealType,
    food_slug: slug,
    variant_slug: variant.slug,
    grams,
    kcal: scaled.kcal,
    protein_g: scaled.protein_g,
    carbs_g: scaled.carbs_g,
    fat_g: scaled.fat_g,
    sat_fat_g: scaled.sat_fat_g,
    fibre_g: scaled.fibre_g,
    sugar_g: scaled.sugar_g,
    sodium_mg: scaled.sodium_mg,
    source: 'recipe',
  });
  if (error) fail('/app/planner', error.message);
  revalidatePath('/app');
  revalidatePath('/app/planner');
  redirect(`/app/planner?ok=${encodeURIComponent(`${detail.name} logged to today's diary`)}`);
}

/** Removes every health record the user owns. Account login itself is kept. */
export async function wipeHealthDataAction() {
  const { supabase, user } = await requireUser();
  const errors: string[] = [];
  for (const table of ['food_logs', 'weight_history', 'saved_meals', 'diet_plans', 'meal_logs'] as const) {
    const { error } = await supabase.from(table).delete().eq('user_id', user.id);
    if (error) errors.push(`${table}: ${error.message}`);
  }
  await supabase
    .from('user_preferences')
    .update({
      height_cm: null,
      sex: null,
      birth_year: null,
      daily_kcal_target: null,
      protein_target_g: null,
      carb_target_g: null,
      fat_target_g: null,
      fibre_target_g: null,
      target_weight_kg: null,
      allergies: [],
      restrictions: [],
    })
    .eq('user_id', user.id);
  await supabase.from('profiles').update({ onboarding_completed: false }).eq('id', user.id);
  revalidatePath('/app');
  revalidatePath('/app/account');
  if (errors.length) fail('/app/account', `Some data could not be removed: ${errors.join('; ')}`);
  redirect(`/app/account?ok=${encodeURIComponent('All diary, weight and plan data deleted')}`);
}
