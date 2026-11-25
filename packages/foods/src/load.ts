import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, type CatalogResult } from './build.js';
import type { RawDirectFile, RawDishFile, RawIngredientFile } from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));
// dist/ or src/ -> package root
const packageRoot = join(here, '..');
const dataDir = join(packageRoot, 'data');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf8')) as T;
}

export function loadSources() {
  return {
    ingredients: readJson<RawIngredientFile>('ingredients.json'),
    dishes: readJson<RawDishFile>('dishes.json'),
    regional: readJson<RawDishFile>('regional.json'),
    more: readJson<RawDishFile>('dishes_more.json'),
    direct: readJson<RawDirectFile>('direct.json'),
  };
}

let cached: CatalogResult | null = null;

/** Builds (and memoises) the bundled catalog from the checked-in JSON sources. */
export function buildBundledCatalog(): CatalogResult {
  if (!cached) cached = buildCatalog(loadSources());
  return cached;
}
