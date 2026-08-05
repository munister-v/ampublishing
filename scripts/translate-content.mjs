#!/usr/bin/env node
// Translate public/content/*.ru.json → *.en.json / *.de.json via DeepL.
// Only fills strings that are missing in the target locale; manual edits are preserved.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'public/content');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Пауза между запросами: free-тариф не любит плотных серий. */
const REQUEST_GAP_MS = Number(process.env.DEEPL_GAP_MS || 350);

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
if (!DEEPL_API_KEY) {
  // Раньше здесь был тихий выход с кодом 0: workflow годами показывал зелёные
  // галочки, а переводы не делались, и это заметили только по пустому каталогу
  // на EN/DE. Пусть лучше падает громко.
  console.error('DEEPL_API_KEY not set — перевод не выполнен.');
  process.exit(1);
}

const DEEPL_ENDPOINT = DEEPL_API_KEY.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate';

const TARGET_LANG = { en: 'EN-US', de: 'DE' };

// Keys whose values must NEVER be translated (identifiers, URLs, numerics, dates, enums).
const SKIP_KEYS = new Set([
  'id', 'coverUrl', 'featureImageUrl', 'detailPageUrl', 'isbn',
  'releaseDate', 'badges', 'type', 'isPreorder', 'ageRating', 'format',
  'purchaseLinks', 'price', 'oldPrice', 'stock', 'pages', 'year',
  'variants',
]);

const VARIANT_LANG_MAP = {
  'Русский': { en: 'Russian', de: 'Russisch' },
};

const isUrlOrId = (s) =>
  /^(https?:\/\/|data:|mailto:|ambook-|news-|AM-|ORD-)/.test(s);

// Tiny LRU-ish cache to avoid duplicate DeepL calls within a single run.
const cache = new Map();

async function deeplTranslate(text, lang) {
  const cacheKey = `${lang}|${text}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const body = new URLSearchParams();
  body.set('text', text);
  body.set('source_lang', 'RU');
  body.set('target_lang', TARGET_LANG[lang]);
  body.set('preserve_formatting', '1');

  // Бесплатный тариф DeepL режет частоту запросов, а дерево контента —
  // это сотни отдельных строк подряд. Без пауз и повторов первый же прогон
  // валится с 429 и не переводит вообще ничего.
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(DEEPL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    // 429 — превышена частота, 456 — исчерпана квота символов (её ждать
    // бессмысленно, поэтому падаем сразу с понятным текстом).
    if (res.status === 456) {
      throw new Error('DeepL 456: месячная квота символов исчерпана');
    }
    if (res.status !== 429 && res.status < 500) break;
    if (attempt >= 5) break;

    const wait = Math.min(30000, 1500 * 2 ** attempt);
    console.log(`DeepL ${res.status}, повтор через ${Math.round(wait / 1000)} с…`);
    await sleep(wait);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepL ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  // Небольшая пауза между строками — ровный темп дешевле, чем ловить 429
  // и ждать секундами на повторах.
  await sleep(REQUEST_GAP_MS);
  const out = data?.translations?.[0]?.text ?? text;
  cache.set(cacheKey, out);
  return out;
}

async function translateTree(value, lang, parentKey) {
  if (parentKey && SKIP_KEYS.has(parentKey)) {
    if (parentKey === 'variants' && Array.isArray(value)) {
      return value.map(v => ({
        ...v,
        language: VARIANT_LANG_MAP[v.language]?.[lang] ?? v.language,
      }));
    }
    return value;
  }

  if (parentKey === 'language' && typeof value === 'string') {
    return VARIANT_LANG_MAP[value]?.[lang] ?? value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (isUrlOrId(trimmed)) return value;
    if (!/[А-Яа-яЁё]/.test(trimmed)) return value;
    return await deeplTranslate(value, lang);
  }

  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await translateTree(v, lang, parentKey));
    return out;
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = await translateTree(v, lang, k);
    }
    return out;
  }

  return value;
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// Deep-merge: prefer existing (manual) values, fall back to translated.
function mergeKeepingManual(translated, existing) {
  if (existing === undefined || existing === null) return translated;

  if (typeof translated === 'string') {
    return isNonEmptyString(existing) ? existing : translated;
  }
  if (Array.isArray(translated)) {
    if (!Array.isArray(existing)) return translated;
    return translated.map((item, i) => mergeKeepingManual(item, existing[i]));
  }
  if (translated && typeof translated === 'object') {
    if (typeof existing !== 'object' || Array.isArray(existing)) return translated;
    const out = {};
    for (const key of Object.keys(translated)) {
      out[key] = mergeKeepingManual(translated[key], existing[key]);
    }
    return out;
  }
  return existing !== undefined ? existing : translated;
}

async function loadJson(file) {
  try {
    const raw = await readFile(path.join(ROOT, file), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function saveJson(file, value) {
  const target = path.join(ROOT, file);
  const text = JSON.stringify(value, null, 2) + '\n';
  await writeFile(target, text, 'utf8');
}

function indexById(arr) {
  const m = new Map();
  if (!Array.isArray(arr)) return m;
  for (const item of arr) if (item && item.id) m.set(item.id, item);
  return m;
}

async function syncCollection(file) {
  const ruFile = `${file}.ru.json`;
  const ru = await loadJson(ruFile);
  if (!Array.isArray(ru)) return;

  for (const lang of ['en', 'de']) {
    const existing = (await loadJson(`${file}.${lang}.json`)) || [];
    const existingIndex = indexById(existing);

    const result = [];
    for (const ruItem of ru) {
      const prev = existingIndex.get(ruItem.id);
      const translated = await translateTree(ruItem, lang, null);
      result.push(mergeKeepingManual(translated, prev));
    }

    await saveJson(`${file}.${lang}.json`, result);
    console.log(`✔ ${file}.${lang}.json (${result.length} items)`);
  }
}

async function syncOverrides() {
  const ru = (await loadJson('translation-overrides.ru.json')) || {};
  for (const lang of ['en', 'de']) {
    const existing = (await loadJson(`translation-overrides.${lang}.json`)) || {};
    const translated = await translateTree(ru, lang, null);
    const merged = mergeKeepingManual(translated, existing);
    await saveJson(`translation-overrides.${lang}.json`, merged);
    console.log(`✔ translation-overrides.${lang}.json (${Object.keys(merged).length} keys)`);
  }
}

// Services page: a single object (not a collection). Same merge rule —
// anything already translated by hand in EN/DE wins over DeepL output.
async function syncServices() {
  const ru = await loadJson('services.ru.json');
  if (!ru || typeof ru !== 'object') return;

  for (const lang of ['en', 'de']) {
    const existing = (await loadJson(`services.${lang}.json`)) || {};
    const translated = await translateTree(ru, lang, null);
    const merged = mergeKeepingManual(translated, existing);
    await saveJson(`services.${lang}.json`, merged);
    console.log(`✔ services.${lang}.json (${(merged.items || []).length} services)`);
  }
}

async function main() {
  console.log(`DeepL endpoint: ${DEEPL_ENDPOINT}`);
  await syncCollection('books');
  await syncCollection('news');
  await syncOverrides();
  await syncServices();
  console.log('Translation pass complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
