-- 0009 · search_foods: alias-aware scoring with best-match dedupe
--
-- Applied live as migration `fix_search_foods_scoring` (20261125095215). Captured
-- here so the repository, not the cloud project, is the source of truth.
--
-- Why: the first version of search_foods matched only `food_items.name`, so a
-- query for "thepla" returned whatever trigram-nearest name existed (almond,
-- aloo-gobi) and a query typed in Gujarati returned nothing. This version:
--   * searches names AND regional aliases,
--   * scores exact 1.0 / prefix 0.85 / trigram fallback >= 0.3,
--   * keeps only the best row per food (distinct on slug),
--   * returns nutrition for the default preparation.
--
-- Verified after apply: thepla -> thepla (1.0), roti -> roti-chapati (0.85),
-- khaman -> dhokla (0.85), થેપલા -> thepla (1.0).

create or replace function public.search_foods(q text, lim integer default 20)
returns table (
  slug text,
  name text,
  name_local text,
  cuisine cuisine_t,
  category food_category_t,
  matched_alias text,
  score real,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric
)
language sql
stable
as $$
  with needle as (select lower(trim(coalesce(q, ''))) as term),
  candidates as (
    select fi.slug, fi.name, fi.name_local, fi.cuisine, fi.category, lower(trim(fi.name)) as alias,
           case
             when lower(trim(fi.name)) = (select term from needle) then 1.0::real
             when lower(trim(fi.name)) like (select term from needle) || '%' then 0.85::real
             else greatest(similarity(lower(fi.name), (select term from needle)), 0)::real
           end as score
    from food_items fi
    union all
    select fi.slug, fi.name, fi.name_local, fi.cuisine, fi.category, lower(trim(fa.alias)),
           case
             when lower(trim(fa.alias)) = (select term from needle) then 1.0::real
             when lower(trim(fa.alias)) like (select term from needle) || '%' then 0.85::real
             else greatest(similarity(lower(fa.alias), (select term from needle)), 0)::real
           end
    from food_aliases fa join food_items fi on fi.slug = fa.food_slug
  ),
  ranked as (
    select distinct on (c.slug) c.slug, c.name, c.name_local, c.cuisine, c.category, c.alias, c.score
    from candidates c
    where (select term from needle) <> ''
      and (c.score >= 0.3 or c.alias like '%' || (select term from needle) || '%')
    order by c.slug, c.score desc
  )
  select r.slug, r.name, r.name_local, r.cuisine, r.category, r.alias, r.score,
         fn.kcal, fn.protein_g, fn.carbs_g, fn.fat_g
  from ranked r
  join food_items fi on fi.slug = r.slug
  join food_variants fv on fv.food_slug = r.slug and fv.slug = fi.default_variant
  join food_nutrition fn on fn.variant_id = fv.id
  order by r.score desc, r.name
  limit greatest(1, least(coalesce(lim, 20), 100));
$$;

revoke all on function public.search_foods(text, integer) from public;
grant execute on function public.search_foods(text, integer) to anon, authenticated;
