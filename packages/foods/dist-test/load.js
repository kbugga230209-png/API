import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './build.js';
const here = dirname(fileURLToPath(import.meta.url));
// dist/ or src/ -> package root
const packageRoot = join(here, '..');
const dataDir = join(packageRoot, 'data');
function readJson(name) {
    return JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
}
export function loadSources() {
    return {
        ingredients: readJson('ingredients.json'),
        dishes: readJson('dishes.json'),
        regional: readJson('regional.json'),
        more: readJson('dishes_more.json'),
        direct: readJson('direct.json'),
    };
}
let cached = null;
/** Builds (and memoises) the bundled catalog from the checked-in JSON sources. */
export function buildBundledCatalog() {
    if (!cached)
        cached = buildCatalog(loadSources());
    return cached;
}
//# sourceMappingURL=load.js.map