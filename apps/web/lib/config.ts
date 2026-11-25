/**
 * Public project configuration.
 *
 * The anon key is a publishable key: every table it can reach is protected by
 * RLS, and it grants no write access to catalog, billing or entitlement tables.
 * It is still overridable by environment variables so projects can be swapped
 * without editing source.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xetdzgsbzjctenhelaki.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGR6Z3NiempjdGVuaGVsYWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1OTM2MTUsImV4cCI6MjExMTE2OTYxNX0.lVeGrodiueGDKLlv5HZU-QbQvyAqvQNKYzzkizP60oU';

export const PLUS_MONTHLY_INR = 49;
export const PLUS_ANNUAL_INR = 399;

export const APP_VERSION = '0.1.0';
export const GITHUB_REPO = 'https://github.com/kbugga230209-png/API';
export const GITHUB_RELEASES = `${GITHUB_REPO}/releases`;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
