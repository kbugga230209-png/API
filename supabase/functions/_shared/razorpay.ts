// Shared Razorpay + HTTP helpers. Edge Functions are deployed as single files, so
// each function inlines the few helpers it needs; this file is the reference
// implementation used by the repository copies and the test suite.

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export type Env = {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  planMonthly?: string;
  planAnnual?: string;
  mode: 'test' | 'live';
};

export function readEnv(): Env {
  const mode = (Deno.env.get('RAZORPAY_MODE') ?? 'test') === 'live' ? 'live' : 'test';
  return {
    keyId: Deno.env.get('RAZORPAY_KEY_ID'),
    keySecret: Deno.env.get('RAZORPAY_KEY_SECRET'),
    webhookSecret: Deno.env.get('RAZORPAY_WEBHOOK_SECRET'),
    planMonthly: Deno.env.get('RAZORPAY_PLAN_MONTHLY_ID'),
    planAnnual: Deno.env.get('RAZORPAY_PLAN_ANNUAL_ID'),
    mode,
  };
}

export function razorpayConfigured(env: Env): boolean {
  return Boolean(env.keyId && env.keySecret);
}

export function missingCredentialsMessage(): string {
  return 'Razorpay is not configured on this project. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET as Supabase secrets. No charge was attempted.';
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison so signature checks cannot be timed. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function razorpayFetch(
  env: Env,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const auth = btoa(`${env.keyId}:${env.keySecret}`);
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

export const GRACE_PERIOD_DAYS = 3;
export const PLAN_PRICES_PAISE = {
  plus_monthly: 4900,
  plus_annual: 39900,
} as const;
export type PaidPlanCode = keyof typeof PLAN_PRICES_PAISE;

export function periodEndFrom(start: Date, plan: PaidPlanCode): Date {
  const days = plan === 'plus_monthly' ? 30 : 365;
  return new Date(start.getTime() + days * 86_400_000);
}

export function graceUntilFrom(end: Date): Date {
  return new Date(end.getTime() + GRACE_PERIOD_DAYS * 86_400_000);
}
