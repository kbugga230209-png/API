import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import {
  deriveTargets,
  getDaySummary,
  getPreferences,
  getRecentFrequencies,
  getWeightHistory,
  searchCatalog,
} from '@/lib/data';
import { deleteLogAction, logFoodAction } from '@/lib/actions';
import { calorieShare, mealTypesOrdered } from '@bharatbite/core';
import { getBundledFoods } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function defaultMeal(): string {
  const hour = (new Date().getUTCHours() + 5.5) % 24;
  if (hour < 10.5) return 'breakfast';
  if (hour < 12) return 'mid_morning';
  if (hour < 16) return 'lunch';
  if (hour < 19) return 'evening_snack';
  if (hour < 23) return 'dinner';
  return 'midnight';
}

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; q?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? (params.date as string) : today;
  const query = (params.q ?? '').trim();

  const [preferences, weights, recent] = await Promise.all([
    getPreferences(supabase, user.id),
    getWeightHistory(supabase, user.id, 1),
    getRecentFrequencies(supabase, user.id, 21),
  ]);
  const targets = deriveTargets(preferences, weights.history[0]?.weightKg ?? null);
  const { summary } = await getDaySummary(supabase, user.id, date, targets);
  const results = query ? await searchCatalog(supabase, query, 12) : [];
  const foods = getBundledFoods();
  const meal = defaultMeal();
  const returnTo = `/app/diary?date=${date}`;
  const share = calorieShare(summary.totals.kcal, targets);

  return (
    <div style={{ paddingTop: 8 }}>
      {params.ok && <div className="alert alert-success" style={{ marginBottom: 14 }}>{params.ok}</div>}
      {params.error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{params.error}</div>}

      <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span className="eyebrow">Diary</span>
          <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', marginTop: 6 }}>
            {date === today ? 'Today' : new Date(`${date}T00:00:00Z`).toDateString()}
          </h1>
        </div>
        <div className="row">
          <Link href={`/app/diary?date=${shiftDate(date, -1)}`} className="btn btn-ghost btn-sm" aria-label="Previous day">
            ←
          </Link>
          <input className="input" style={{ width: 160 }} type="date" value={date} max={today} readOnly aria-label="Date" />
          {date !== today && (
            <Link href={`/app/diary?date=${shiftDate(date, 1)}`} className="btn btn-ghost btn-sm" aria-label="Next day">
              →
            </Link>
          )}
          <Link href="/app/diary" className="btn btn-ghost btn-sm">
            Today
          </Link>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <span className="mono" style={{ fontSize: 26, fontWeight: 600 }}>
              {Math.round(summary.totals.kcal)}
            </span>
            <span className="muted small"> kcal{targets ? ` of ${targets.kcal}` : ''}</span>
          </div>
          <span className="tiny muted">
            P {Math.round(summary.totals.protein_g)} g · C {Math.round(summary.totals.carbs_g)} g · F{' '}
            {Math.round(summary.totals.fat_g)} g · Fibre {Math.round(summary.totals.fibre_g)} g
          </span>
        </div>
        <div className={share > 1 ? 'progress gold' : 'progress'} style={{ marginTop: 10 }}>
          <span style={{ width: `${Math.min(100, share * 100)}%` }} />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18, alignItems: 'start' }}>
        <div className="card card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Add food</h2>
          <form action="/app/diary" className="inline-form">
            <input type="hidden" name="date" value={date} />
            <input
              className="input"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search food or regional name"
              aria-label="Search food"
            />
            <button className="btn btn-primary btn-sm" type="submit">
              Search
            </button>
          </form>

          {query && results.length === 0 && (
            <p className="small muted" style={{ marginTop: 14 }}>
              No match for “{query}”.
            </p>
          )}

          {results.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.slice(0, 8).map((food) => (
                <form
                  key={food.slug}
                  action={logFoodAction}
                  className="card card-flat"
                  style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
                >
                  <input type="hidden" name="slug" value={food.slug} />
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                    <div style={{ fontWeight: 550, fontSize: 14 }}>{food.name}</div>
                    <div className="tiny muted">
                      {Math.round(Number(food.kcal))} kcal/100 g
                      {food.name_local ? ` · ${food.name_local}` : ''}
                    </div>
                  </div>
                  <input
                    className="input"
                    style={{ width: 84 }}
                    type="number"
                    name="grams"
                    defaultValue={150}
                    min={1}
                    max={2000}
                    step={5}
                    aria-label={`Grams of ${food.name}`}
                  />
                  <select className="select" name="meal" defaultValue={meal} style={{ width: 132 }} aria-label="Meal">
                    {mealTypesOrdered().map((m) => (
                      <option key={m} value={m}>
                        {m.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-accent btn-sm" type="submit">
                    Add
                  </button>
                </form>
              ))}
              <p className="tiny muted">
                Need a specific preparation or a different portion?{' '}
                <Link href={`/foods/${results[0].slug}`} style={{ textDecoration: 'underline' }}>
                  Open the full food page
                </Link>
                .
              </p>
            </div>
          )}

          {!query && recent.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p className="tiny muted" style={{ marginBottom: 8 }}>
                Frequent in the last 3 weeks
              </p>
              <div className="row row-wrap" style={{ gap: 6 }}>
                {recent.slice(0, 6).map(([slug, count]) => {
                  const food = foods.find((f) => f.id === slug);
                  if (!food) return null;
                  return (
                    <form key={slug} action={logFoodAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="date" value={date} />
                      <input type="hidden" name="grams" value={150} />
                      <input type="hidden" name="meal" value={meal} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button className="chip" type="submit" title={`Usually logged ${count}×`}>
                        + {food.name}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>This day</h2>
          {summary.entryCount === 0 && <p className="small muted">Nothing logged yet.</p>}
          {mealTypesOrdered().map((mealType) => {
            const group = summary.meals.find((m) => m.mealType === mealType);
            if (!group) return null;
            return (
              <div key={mealType} style={{ marginTop: 14 }}>
                <div className="meal-head">
                  <span className="meal-title">{mealType.replace(/_/g, ' ')}</span>
                  <span className="tiny muted mono">{Math.round(group.totals.kcal)} kcal</span>
                </div>
                {group.entries.map((entry) => (
                  <div key={entry.id} className="entry">
                    <span>
                      <span className="entry-name">
                        {foods.find((f) => f.id === entry.foodId)?.name ?? entry.foodId}
                      </span>
                      <span className="entry-sub">
                        {' '}
                        · {entry.grams} g · {entry.variantSlug}
                      </span>
                    </span>
                    <span className="mono tiny">{Math.round(entry.nutrition.kcal)} kcal</span>
                    <form action={deleteLogAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button
                        className="btn btn-ghost btn-sm"
                        type="submit"
                        aria-label={`Remove ${entry.foodId}`}
                        style={{ padding: '4px 9px' }}
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
