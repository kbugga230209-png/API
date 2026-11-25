/** Script detection so a query typed in Gujarati hits the right alias rows. */
export function detectScript(input) {
    if (/[\u0A80-\u0AFF]/.test(input))
        return 'gu';
    if (/[\u0900-\u097F]/.test(input))
        return 'hi';
    if (/[\u0980-\u09FF]/.test(input))
        return 'bn';
    if (/[\u0B80-\u0BFF]/.test(input))
        return 'ta';
    if (/[\u0C00-\u0C7F]/.test(input))
        return 'te';
    if (/[\u0C80-\u0CFF]/.test(input))
        return 'kn';
    if (/[\u0D00-\u0D7F]/.test(input))
        return 'ml';
    if (/[\u0B00-\u0B7F]/.test(input))
        return 'or';
    if (/[\u0600-\u06FF]/.test(input))
        return 'ur';
    return null;
}
export function normalizeQuery(input) {
    return input
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\u0900-\u0DFF\u0600-\u06FF\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/** Collapse common Indian-English spelling variants so "chappati/chapati" match. */
export function phoneticKey(input) {
    return normalizeQuery(input)
        .replace(/ph/g, 'p')
        .replace(/th/g, 't')
        .replace(/dh/g, 'd')
        .replace(/bh/g, 'b')
        .replace(/gh/g, 'g')
        .replace(/kh/g, 'k')
        .replace(/chh?/g, 'c')
        .replace(/sh/g, 's')
        .replace(/aa+/g, 'a')
        .replace(/ee+/g, 'i')
        .replace(/oo+/g, 'u')
        .replace(/([a-z])\1+/g, '$1')
        .replace(/\s+/g, '');
}
export function levenshtein(a, b) {
    if (a === b)
        return 0;
    if (!a.length)
        return b.length;
    if (!b.length)
        return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
        const curr = [i];
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
        }
        prev = curr;
    }
    return prev[b.length] ?? 0;
}
/**
 * Offline search over the bundled food catalog. Scoring is intentionally simple
 * and explainable: exact alias > prefix > token subset > phonetic > fuzzy.
 */
export function searchFoods(foods, query, options = {}) {
    const normalized = normalizeQuery(query);
    if (!normalized)
        return [];
    const qKey = phoneticKey(normalized);
    const limit = options.limit ?? 20;
    const minScore = options.minScore ?? 0.35;
    const hits = [];
    for (const food of foods) {
        if (options.cuisine && food.cuisine !== options.cuisine)
            continue;
        const candidates = [
            { text: food.name, language: 'en' },
            ...(food.nameLocal
                ? [{ text: food.nameLocal, language: (detectScript(food.nameLocal) ?? 'hi') }]
                : []),
            ...food.aliases.map((a) => ({ text: a.alias, language: a.language })),
        ];
        let best = { score: 0, alias: food.name, language: 'en' };
        for (const candidate of candidates) {
            const n = normalizeQuery(candidate.text);
            if (!n)
                continue;
            let score = 0;
            if (n === normalized)
                score = 1;
            else if (n.startsWith(normalized))
                score = 0.9 - Math.min(0.2, (n.length - normalized.length) * 0.01);
            else if (normalized.startsWith(n))
                score = 0.82;
            else if (n.split(' ').every((tok) => normalized.split(' ').includes(tok)))
                score = 0.7;
            else if (phoneticKey(candidate.text) === qKey)
                score = 0.66;
            else {
                const distance = levenshtein(n, normalized);
                const ratio = 1 - distance / Math.max(n.length, normalized.length);
                score = ratio > 0.75 ? ratio * 0.75 : 0;
            }
            if (score > best.score)
                best = { score, alias: candidate.text, language: candidate.language };
        }
        if (best.score >= minScore) {
            hits.push({ food, score: Math.round(best.score * 100) / 100, matchedAlias: best.alias, matchedLanguage: best.language });
        }
    }
    return hits.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name)).slice(0, limit);
}
export function suggestDisambiguation(primary, catalog, limit = 3) {
    const primaryFamily = primary.tags?.[0] ?? primary.category;
    return catalog
        .filter((f) => f.id !== primary.id && (f.tags?.[0] ?? f.category) === primaryFamily)
        .slice(0, limit)
        .map((f) => {
        const variant = f.variants.find((v) => v.slug === f.defaultVariant) ?? f.variants[0];
        return {
            foodId: f.id,
            label: f.name,
            kcalPer100g: variant?.nutrition.kcal ?? 0,
            reason: `Also a ${primaryFamily.replace(/_/g, ' ')} — different preparation changes calories`,
        };
    });
}
//# sourceMappingURL=search.js.map