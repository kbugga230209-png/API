import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { createServerSupabase } from '@/lib/supabase/server';
import { listFoodsByCategory, searchCatalog } from '@/lib/data';
import { catalogStats } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Indian food database',
  description:
    'Search Indian foods by name in English, Hindi, Gujarati, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi or Odia. Every row carries its nutrition source.',
};

export const dynamic = 'force-dynamic';

const CATEGORY_TABS = [
  ['roti_bread', 'Rotis & breads'],
  ['dal_legume', 'Dals & legumes'],
  ['vegetable_sabzi', 'Sabzis'],
  ['rice_dish', 'Rice'],
  ['breakfast', 'Breakfast'],
  ['snack_street_food', 'Street food'],
  ['non_veg_curry', 'Non-veg'],
  ['sweet_dessert', 'Sweets'],
] as const;

function verificationBadge(status: string) {
  if (status === 'source_verified') return <span className="badge badge-verified">IFCT sourced</span>;
  if (status === 'calculated_from_recipe') return <span className="badge badge-calc">Recipe calculated</span>;
  return <span className="badge badge-audit">Provisional</span>;
}

export default async function FoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const category = params.category;
  const supabase = await createServerSupabase();
  const stats = catalogStats();

  const results = query
    ? await searchCatalog(supabase, query, 40)
    : category
      ? (await listFoodsByCategory(supabase, category, 40)).map((f) => ({
          slug: f.slug,
          name: f.name,
          name_local: f.name_local,
          cuisine: f.cuisine as string,
          category: f.category as string,
          matched_alias: f.name,
          score: 1,
          kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
        }))
      : [];

  return (
    <>
      <SiteNav />
      <main className="wrap" style={{ paddingTop: 44, paddingBottom: 60 }}>
        <span className="eyebrow">Food database</span>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 44px)', margin: '10px 0 12px' }}>
          {stats.totalFoods} Indian foods, with receipts
        </h1>
        <p className="muted" style={{ maxWidth: '64ch' }}>
          {stats.ingredients} ingredients carry IFCT 2017 composition values. {stats.compositeDishes}{' '}
          dishes are computed from weighted recipes and cooked yields. {stats.totalAliases} regional
          names make search work in your language.
        </p>

        <form action="/foods" className="inline-form" style={{ marginTop: 26, maxWidth: 560 }}>
          <input
            className="input"
            type="search"
            name="q"
            placeholder="Try thepla, થેપલા, dal tadka, katori…"
            defaultValue={query}
            aria-label="Search foods"
          />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>

        <div className="filters" style={{ marginTop: 18 }}>
          <Link href="/foods" className="chip" aria-current={!category ? 'page' : undefined}>
            All
          </Link>
          {CATEGORY_TABS.map(([value, label]) => (
            <Link
              key={value}
              href={`/foods?category=${value}`}
              className={category === value ? 'chip chip-accent' : 'chip'}
            >
              {label}
            </Link>
          ))}
        </div>

        {results.length === 0 && (query || category) && (
          <div className="empty">
            No match for “{query}”. Try a shorter word, or search in another script — for example
            <span className="mono"> ઢોકળા</span> or <span className="mono">sambar</span>.
          </div>
        )}

        {results.length > 0 && (
          <div className="grid-3" style={{ marginTop: 8 }}>
            {results.map((food) => (
              <Link key={food.slug} href={`/foods/${food.slug}`} className="dish-card">
                <span className="dish-name">{food.name}</span>
                {food.name_local && <span className="tiny muted">{food.name_local}</span>}
                <span className="dish-meta">
                  <span>{String(food.cuisine).replace(/_/g, ' ')}</span>
                  {food.kcal > 0 && <span className="dish-kcal">{Math.round(Number(food.kcal))} kcal/100g</span>}
                </span>
                {food.matched_alias && food.matched_alias.toLowerCase() !== food.name.toLowerCase() && (
                  <span className="tiny muted">matched “{food.matched_alias}”</span>
                )}
              </Link>
            ))}
          </div>
        )}

        {!query && !category && (
          <div className="grid-3" style={{ marginTop: 8 }}>
            {CATEGORY_TABS.slice(0, 6).map(([value, label]) => (
              <Link key={value} href={`/foods?category=${value}`} className="dish-card">
                <span className="dish-name">{label}</span>
                <span className="tiny muted">Browse the catalog →</span>
              </Link>
            ))}
          </div>
        )}

        <div className="card card-pad" style={{ marginTop: 34 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>How the numbers are produced</h2>
          <p className="small muted" style={{ marginBottom: 12 }}>
            Every nutrition row records a methodology. {stats.sourceVerified} rows are
            <strong> source verified</strong> (IFCT 2017 / USDA), {stats.calculated} are
            <strong> calculated from a standardized recipe</strong> using raw ingredient grams and the
            cooked edible yield, and {stats.needsAudit} are
            <strong> provisional</strong> — packaged label medians or proxy ingredients waiting for a
            source page. Provisional rows are labelled in the app.
          </p>
          <p className="small muted">
            A photo cannot see how much oil went into the tadka. Where cooking method changes the
            number materially, BharatBite asks instead of guessing: pick homemade, restaurant-style or
            low-oil and the value changes with it.
          </p>
          {verificationBadge('source_verified')}
        </div>
      </main>
      <Footer />
    </>
  );
}
