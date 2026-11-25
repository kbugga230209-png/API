import { getSessionUser } from '@/lib/supabase/server';
import { deriveTargets, getPreferences, getWeightHistory } from '@/lib/data';
import { savePreferencesAction } from '@/lib/actions';
import { bmi, bmiCategoryIndian, idealWeightRangeKg } from '@bharatbite/core';

export const dynamic = 'force-dynamic';

const DIETS = [
  ['vegetarian', 'Vegetarian'],
  ['eggetarian', 'Eggetarian'],
  ['non_vegetarian', 'Non-vegetarian'],
  ['vegan', 'Vegan'],
] as const;

const CUISINES = [
  ['mixed', 'Mixed Indian'],
  ['gujarati', 'Gujarati'],
  ['punjabi', 'Punjabi'],
  ['south_indian', 'South Indian'],
  ['bengali', 'Bengali'],
  ['maharashtrian', 'Maharashtrian'],
  ['north_indian', 'North Indian'],
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!user) return null;

  const [preferences, weights] = await Promise.all([
    getPreferences(supabase, user.id),
    getWeightHistory(supabase, user.id, 1),
  ]);
  const latestWeight = weights.history[0]?.weightKg ?? null;
  const targets = deriveTargets(preferences, latestWeight);
  const age = preferences?.birth_year ? new Date().getFullYear() - preferences.birth_year : 30;
  const bmiValue =
    preferences?.height_cm && latestWeight ? bmi(latestWeight, Number(preferences.height_cm)) : null;
  const range = preferences?.height_cm ? idealWeightRangeKg(Number(preferences.height_cm)) : null;

  return (
    <div style={{ paddingTop: 8 }}>
      {params.ok && <div className="alert alert-success" style={{ marginBottom: 14 }}>{params.ok}</div>}
      {params.error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{params.error}</div>}

      <span className="eyebrow">You</span>
      <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', margin: '6px 0 10px' }}>Goals and settings</h1>
      <p className="muted small" style={{ maxWidth: '62ch' }}>
        These numbers drive your daily targets and the diet planner. They stay on your account — no
        third party sees them.
      </p>

      <div className="grid-2" style={{ marginTop: 20, alignItems: 'start' }}>
        <form action={savePreferencesAction} className="card card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Body and goal</h2>
          <p className="tiny muted" style={{ marginBottom: 14 }}>
            Used with the Mifflin-St Jeor equation and Indian BMI cut-offs (23 overweight, 25 obese).
          </p>

          <div className="row" style={{ gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="height_cm">Height (cm)</label>
              <input
                className="input"
                id="height_cm"
                name="height_cm"
                type="number"
                step="0.5"
                min={100}
                max={230}
                required
                defaultValue={preferences?.height_cm ?? ''}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="weight_kg">Weight (kg)</label>
              <input
                className="input"
                id="weight_kg"
                name="weight_kg"
                type="number"
                step="0.1"
                min={25}
                max={300}
                required
                defaultValue={latestWeight ?? ''}
              />
            </div>
            <div className="field" style={{ width: 90 }}>
              <label htmlFor="age">Age</label>
              <input className="input" id="age" name="age" type="number" min={13} max={100} required defaultValue={age} />
            </div>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="sex">Sex at birth</label>
              <select className="select" id="sex" name="sex" defaultValue={preferences?.sex ?? 'other'}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Prefer not to say</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="activity_level">Activity</label>
              <select className="select" id="activity_level" name="activity_level" defaultValue={preferences?.activity_level ?? 'moderate'}>
                <option value="sedentary">Sedentary (desk, little walking)</option>
                <option value="light">Light (walks, light chores)</option>
                <option value="moderate">Moderate (exercise 3–4×/week)</option>
                <option value="active">Active (daily training)</option>
                <option value="very_active">Very active (physical job + training)</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="goal">Goal</label>
            <select className="select" id="goal" name="goal" defaultValue={preferences?.goal ?? 'maintain'}>
              <option value="lose">Lose weight slowly</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain weight / muscle</option>
            </select>
          </div>

          <hr className="divider" />
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Food preferences</h2>
          <div className="row" style={{ gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="diet_type">Diet</label>
              <select className="select" id="diet_type" name="diet_type" defaultValue={preferences?.diet_type ?? 'vegetarian'}>
                {DIETS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="cuisine_preference">Cuisine</label>
              <select className="select" id="cuisine_preference" name="cuisine_preference" defaultValue={preferences?.cuisine_preference ?? 'mixed'}>
                {CUISINES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="prep_time_minutes">Max cooking time (min)</label>
              <input
                className="input"
                id="prep_time_minutes"
                name="prep_time_minutes"
                type="number"
                min={5}
                max={240}
                step={5}
                defaultValue={preferences?.prep_time_minutes ?? 30}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="meal_frequency">Meals per day</label>
              <input
                className="input"
                id="meal_frequency"
                name="meal_frequency"
                type="number"
                min={1}
                max={8}
                defaultValue={preferences?.meal_frequency ?? 4}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="monthly_budget_inr">Food budget ₹/month</label>
              <input
                className="input"
                id="monthly_budget_inr"
                name="monthly_budget_inr"
                type="number"
                min={0}
                step={500}
                placeholder="optional"
                defaultValue={preferences?.monthly_budget_inr ?? ''}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="theme_mode">Appearance</label>
            <select className="select" id="theme_mode" name="theme_mode" defaultValue={preferences?.theme_mode ?? 'system'}>
              <option value="system">Match my device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 6 }}>
            Save settings
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card card-pad">
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Your daily targets</h2>
            {targets ? (
              <>
                <div className="kv"><span className="muted">Energy</span><span className="mono">{targets.kcal} kcal</span></div>
                <div className="kv"><span className="muted">Protein</span><span className="mono">{targets.protein_g} g</span></div>
                <div className="kv"><span className="muted">Carbohydrate</span><span className="mono">{targets.carbs_g} g</span></div>
                <div className="kv"><span className="muted">Fat</span><span className="mono">{targets.fat_g} g</span></div>
                <div className="kv"><span className="muted">Fibre</span><span className="mono">{targets.fibre_g} g</span></div>
              </>
            ) : (
              <p className="small muted">Fill in height, weight and activity to compute targets.</p>
            )}
            {bmiValue && (
              <p className="tiny muted" style={{ marginTop: 12 }}>
                BMI {bmiValue} ({bmiCategoryIndian(bmiValue)} on Indian cut-offs)
                {range ? ` · healthy range for your height: ${range.min}–${range.max} kg` : ''}
              </p>
            )}
          </div>

          <div className="card card-pad">
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>A note on targets</h2>
            <p className="small muted">
              A 500 kcal deficit is roughly 0.4–0.5 kg a week, but your body is not a spreadsheet.
              Treat these numbers as a starting line for two weeks, then judge by weight trend and
              energy — not by a single day.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
