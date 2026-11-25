import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import {
  deriveTargets,
  getDaySummary,
  getPreferences,
  getProfile,
  getRecentFrequencies,
  getWeightHistory,
} from '@/lib/data';
import { saveWeightAction } from '@/lib/actions';
import { calorieShare, macroBars, mealTypesOrdered } from '@bharatbite/core';
import { getBundledFoods } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

const GREETING_MEALS = mealTypesOrdered();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!user) return null;

  const date = today();
  const preferencesPromise = getPreferences(supabase, user.id);
  const weightsPromise = getWeightHistory(supabase, user.id, 30);
  const [profile, preferences, weights, recent] = await Promise.all([
    getProfile(supabase, user.id),
    preferencesPromise,
    weightsPromise,
    getRecentFrequencies(supabase, user.id, 21),
  ]);

  const latestWeight = weights.history[0]?.weightKg ?? null;
  const targets = deriveTargets(preferences, latestWeight);
  const { entries, summary } = await getDaySummary(supabase, user.id, date, targets);

  const share = calorieShare(summary.totals.kcal, targets);
  const macros = macroBars(summary.totals, targets);
  const foods = getBundledFoods();
  const recentFoods = recent
    .map(([slug, count]) => ({ food: foods.find((f) => f.id === slug), count }))
    .filter((item) => Boolean(item.food))
    .slice(0, 4);

  const name = profile?.display_name ?? user.email?.split('@')[0] ?? 'there';
  const hour = new Date().getUTCHours() + 5.5;
  const greeting = hour < 11 ? 'Good morning' : hour < 16 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ paddingTop: 8 }}>
      {params.ok && <div className="alert alert-success" style={{ marginBottom: 16 }}>{params.ok}</div>}
      {params.error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{params.error}</div>}

      <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <span className="eyebrow">{new Date().toDateString()}</span>
          <h1 style={{ fontSize: 'clamp(26px, 3.4vw, 34px)', marginTop: 6 }}>
            {greeting}, {name}
          </h1>
        </div>
        <Link href="/app/diary" className="btn btn-primary btn-sm">
          Add food
        </Link>
      </div>

      {!targets && (
        <div className="alert" style={{ marginTop: 18 }}>
          <strong>Set your goals.</strong> Add height, weight and activity once and BharatBite will
          compute a daily target with Indian BMI cut-offs.{' '}
          <Link href="/app/settings" style={{ textDecoration: 'underline' }}>
            Open settings →
          </Link>
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 22, alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <span className="eyebrow">Energy today</span>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 44, lineHeight: 1.05, marginTop: 6 }}>
                {Math.round(summary.totals.kcal)}
                {targets && <span style={{ fontSize: 17, color: 'var(--muted)', fontFamily: 'var(--sans)' }}> / {targets.kcal} kcal</span>}
              </div>
            </div>
            <div className="tiny muted" style={{ textAlign: 'right' }}>
              {summary.entryCount} {summary.entryCount === 1 ? 'entry' : 'entries'}
              {targets && (
                <>
                  <br />
                  {summary.remaining && summary.remaining.kcal >= 0
                    ? `${summary.remaining.kcal} kcal left`
                    : `${Math.abs(summary.remaining?.kcal ?? 0)} kcal over`}
                </>
              )}
            </div>
          </div>

          <div className={share > 1 ? 'progress gold' : 'progress'} style={{ marginTop: 16 }}>
            <span style={{ width: `${Math.min(100, share * 100)}%` }} />
          </div>

          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Protein', summary.totals.protein_g, targets?.protein_g ?? null, macros.protein, 'var(--accent)'],
              ['Carbs', summary.totals.carbs_g, targets?.carbs_g ?? null, macros.carbs, 'var(--gold)'],
              ['Fat', summary.totals.fat_g, targets?.fat_g ?? null, macros.fat, 'var(--green)'],
              ['Fibre', summary.totals.fibre_g, targets?.fibre_g ?? null, null, 'var(--ink-soft)'],
            ].map(([label, value, target, bar, color]) => {
              const pct =
                typeof bar === 'number'
                  ? bar * 100
                  : typeof target === 'number' && target > 0
                    ? Math.min(100, (Number(value) / target) * 100)
                    : 0;
              return (
                <div key={String(label)}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span className="muted">{String(label)}</span>
                    <span className="mono">
                      {Math.round(Number(value) * 10) / 10} g
                      {typeof target === 'number' ? ` / ${target} g` : ''}
                    </span>
                  </div>
                  <div className="progress" style={{ marginTop: 5, height: 6 }}>
                    <span style={{ width: `${Math.min(100, pct)}%`, background: String(color) }} />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="tiny muted" style={{ marginTop: 16 }}>
            Sodium {Math.round(summary.totals.sodium_mg)} mg · Sat fat{' '}
            {Math.round(summary.totals.sat_fat_g * 10) / 10} g · Sugar{' '}
            {Math.round(summary.totals.sugar_g * 10) / 10} g
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card card-pad">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ fontSize: 18 }}>Weight</h2>
              <Link href="/app/settings" className="tiny muted">
                history →
              </Link>
            </div>
            <p className="small muted" style={{ marginTop: 6 }}>
              {latestWeight ? `${latestWeight} kg` : 'Not recorded yet'}
              {weights.trend !== null && (
                <> · {weights.trend > 0 ? '+' : ''}{weights.trend} kg/week (30 d)</>
              )}
            </p>
            <form action={saveWeightAction} className="inline-form" style={{ marginTop: 12 }}>
              <input
                className="input"
                type="number"
                name="weight_kg"
                step="0.1"
                min={20}
                max={300}
                placeholder="kg"
                required
                aria-label="Weight in kilograms"
              />
              <input className="input" type="date" name="measured_on" defaultValue={date} max={date} aria-label="Date" />
              <button className="btn btn-ghost btn-sm" type="submit">
                Log
              </button>
            </form>
            {weights.history.length > 1 && (
              <div className="row row-wrap" style={{ marginTop: 12, gap: 6 }}>
                {weights.history.slice(0, 8).reverse().map((point) => (
                  <span key={point.measuredOn} className="chip tiny">
                    {point.weightKg}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Quick add</h2>
            {recentFoods.length === 0 ? (
              <p className="small muted">
                Log a few meals and your frequent dishes appear here for one-tap adding.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentFoods.map(({ food, count }) =>
                  food ? (
                    <Link key={food.id} href={`/foods/${food.id}`} className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                      <span>{food.name}</span>
                      <span className="tiny muted">
                        {count}× logged
                      </span>
                    </Link>
                  ) : null,
                )}
              </div>
            )}
            <Link href="/app/diary" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 14 }}>
              Search the food database
            </Link>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 20, margin: '30px 0 12px' }}>Today&apos;s meals</h2>
      <div className="meals">
        {GREETING_MEALS.map((meal) => {
          const group = summary.meals.find((m) => m.mealType === meal);
          const items = group?.entries ?? [];
          const kcal = group?.totals.kcal ?? 0;
          return (
            <div key={meal} className="card card-pad">
              <div className="meal-head">
                <span className="meal-title">{meal.replace(/_/g, ' ')}</span>
                <span className="tiny muted mono">{Math.round(kcal)} kcal</span>
              </div>
              {items.length === 0 ? (
                <p className="tiny muted">Nothing logged.</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="entry">
                    <span>
                      <span className="entry-name">
                        {foods.find((f) => f.id === item.foodId)?.name ?? item.foodId}
                      </span>
                      <span className="entry-sub"> · {item.grams} g</span>
                    </span>
                    <span className="mono tiny">{Math.round(item.nutrition.kcal)} kcal</span>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      <p className="tiny muted" style={{ marginTop: 20 }}>
        {entries.length === 0
          ? 'Start with breakfast — the diary remembers your portions.'
          : 'Portions are editable from the diary. Values are per-100 g scaled to the grams you logged.'}
      </p>
    </div>
  );
}
