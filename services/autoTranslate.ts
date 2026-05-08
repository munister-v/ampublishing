import { Book, BookTheme, BookReview, BookStory, Language, NewsItem } from '../types';

const exactTextMap: Record<string, { en: string; de: string }> = {
  'Всё, что останется': { en: 'Everything That Will Remain', de: 'Alles, was bleibt' },
  'Сергей Калинин': { en: 'Sergey Kalinin', de: 'Sergey Kalinin' },
  'AM Publishing Berlin': { en: 'AM Publishing Berlin', de: 'AM Publishing Berlin' },
  'Малый тираж': { en: 'Limited print run', de: 'Kleine Auflage' },
  'Твёрдая обложка': { en: 'Hardcover edition', de: 'Hardcover-Ausgabe' },
  'Офсетная печать': { en: 'Offset printing', de: 'Offsetdruck' },
  'Доставка в 59 стран мира.': { en: 'Shipping to 59 countries worldwide.', de: 'Versand in 59 Länder weltweit.' },
};

const phraseMap: Array<{ ru: string; en: string; de: string }> = [
  { ru: 'Современная проза', en: 'Contemporary fiction', de: 'Zeitgenössische Prosa' },
  { ru: 'Психологическая литература', en: 'Psychological prose', de: 'Psychologische Literatur' },
  { ru: 'русскоязычное издательство', en: 'Russian-language publishing house', de: 'russischsprachiger Verlag' },
  { ru: 'издательство', en: 'publishing house', de: 'Verlag' },
  { ru: 'современную литературную прозу', en: 'contemporary literary prose', de: 'zeitgenössische literarische Prosa' },
  { ru: 'Берлине', en: 'Berlin', de: 'Berlin' },
  { ru: 'Берлин', en: 'Berlin', de: 'Berlin' },
  { ru: 'книга', en: 'book', de: 'Buch' },
  { ru: 'книги', en: 'books', de: 'Bücher' },
  { ru: 'роман', en: 'novel', de: 'Roman' },
  { ru: 'романа', en: 'novel', de: 'Romans' },
  { ru: 'автор', en: 'author', de: 'Autor' },
  { ru: 'автора', en: 'author', de: 'Autor' },
  { ru: 'авторы', en: 'authors', de: 'Autor:innen' },
  { ru: 'рукопись', en: 'manuscript', de: 'Manuskript' },
  { ru: 'рукописи', en: 'manuscripts', de: 'Manuskripte' },
  { ru: 'доставка', en: 'shipping', de: 'Versand' },
  { ru: 'оплата', en: 'payment', de: 'Zahlung' },
  { ru: 'счёт', en: 'invoice', de: 'Rechnung' },
  { ru: 'инвойс', en: 'invoice', de: 'Rechnung' },
  { ru: 'предзаказ', en: 'preorder', de: 'Vorbestellung' },
  { ru: 'малый тираж', en: 'limited print run', de: 'kleine Auflage' },
  { ru: 'твёрдая обложка', en: 'hardcover edition', de: 'Hardcover-Ausgabe' },
  { ru: 'офсетная печать', en: 'offset printing', de: 'Offsetdruck' },
  { ru: 'Май', en: 'May', de: 'Mai' },
  { ru: 'май', en: 'May', de: 'Mai' },
  { ru: 'Июнь', en: 'June', de: 'Juni' },
  { ru: 'июнь', en: 'June', de: 'Juni' },
  { ru: 'возвращении', en: 'return', de: 'Rückkehr' },
  { ru: 'памяти', en: 'memory', de: 'Erinnerung' },
  { ru: 'прошлое', en: 'the past', de: 'die Vergangenheit' },
  { ru: 'которые', en: 'that', de: 'die' },
  { ru: 'мы', en: 'we', de: 'wir' },
  { ru: 'вы', en: 'you', de: 'Sie' },
  { ru: 'и', en: 'and', de: 'und' },
];

const translitMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const transliterate = (value: string) =>
  value.replace(/[А-Яа-яЁё]/g, char => {
    const lower = char.toLowerCase();
    const mapped = translitMap[lower] || lower;
    return char === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
  });

const translateString = (value: string, target: Exclude<Language, 'ru'>): string => {
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (exactTextMap[trimmed]) return exactTextMap[trimmed][target];
  if (/^(https?:\/\/|data:|mailto:|AM-|ORD-|news-|book-)/.test(trimmed)) return value;
  if (!/[А-Яа-яЁё]/.test(trimmed)) return value;

  let output = value;
  for (const item of phraseMap.sort((a, b) => b.ru.length - a.ru.length)) {
    const replacement = target === 'en' ? item.en : item.de;
    output = output.replaceAll(item.ru, replacement);
  }

  if (/[А-Яа-яЁё]/.test(output)) {
    output = transliterate(output);
  }

  return output;
};

const translateTextArray = (items: string[], target: Exclude<Language, 'ru'>) =>
  items.map(item => translateString(item, target));

const translateThemes = (items: BookTheme[], target: Exclude<Language, 'ru'>): BookTheme[] =>
  items.map(item => ({
    title: translateString(item.title, target),
    text: translateString(item.text, target),
  }));

const translateReviews = (items: BookReview[], target: Exclude<Language, 'ru'>): BookReview[] =>
  items.map(item => ({
    quote: translateString(item.quote, target),
    author: translateString(item.author, target),
  }));

const translateStory = (story: BookStory | undefined, target: Exclude<Language, 'ru'>): BookStory | undefined => {
  if (!story) return story;
  return {
    ...story,
    quote: story.quote ? translateString(story.quote, target) : story.quote,
    quoteSource: story.quoteSource ? translateString(story.quoteSource, target) : story.quoteSource,
    about: translateTextArray(story.about || [], target),
    excerpt: translateTextArray(story.excerpt || [], target),
    authorBio: translateTextArray(story.authorBio || [], target),
    themes: translateThemes(story.themes || [], target),
    reviews: translateReviews(story.reviews || [], target),
    orderNote: story.orderNote ? translateString(story.orderNote, target) : story.orderNote,
    featureImageUrl: story.featureImageUrl,
    detailPageUrl: story.detailPageUrl,
  };
};

const translatedVariantLanguage = (value: string, target: Exclude<Language, 'ru'>) => {
  if (value === 'Русский') return target === 'en' ? 'Russian' : 'Russisch';
  return translateString(value, target);
};

export const autoTranslateValue = (value: any, target: Exclude<Language, 'ru'>): any => {
  if (typeof value === 'string') return translateString(value, target);
  if (Array.isArray(value)) return value.map(item => autoTranslateValue(item, target));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, autoTranslateValue(entry, target)])
  );
};

export const autoTranslateBookFromRu = (book: Book, target: Exclude<Language, 'ru'>): Book => ({
  ...book,
  title: translateString(book.title, target),
  author: translateString(book.author, target),
  description: translateString(book.description, target),
  genre: translateTextArray(book.genre || [], target),
  series: book.series ? translateString(book.series, target) : book.series,
  details: {
    ...book.details,
    publisher: book.details.publisher ? translateString(book.details.publisher, target) : book.details.publisher,
    weight: book.details.weight ? translateString(book.details.weight, target) : book.details.weight,
    dimensions: book.details.dimensions ? translateString(book.details.dimensions, target) : book.details.dimensions,
  },
  variants: (book.variants || []).map(variant => ({
    ...variant,
    language: translatedVariantLanguage(variant.language, target),
  })),
  story: translateStory(book.story, target),
});

export const autoTranslateNewsFromRu = (item: NewsItem, target: Exclude<Language, 'ru'>): NewsItem => ({
  ...item,
  title: translateString(item.title, target),
  preview: translateString(item.preview, target),
});
