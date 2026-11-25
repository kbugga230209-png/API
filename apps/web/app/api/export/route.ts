import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';
  const stamp = new Date().toISOString().slice(0, 10);

  const [{ data: logs }, { data: weights }, { data: plans }] = await Promise.all([
    supabase
      .from('food_logs')
      .select('log_date, meal_type, food_slug, variant_slug, grams, kcal, protein_g, carbs_g, fat_g, sat_fat_g, fibre_g, sugar_g, sodium_mg, source, client_created_at')
      .eq('user_id', user.id)
      .order('log_date'),
    supabase.from('weight_history').select('measured_on, weight_kg').eq('user_id', user.id).order('measured_on'),
    supabase.from('diet_plans').select('week_start, title, status, estimated_cost_inr').eq('user_id', user.id),
  ]);

  if (format === 'json') {
    return new NextResponse(
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          account: { id: user.id, email: user.email },
          food_logs: logs ?? [],
          weights: weights ?? [],
          plans: plans ?? [],
        },
        null,
        2,
      ),
      {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="bharatbite-${stamp}.json"`,
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const header = [
    'log_date',
    'meal_type',
    'food_slug',
    'variant_slug',
    'grams',
    'kcal',
    'protein_g',
    'carbs_g',
    'fat_g',
    'sat_fat_g',
    'fibre_g',
    'sugar_g',
    'sodium_mg',
    'source',
    'logged_at',
  ];
  const rows = (logs ?? []).map((row) =>
    [
      row.log_date,
      row.meal_type,
      row.food_slug,
      row.variant_slug,
      row.grams,
      row.kcal,
      row.protein_g,
      row.carbs_g,
      row.fat_g,
      row.sat_fat_g,
      row.fibre_g,
      row.sugar_g,
      row.sodium_mg,
      row.source,
      row.client_created_at,
    ]
      .map(csvEscape)
      .join(','),
  );

  return new NextResponse([header.join(','), ...rows].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bharatbite-diary-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
