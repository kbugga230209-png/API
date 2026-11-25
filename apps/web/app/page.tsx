import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';
import { catalogStats, getBundledFoods } from '@/lib/catalog';
import { PLUS_ANNUAL_INR, PLUS_MONTHLY_INR, GITHUB_RELEASES } from '@/lib/config';
import { Footer } from '@/components/Footer';
import { defaultServingGrams, scaleNutrition } from '@bharatbite/core';

export const revalidate = 3600;

const SHOWCASE = ['dal-tadka', 'roti-chapati', 'masala-dosa', 'paneer-butter-masala', 'khichdi', 'sambar'];

export default function HomePage() {
  const stats = catalogStats();
  const foods = getBundledFoods();
  const showcase = SHOWCASE.map((slug) => foods.find((f) => f.id === slug)).filter(Boolean);

  return (
    <>
      <SiteNav />
      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">India-first nutrition</span>
              <h1>
                Know what&apos;s on your plate, <em>not just how many calories.</em>
              </h1>
              <p className="hero-lede">
                BharatBite understands roti, dal, sabzi, thepla, dosa and the thousand variations in
                between — homemade or restaurant, dry or gravy, one katori or two. Scan a plate or
                search by name in your own language.
              </p>
              <div className="hero-cta">
                <Link href="/login?mode=signup" className="btn btn-primary">
                  Start tracking free
                </Link>
                <Link href="/foods" className="btn btn-ghost">
                  Browse the food database
                </Link>
              </div>
              <p className="hero-note">
                Every nutrition value carries its source. No ads, no scan limits, no paywall on the
                food database.
              </p>
              <div className="stat-strip">
                <div className="stat">
                  <strong>{stats.totalFoods}</strong>
                  <span className="statspan">foods and preparations</span>
                </div>
                <div className="stat">
                  <strong>{stats.compositeDishes}</strong>
                  <span className="statspan">dishes from weighted recipes</span>
                </div>
                <div className="stat">
                  <strong>{stats.totalAliases}</strong>
                  <span className="statspan">names across Indian languages</span>
                </div>
                <div className="stat">
                  <strong>₹0</strong>
                  <span className="statspan">for every nutrition feature</span>
                </div>
              </div>
            </div>

            <div className="plate" aria-hidden>
              <div className="plate-inner">
                <div className="plate-kcal">486</div>
                <div className="plate-label">a real Gujarati thali</div>
                <div className="plate-items">
                  <span className="chip chip-accent">2 rotli · 228</span>
                  <span className="chip">dal · 111</span>
                  <span className="chip">bhindi · 147</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2>Built for the way India actually eats</h2>
              <p className="muted">
                Most trackers add &quot;roti&quot; to an English database and call it localisation. We started
                from Indian composition data and cooking method, because a phulka and a lachha
                paratha are not the same food.
              </p>
            </div>
            <div className="grid-3">
              <div className="card card-pad feature">
                <h3>Preparations, not just names</h3>
                <p>
                  Dal tadka, dal fry and dal makhani are separate foods with separate values.
                  Homemade, restaurant-style and low-oil variants are one tap apart.
                </p>
              </div>
              <div className="card card-pad feature">
                <h3>Numbers with provenance</h3>
                <p>
                  Values come from IFCT 2017 determinations or a standardized recipe calculation with
                  raw ingredient grams and cooked yield. Provisional rows say so.
                </p>
              </div>
              <div className="card card-pad feature">
                <h3>Your language, your cuisine</h3>
                <p>
                  Search in Gujarati, Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam,
                  Punjabi, Odia or English — with regional spellings handled.
                </p>
              </div>
              <div className="card card-pad feature">
                <h3>Portions that make sense</h3>
                <p>
                  A katori is 150–200 g, a roti is 45–55 g, one idli is 42 g. Portion options come
                  from the dish, not a generic cup.
                </p>
              </div>
              <div className="card card-pad feature">
                <h3>Offline by default</h3>
                <p>
                  The Android app runs recognition on the device. Meal photos stay on your phone
                  unless you explicitly upload them.
                </p>
              </div>
              <div className="card card-pad feature">
                <h3>Free where it matters</h3>
                <p>
                  Unlimited scanning, logging, history and every nutrition feature are free forever.
                  Plus adds themes and the diet planner.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="section-head">
              <h2>What the database looks like</h2>
              <p className="muted">
                Real rows from the live catalog, showing the default serving and the energy it actually
                carries.
              </p>
            </div>
            <div className="grid-3">
              {showcase.map((food) => {
                if (!food) return null;
                const variant = food.variants.find((v) => v.slug === food.defaultVariant) ?? food.variants[0];
                if (!variant) return null;
                const grams = defaultServingGrams(variant.servings, 100);
                const scaled = scaleNutrition(variant.nutrition, grams);
                return (
                  <Link key={food.id} href={`/foods/${food.id}`} className="dish-card">
                    <span className="dish-name">{food.name}</span>
                    {food.nameLocal && <span className="tiny muted">{food.nameLocal}</span>}
                    <span className="dish-meta">
                      <span>{food.cuisine.replace(/_/g, ' ')}</span>
                      <span className="dish-kcal">{Math.round(scaled.kcal)} kcal</span>
                    </span>
                    <span className="tiny muted">
                      per {grams} g · {Math.round(variant.nutrition.kcal)} kcal / 100 g ·{' '}
                      {variant.nutrition.protein_g.toFixed(1)} g protein
                    </span>
                  </Link>
                );
              })}
            </div>
            <p style={{ marginTop: 18 }}>
              <Link href="/foods" className="btn btn-ghost btn-sm">
                Explore all {stats.totalFoods} foods →
              </Link>
            </p>
          </div>
        </section>

        <section className="section" id="pricing" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="section-head">
              <h2>Free nutrition. Optional Plus.</h2>
              <p className="muted">
                Nothing about counting calories, macros or scanning is ever locked. Plus is for people
                who want the app to plan their week.
              </p>
            </div>
            <div className="grid-2">
              <div className="price-card">
                <span className="eyebrow">Free forever</span>
                <div className="price">
                  ₹0 <small>/ month</small>
                </div>
                <ul className="feature-list">
                  <li><span className="tick">✓</span> Unlimited AI food scanning</li>
                  <li><span className="tick">✓</span> Full Indian food database</li>
                  <li><span className="tick">✓</span> Calories, macros, fibre and sodium</li>
                  <li><span className="tick">✓</span> Offline recognition on device</li>
                  <li><span className="tick">✓</span> Diary, weight tracking, progress history</li>
                  <li><span className="tick">✓</span> No ads, ever</li>
                </ul>
                <p style={{ marginTop: 20 }}>
                  <Link href="/login?mode=signup" className="btn btn-primary btn-block">
                    Create a free account
                  </Link>
                </p>
              </div>
              <div className="price-card plus">
                <span className="eyebrow" style={{ color: 'var(--gold)' }}>
                  BharatBite Plus
                </span>
                <div className="price">
                  ₹{PLUS_MONTHLY_INR} <small>/ month · or ₹{PLUS_ANNUAL_INR} / year</small>
                </div>
                <ul className="feature-list">
                  <li><span className="tick">✓</span> Personalised Indian diet planner</li>
                  <li><span className="tick">✓</span> Weekly regional meal plans</li>
                  <li><span className="tick">✓</span> Budget, cooking-time and schedule aware</li>
                  <li><span className="tick">✓</span> Grocery list from your plan</li>
                  <li><span className="tick">✓</span> Exclusive themes and dashboard layouts</li>
                  <li><span className="tick">✓</span> Everything in Free, unchanged</li>
                </ul>
                <p style={{ marginTop: 20 }}>
                  <Link href="/app/plus" className="btn btn-gold btn-block">
                    See Plus
                  </Link>
                </p>
                <p className="tiny muted" style={{ marginTop: 10 }}>
                  Pay monthly by UPI/card, or renew manually every 30 days without a mandate.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="card card-pad" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 380px' }}>
                <h2 style={{ fontSize: 28, marginBottom: 10 }}>Get the Android app</h2>
                <p className="muted">
                  On-device recognition, offline diary and the one-tap AI model install. Signed APKs are
                  published on GitHub Releases with SHA-256 checksums.
                </p>
              </div>
              <div className="row row-wrap">
                <Link href="/download" className="btn btn-primary">
                  Download page
                </Link>
                <a href={GITHUB_RELEASES} className="btn btn-ghost" target="_blank" rel="noreferrer">
                  GitHub Releases
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
