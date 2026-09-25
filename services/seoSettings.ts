import { contentStore } from './contentStore';
import type { SeoSettings } from '../types';
import { mergeSeoSettings } from '../seo/core.mjs';

/**
 * SEO-настройки (шаблон заголовков, мета страниц, коды верификации).
 * Хранятся в public/content/seo.json, пишутся тем же путём, что и остальной
 * контент (GitHub Contents API). Build-скрипт prerender-seo.mjs читает тот же файл.
 */

const CONTENT_URL = `${import.meta.env.BASE_URL}content/seo.json`;
const REPO_PATH = 'public/content/seo.json';

let cached: SeoSettings | null = null;
let loading: Promise<SeoSettings> | null = null;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const getSeoSettings = async (force = false): Promise<SeoSettings> => {
  if (cached && !force) return clone(cached);
  if (loading && !force) return loading.then(clone);
  loading = (async () => {
    try {
      const res = await fetch(CONTENT_URL, { cache: 'no-cache' });
      cached = mergeSeoSettings(res.ok ? await res.json() : null) as SeoSettings;
    } catch {
      cached = mergeSeoSettings(null) as SeoSettings;
    }
    return cached;
  })();
  const result = await loading;
  loading = null;
  return clone(result);
};

export const saveSeoSettings = async (settings: SeoSettings): Promise<SeoSettings> => {
  cached = mergeSeoSettings(settings) as SeoSettings;
  await contentStore.ghWritePublicFile(REPO_PATH, cached, 'admin: update SEO settings');
  return clone(cached);
};
