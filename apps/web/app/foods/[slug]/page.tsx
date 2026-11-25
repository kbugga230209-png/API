import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { createServerSupabase } from '@/lib/supabase/server';
import { getFoodDetail } from '@/lib/data';
import { logFoodAction } from '@/lib/actions';
import { scaleNutrition } from '@bharatbite/core';

export const dynamic = 'force-dynamic';

export default async function FoodDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const food = await getFoodDetail(supabase, slug);
  if (!food) notFound();

  const { data: auth } = await supabase.auth.getUser();
  const today = new Date().toISOString().slice(0, 10);
  const defaultVariant = food.variants[0];

  return (
    <>
      <SiteNav />
      <main className="wrap" style={{ paddingTop: 36, paddingBottom: 64 }}>
        <Link href="/foods" className="small muted">
          ← Food database
        </Link>
        <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>{food.name}</h1>
            {food.name_local && <p className="muted">{food.name_local}</p>}
            <div className="row row-wrap" style={{ marginTop: 10 }}>
              <span className="chip chip-accent">{food.cuisine.replace(/_/g, ' ')}</span>
              <span className="chip">{food.category.replace(/_/g, ' ')}</span>
              <span
                className={
                  food.verification === 'source_verified'
                    ? 'badge badge-verified'
                    : food.verification === 'calculated_from_recipe'
                      ? 'badge badge-calc'
                      : 'badge badge-audit'
                }
              >
                {food.verification === 'source_verified'
                  ? 'IFCT sourced'
                  : food.verification === 'calculated_from_recipe'
                    ? 'Calculated from recipe'
                    : 'Provisional — audit pending'}
              </span>
            </div>
          </div>
        </div>

        {food.notes && (
          <p className="alert" style={{ marginTop: 18 }}>
            <strong>Data note:</strong> {food.notes}
          </p>
        )}

        <div className="grid-2" style={{ marginTop: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {food.variants.map((variant) => (
              <div key={variant.id} className="card card-pad">
                <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: 18 }}>{variant.label}</h3>
                    <p className="tiny muted">
                      {variant.preparation_style}
                      {variant.oil_level ? ` · ${variant.oil_level} oil` : ''}
                      {variant.consistency ? ` · ${variant.consistency}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                      {Math.round(variant.nutrition.kcal)}
                    </div>
                    <div className="tiny muted">kcal / 100 g</div>
                  </div>
                </div>
                <hr className="divider" />
                <div className="kv"><span className="muted">Protein</span><span className="mono">{variant.nutrition.protein_g.toFixed(1)} g</span></div>
                <div className="kv"><span className="muted">Carbohydrate</span><span className="mono">{variant.nutrition.carbs_g.toFixed(1)} g</span></div>
                <div className="kv"><span className="muted">Fat (saturated)</span><span className="mono">{variant.nutrition.fat_g.toFixed(1)} g ({variant.nutrition.sat_fat_g.toFixed(1)})</span></div>
                <div className="kv"><span className="muted">Fibre</span><span className="mono">{variant.nutrition.fibre_g.toFixed(1)} g</span></div>
                <div className="kv"><span className="muted">Sugar</span><span className="mono">{variant.nutrition.sugar_g.toFixed(1)} g</span></div>
                <div className="kv"><span className="muted">Sodium</span><span className="mono">{Math.round(variant.nutrition.sodium_mg)} mg</span></div>
                <p className="tiny muted" style={{ marginTop: 10 }}>
                  Source: {variant.source}
                </p>
                <div className="row row-wrap" style={{ marginTop: 12 }}>
                  {variant.servings.map((serving) => {
                    const scaled = scaleNutrition(variant.nutrition, serving.grams);
                    return (
                      <span key={serving.label} className="chip">
                        {serving.label} · {Math.round(scaled.kcal)} kcal
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card card-pad">
              <h3 style={{ fontSize: 18, marginBottom: 12 }}>
                {auth.user ? 'Add to your diary' : 'Sign in to log this food'}
              </h3>
              {auth.user ? (
                <form action={logFoodAction}>
                  <input type="hidden" name="slug" value={food.slug} />
                  <input type="hidden" name="returnTo" value={`/foods/${food.slug}`} />
                  <div className="field">
                    <label htmlFor="date">Date</label>
                    <input className="input" id="date" name="date" type="date" defaultValue={today} max={today} />
                  </div>
                  <div className="field">
                    <label htmlFor="meal">Meal</label>
                    <select className="select" id="meal" name="meal" defaultValue="lunch">
                      <option value="breakfast">Breakfast</option>
                      <option value="mid_morning">Mid-morning</option>
                      <option value="lunch">Lunch</option>
                      <option value="evening_snack">Evening snack</option>
                      <option value="dinner">Dinner</option>
                      <option value="midnight">Late night</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="variant">Preparation</label>
                    <select className="select" id="variant" name="variant" defaultValue={defaultVariant?.slug}>
                      {food.variants.map((v) => (
                        <option key={v.slug} value={v.slug}>
                          {v.label} — {Math.round(v.nutrition.kcal)} kcal/100 g
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="grams">Portion (grams)</label>
                    <input
                      className="input"
                      id="grams"
                      name="grams"
                      type="number"
                      min={1}
                      max={2000}
                      step={5}
                      defaultValue={defaultVariant?.servings.find((s) => s.is_default)?.grams ?? 150}
                    />
                  </div>
                  <button className="btn btn-primary btn-block" type="submit">
                    Add to diary
                  </button>
                </form>
              ) : (
                <>
                  <p className="small muted" style={{ marginBottom: 14 }}>
                    Logging, scanning and history are free. Create an account and this food is one tap
                    away.
                  </p>
                  <Link href="/login?mode=signup" className="btn btn-primary btn-block">
                    Create free account
                  </Link>
                </>
              )}
            </div>

            {food.aliases.length > 0 && (
              <div className="card card-pad">
                <h3 style={{ fontSize: 16, marginBottom: 10 }}>Also called</h3>
                <div className="row row-wrap">
                  {food.aliases.map((alias) => (
                    <span key={`${alias.alias}-${alias.language}`} className="chip">
                      {alias.alias}
                      <span className="tiny muted">· {alias.language}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
