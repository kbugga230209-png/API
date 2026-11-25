// model-manifest — public, cached read of the currently published signed model
// manifest. The app verifies the Ed25519 signature and the SHA-256 of the
// artifact before it installs anything, so this endpoint is not trusted blindly.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const url = new URL(req.url);
  const modelId = url.searchParams.get('model_id') ?? 'bharatbite-indian-food-classifier';
  const channel = url.searchParams.get('channel') ?? 'stable';

  const { data, error } = await admin
    .from('model_versions')
    .select('manifest, version, channel, released_at')
    .eq('model_id', modelId)
    .eq('channel', channel)
    .eq('is_current', true)
    .maybeSingle();

  if (error) return json({ error: 'lookup_failed', detail: error.message }, 500);
  if (!data) {
    return json(
      {
        error: 'no_published_model',
        message:
          'No model has been published to this channel yet. The app must fall back to manual search and logging, and must not download anything.',
      },
      404,
      { 'Cache-Control': 'no-store' },
    );
  }

  return json(data.manifest, 200, { 'Cache-Control': 'public, max-age=300' });
});
