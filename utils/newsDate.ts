import type { Language } from '../types';

/**
 * Единый формат даты для новостей.
 *
 * В контенте даты лежат как придётся: часть постов сохранена в ISO
 * («2026-07-12»), часть — уже готовой строкой («May 03, 2026»), потому что
 * редактор вводил их вручную в разное время. На сайте это читалось как
 * небрежность: две соседние новости в разных форматах.
 *
 * Разбираем то, что похоже на дату, и показываем на языке страницы. Всё, что
 * распознать не удалось, отдаём как есть — лучше исходная строка, чем «Invalid
 * Date» на видном месте.
 */

const LOCALE: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-GB',
  de: 'de-DE',
};

export function formatNewsDate(raw: string, language: Language): string {
  const value = (raw ?? '').trim();
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(LOCALE[language] ?? 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
