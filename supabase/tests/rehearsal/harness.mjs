// Loads the *real* Edge Function source and runs it under Node.
//
// The functions are Deno programs: they import `npm:@supabase/supabase-js`,
// call `Deno.serve` and read `Deno.env`. Rather than re-implement their logic in
// a test double (which would prove nothing about the deployed code), this loader
// transpiles the shipped TypeScript, rewrites only the npm: specifier, installs
// a small `Deno` shim plus a fake Supabase client and a fake Razorpay API, then
// hands back the request handler the function registered.
//
// What this does prove: signature verification, idempotency, entitlement
// arithmetic, status transitions and error paths are exactly the shipped logic.
// What it cannot prove: Postgres behaviour (RLS, unique indexes, the
// apply_entitlement SQL). That needs the database and is covered separately.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { FakeDb, clearContext, setContext } from './fake-supabase.mjs';

export const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const BUILD_DIR = join(REPO_ROOT, 'supabase/tests/rehearsal/.build');
const SHIM_URL = pathToFileURL(join(REPO_ROOT, 'supabase/tests/rehearsal/fake-supabase.mjs')).href;

let importCounter = 0;

export { FakeDb };

/**
 * @param {string} relativePath path to the function, e.g. 'razorpay-webhook/index.ts'
 * @param {object} options
 */
export async function loadFunction(relativePath, options) {
  const { env = {}, db, user = null, razorpay } = options;
  const sourcePath = join(REPO_ROOT, 'supabase/functions', relativePath);
  const source = readFileSync(sourcePath, 'utf8').replace("'npm:@supabase/supabase-js@2'", `'${SHIM_URL}'`);
  if (source.includes('npm:@')) throw new Error(`${relativePath} still imports a Deno npm specifier that the harness cannot resolve`);

  const transpiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, sourceMap: false },
    fileName: sourcePath,
  }).outputText;

  const outFile = join(BUILD_DIR, `${relativePath.replace(/[/.]/g, '_')}.${importCounter++}.mjs`);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, transpiled);

  let handler = null;
  const shim = {
    env: { get: (key) => env[key] },
    serve: (fn) => {
      handler = fn;
    },
  };

  // Import with the shim installed so module-level `Deno.serve` registration and
  // any top-level env reads work, then hand back a wrapper that reinstalls the
  // shim for each request — the functions call Deno.env.get at request time.
  const previous = { Deno: globalThis.Deno, fetch: globalThis.fetch };
  globalThis.Deno = shim;
  setContext({ db, anonKey: env.SUPABASE_ANON_KEY, user });
  if (razorpay) globalThis.fetch = razorpay.fetch;
  try {
    await import(`${pathToFileURL(outFile).href}?v=${importCounter}`);
  } finally {
    globalThis.Deno = previous.Deno;
    globalThis.fetch = previous.fetch;
    clearContext();
  }

  if (typeof handler !== 'function') throw new Error(`${relativePath} did not register a handler with Deno.serve`);

  const registered = handler;
  const wrapped = async (request) => {
    const saved = { Deno: globalThis.Deno, fetch: globalThis.fetch };
    globalThis.Deno = shim;
    setContext({ db, anonKey: env.SUPABASE_ANON_KEY, user });
    if (razorpay) globalThis.fetch = razorpay.fetch;
    try {
      return await registered(request);
    } finally {
      globalThis.Deno = saved.Deno;
      globalThis.fetch = saved.fetch;
      clearContext();
    }
  };

  return { handler: wrapped, env, db, razorpay };
}

/** Build a Request the way Razorpay (or the app) would send it. */
export function jsonRequest(url, body, headers = {}, method = 'POST') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export async function readJson(response) {
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

export async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
