#!/usr/bin/env node
/**
 * Generates the distributable catalog artifacts from the authored JSON sources:
 *
 *   generated/catalog.json         full catalog (foods + aliases + variants + nutrition + servings)
 *   generated/catalog.compact.json same data without pretty printing (used by seeding)
 *   generated/planner-pool.json    diet-planner candidate pool
 *   generated/audit-report.md      provenance + data-quality report
 *   supabase/seed/02_food_catalog.sql  reproducible load script (staging-table approach)
 *
 * Run after `npm run build:core && npm run build -w @bharatbite/foods`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundledCatalog } from '../dist/load.js';
import { plannerPool } from '../dist/build.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const repoRoot = join(pkgRoot, '..', '..');
const outDir = join(pkgRoot, 'generated');
mkdirSync(outDir, { recursive: true });

const { foods, stats, warnings, qualityNotes } = buildBundledCatalog();

const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  stats,
  foods: foods.map((f) => ({
    slug: f.id,
    name: f.name,
    nameLocal: f.nameLocal ?? null,
    cuisine: f.cuisine,
    category: f.category,
    defaultVariant: f.defaultVariant,
    verification: f.verification,
    tags: f.tags ?? [],
    notes: f.notes ?? null,
    aliases: f.aliases.map((a) => ({ alias: a.alias, language: a.language, kind: a.kind ?? 'regional_name' })),
    variants: f.variants.map((v) => ({
      slug: v.slug,
      label: v.label,
      style: v.preparationStyle,
      consistency: v.consistency ?? null,
      oilLevel: v.oilLevel ?? null,
      source: v.source.source,
      reference: v.source.reference ?? null,
      methodology: v.source.methodology,
      nutrition: v.nutrition,
      servings: v.servings.map((s) => ({
        label: s.label,
        grams: s.grams,
        household: s.household ?? null,
        isDefault: Boolean(s.isDefault),
      })),
    })),
  })),
};

writeFileSync(join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2));
writeFileSync(join(outDir, 'catalog.compact.json'), JSON.stringify(catalog));
writeFileSync(join(outDir, 'planner-pool.json'), JSON.stringify(plannerPool(foods), null, 2));

const auditLines = [
  '# Food database audit report',
  '',
  `Generated: ${catalog.generatedAt}`,
  '',
  '| Metric | Value |',
  '| --- | --- |',
  `| Foods | ${stats.totalFoods} |`,
  `| IFCT-derived ingredients | ${stats.ingredients} |`,
  `| Composite dishes (standardized recipes) | ${stats.compositeDishes} |`,
  `| Directly sourced foods | ${stats.directFoods} |`,
  `| Variants (homemade / restaurant / low-oil) | ${stats.totalVariants} |`,
  `| Language aliases | ${stats.totalAliases} |`,
  `| source_verified rows | ${stats.sourceVerified} |`,
  `| calculated_from_recipe rows | ${stats.calculated} |`,
  `| needs_audit rows | ${stats.needsAudit} |`,
  '',
  '## Provenance model',
  '',
  '- `source_verified` — value taken from IFCT 2017 / USDA, or an IFCT row applied directly.',
  '- `calculated_from_recipe` — per-100 g values computed by `computeRecipePer100g()` from a',
  '  standardized recipe (raw ingredient grams + cooked yield), so the methodology is reproducible.',
  '- `needs_audit` — provisional (packaged label medians, proxy ingredients). Must not be shown',
  '  with a "verified" badge until a source page is attached.',
  '',
  '## Real data problems (must fix)',
  '',
  warnings.length === 0 ? '_None._' : warnings.map((w) => `- ${w}`).join('\n'),
  '',
  '## Advisory cross-checks (authored cooked weight vs formula)',
  '',
  qualityNotes.length === 0 ? '_None._' : qualityNotes.map((w) => `- ${w}`).join('\n'),
  '',
  '## Known gaps',
  '',
  '- 226 foods is the launch foundation, not the 500–1,000 target. The expansion path is',
  '  `packages/foods/data/*.json` plus the IFCT 2017 raw tables import (`ml/` scripts), which',
  '  needs the IFCT dataset file — not reachable from the build sandbox network allow-list.',
  '- `needs_audit` rows (14) need their source pages captured before they carry a verified badge.',
  '- Mustard greens use spinach as an IFCT proxy in `sarson-da-saag` (documented in the row).',
  '',
].join('\n');
writeFileSync(join(outDir, 'audit-report.md'), auditLines);

// Reproducible load script. The catalog JSON is fetched from the repository so the
// SQL stays small and the data source remains version-controlled.
const seedSql = `-- 02_food_catalog.sql
-- Loads packages/foods/generated/catalog.json into the catalog tables.
-- Requires the pg_net or http extension; the raw JSON URL must point at the
-- exact commit you intend to publish.
--
-- Usage (psql):
--   \\set catalog_url 'https://raw.githubusercontent.com/<owner>/<repo>/<ref>/packages/foods/generated/catalog.compact.json'
--   \\i supabase/seed/02_food_catalog.sql
--
-- The catalog tables are seed-owned: they are re-derived from source JSON on every
-- run, which keeps the database and the repository in lockstep.

create extension if not exists http;

drop table if exists public._catalog_staging;
create table public._catalog_staging (doc jsonb);
insert into public._catalog_staging (doc)
select content::jsonb from http_get(:'catalog_url');

insert into public.food_items (slug, name, name_local, cuisine, category, default_variant, verification, tags, notes)
select x.slug, x.name, x."nameLocal", x.cuisine::cuisine_t, x.category::food_category_t,
       x."defaultVariant", x.verification::verification_t, coalesce(x.tags, '{}'), x.notes
from jsonb_to_recordset((select doc -> 'foods' from public._catalog_staging)) as x(
  slug text, name text, "nameLocal" text, cuisine text, category text,
  "defaultVariant" text, verification text, tags text[], notes text, aliases jsonb, variants jsonb)
on conflict (slug) do update
  set name = excluded.name, name_local = excluded.name_local, cuisine = excluded.cuisine,
      category = excluded.category, default_variant = excluded.default_variant,
      verification = excluded.verification, tags = excluded.tags, notes = excluded.notes,
      updated_at = now();

delete from public.food_servings;
delete from public.food_nutrition;
delete from public.food_variants;
delete from public.food_aliases;

insert into public.food_aliases (food_slug, alias, language, kind)
select f.slug, a.alias, a.language, a.kind
from jsonb_to_recordset((select doc -> 'foods' from public._catalog_staging)) as f(slug text, aliases jsonb)
cross join lateral jsonb_to_recordset(coalesce(f.aliases, '[]'::jsonb)) as a(alias text, language text, kind text);

insert into public.food_variants (food_slug, slug, label, preparation_style, consistency, oil_level, is_default, source, source_reference, methodology)
select f.slug, v.slug, v.label, v.style, v.consistency, v."oilLevel",
       (v.slug = f."defaultVariant"), v.source, v.reference, v.methodology
from jsonb_to_recordset((select doc -> 'foods' from public._catalog_staging)) as f(slug text, "defaultVariant" text, variants jsonb)
cross join lateral jsonb_to_recordset(coalesce(f.variants, '[]'::jsonb)) as v(
  slug text, label text, style text, consistency text, "oilLevel" text,
  source text, reference text, methodology text, nutrition jsonb, servings jsonb);

insert into public.food_nutrition (variant_id, kcal, protein_g, carbs_g, fat_g, sat_fat_g, fibre_g, sugar_g, sodium_mg)
select fv.id, (v.nutrition ->> 'kcal')::numeric, (v.nutrition ->> 'protein_g')::numeric,
       (v.nutrition ->> 'carbs_g')::numeric, (v.nutrition ->> 'fat_g')::numeric,
       (v.nutrition ->> 'sat_fat_g')::numeric, (v.nutrition ->> 'fibre_g')::numeric,
       (v.nutrition ->> 'sugar_g')::numeric, (v.nutrition ->> 'sodium_mg')::numeric
from jsonb_to_recordset((select doc -> 'foods' from public._catalog_staging)) as f(slug text, variants jsonb)
cross join lateral jsonb_to_recordset(coalesce(f.variants, '[]'::jsonb)) as v(slug text, nutrition jsonb)
join public.food_variants fv on fv.food_slug = f.slug and fv.slug = v.slug;

insert into public.food_servings (variant_id, label, grams, household, is_default)
select fv.id, s.label, s.grams, s.household, coalesce(s."isDefault", false)
from jsonb_to_recordset((select doc -> 'foods' from public._catalog_staging)) as f(slug text, variants jsonb)
cross join lateral jsonb_to_recordset(coalesce(f.variants, '[]'::jsonb)) as v(slug text, servings jsonb)
join public.food_variants fv on fv.food_slug = f.slug and fv.slug = v.slug
cross join lateral jsonb_to_recordset(coalesce(v.servings, '[]'::jsonb)) as s(
  label text, grams numeric, household text, "isDefault" boolean);

drop table if exists public._catalog_staging;

analyze public.food_items;
analyze public.food_variants;
analyze public.food_nutrition;
`;
writeFileSync(join(repoRoot, 'supabase', 'seed', '02_food_catalog.sql'), seedSql);

console.log('catalog generated:', JSON.stringify(stats));
if (warnings.length) {
  console.log('WARNINGS:');
  for (const warning of warnings) console.log('  -', warning);
}
