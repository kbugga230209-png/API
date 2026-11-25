-- 02_food_catalog.sql
-- Loads packages/foods/generated/catalog.json into the catalog tables.
-- Requires the pg_net or http extension; the raw JSON URL must point at the
-- exact commit you intend to publish.
--
-- Usage (psql):
--   \set catalog_url 'https://raw.githubusercontent.com/<owner>/<repo>/<ref>/packages/foods/generated/catalog.compact.json'
--   \i supabase/seed/02_food_catalog.sql
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
