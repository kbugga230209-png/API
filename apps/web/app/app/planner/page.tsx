import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { getDietPlan, getEntitlement, weekStartOf } from '@/lib/data';
import { generatePlanAction, logPlannedMealAction } from '@/lib/actions';
import { getBundledFoods } from '@/lib/catalog';
import { mealTypesOrdered } from '@bharatbite/core';

export const dynamic = 'force-dynamic';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface PlanMealRow {
  id: string;
  day_index: number;
  meal_type: string;
  food_slug: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  cost_inr: number;
}

interface GroceryRow {
  id: string;
  name: string;
  grams: number;
  cost_inr: number;
  checked: boolean;
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!user) return null;

  const { plusActive } = await getEntitlement(supabase, user.id);
  const weekStart = weekStartOf(new Date());
  const weeks = [0, 1, 2].map((offset) => {
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset * 7);
    return d.toISOString().slice(0, 10);
  });

  if (!plusActive) {
    return (
      <div style={{ paddingTop: 8 }}>
        <span className="eyebrow">Diet planner</span>
        <h1 style={{ fontSize: 30, margin: '8px 0 10px' }}>Plan the week, not just the day</h1>
        <p className="muted" style={{ maxWidth: '60ch' }}>
          The planner builds seven days of Indian meals around your cuisine, diet, cooking time,
          budget and daily targets — then gives you one grocery list for the week.
        </p>
        <div className="card card-pad" style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Included with BharatBite Plus</h3>
          <ul className="feature-list">
            <li><span className="tick">✓</span> Weekly plans from the verified Indian catalog</li>
            <li><span className="tick">✓</span> Regional, vegetarian/vegan and allergy filters</li>
            <li><span className="tick">✓</span> Cooking-time and daily-budget aware</li>
            <li><span className="tick">✓</span> Grocery list with quantities and cost</li>
            <li><span className="tick">✓</span> One tap to log a planned meal</li>
          </ul>
          <p className="small muted" style={{ marginTop: 14 }}>
            Free accounts keep unlimited scanning, logging and the full nutrition database.
          </p>
          <Link href="/app/plus" className="btn btn-gold" style={{ marginTop: 16 }}>
            See Plus — ₹49/month
          </Link>
        </div>
      </div>
    );
  }

  const plan = await getDietPlan(supabase, user.id, weekStart);
  const foods = getBundledFoods();
  const meals = (plan?.meals ?? []) as unknown as PlanMealRow[];
  const groceries = (plan?.groceries ?? []) as unknown as GroceryRow[];
  const planNotes = (plan?.plan.notes ?? []) as string[];

  return (
    <div style={{ paddingTop: 8 }}>
      {params.ok && <div className="alert alert-success" style={{ marginBottom: 14 }}>{params.ok}</div>}
      {params.error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{params.error}</div>}

      <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span className="eyebrow">Diet planner</span>
          <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', marginTop: 6 }}>
            Week of {new Date(`${weekStart}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </h1>
        </div>
        <form action={generatePlanAction}>
          <button className="btn btn-primary btn-sm" type="submit">
            {plan ? 'Regenerate plan' : 'Create my 7-day plan'}
          </button>
        </form>
      </div>

      {!plan && (
        <div className="empty" style={{ marginTop: 20 }}>
          No plan for this week yet. Generate one from your goals and preferences — you can regenerate
          any time, and nothing is logged unless you choose to.
        </div>
      )}

      {plan && (
        <>
          <div className="row row-wrap" style={{ marginTop: 14, gap: 8 }}>
            <span className="chip chip-accent">
              {plan.plan.title}
            </span>
            <span className="chip">≈ ₹{Math.round(Number(plan.plan.estimated_cost_inr ?? 0))} for the week</span>
            <span className="chip">{meals.length} meals</span>
            {weeks.slice(1).map((week) => (
              <span key={week} className="chip tiny muted">
                next week: {week}
              </span>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: 18, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {DAY_NAMES.map((dayName, dayIndex) => {
                const dayMeals = meals.filter((m) => Number(m.day_index) === dayIndex);
                if (dayMeals.length === 0) return null;
                const kcal = dayMeals.reduce((sum, m) => sum + Number(m.kcal), 0);
                return (
                  <div key={dayName} className="card card-pad">
                    <div className="meal-head">
                      <span className="meal-title">{dayName}</span>
                      <span className="tiny muted mono">{Math.round(kcal)} kcal</span>
                    </div>
                    {mealTypesOrdered().map((mealType) => {
                      const items = dayMeals.filter((m) => m.meal_type === mealType);
                      if (items.length === 0) return null;
                      return (
                        <div key={mealType} style={{ marginTop: 8 }}>
                          <p className="tiny muted" style={{ textTransform: 'capitalize' }}>
                            {mealType.replace(/_/g, ' ')}
                          </p>
                          {items.map((item) => {
                            const food = foods.find((f) => f.id === item.food_slug);
                            return (
                              <div key={item.id} className="entry">
                                <span>
                                  <span className="entry-name">{food?.name ?? item.food_slug}</span>
                                  <span className="entry-sub"> · {Math.round(Number(item.grams))} g</span>
                                </span>
                                <span className="mono tiny">{Math.round(Number(item.kcal))} kcal</span>
                                <form action={logPlannedMealAction}>
                                  <input type="hidden" name="slug" value={item.food_slug} />
                                  <input type="hidden" name="grams" value={Math.round(Number(item.grams))} />
                                  <input type="hidden" name="meal" value={item.meal_type} />
                                  <button className="btn btn-ghost btn-sm" type="submit" style={{ padding: '4px 9px' }}>
                                    Log
                                  </button>
                                </form>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 88 }}>
              <div className="card card-pad">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h2 style={{ fontSize: 18 }}>Grocery list</h2>
                  <span className="tiny muted">{groceries.length} items</span>
                </div>
                <p className="tiny muted" style={{ marginTop: 4 }}>
                  Aggregated from every planned meal — buy once, cook the week.
                </p>
                <div style={{ marginTop: 12 }}>
                  {groceries.length === 0 && <p className="small muted">Regenerate the plan to build a list.</p>}
                  {groceries.map((item) => (
                    <div key={item.id} className="kv">
                      <span>{item.name}</span>
                      <span className="mono tiny">
                        {Math.round(Number(item.grams))} g
                        {Number(item.cost_inr) > 0 ? ` · ₹${Math.round(Number(item.cost_inr))}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {Number(plan.plan.estimated_cost_inr ?? 0) > 0 && (
                  <div className="kv" style={{ marginTop: 8, borderTop: '1px solid var(--line)' }}>
                    <span style={{ fontWeight: 600 }}>Estimated total</span>
                    <span className="mono">₹{Math.round(Number(plan.plan.estimated_cost_inr ?? 0))}</span>
                  </div>
                )}
              </div>

              {planNotes.length > 0 && (
                <div className="card card-pad">
                  <h2 style={{ fontSize: 16, marginBottom: 8 }}>Notes</h2>
                  <ul className="feature-list" style={{ marginTop: 0 }}>
                    {planNotes.map((note) => (
                      <li key={note}>
                        <span className="tick">•</span> {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
