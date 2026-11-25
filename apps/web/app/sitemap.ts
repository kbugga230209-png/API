import type { MetadataRoute } from 'next';
import { getBundledFoods } from '@/lib/catalog';

const BASE = 'https://bharatbite.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const foods = getBundledFoods();
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/foods`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/download`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    ...foods.map((food) => ({
      url: `${BASE}/foods/${food.id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
