import { Format, Language } from '../types';

const labels: Record<Language, Record<Format, string>> = {
  ru: {
    hardcover: 'Твёрдая обложка',
    paperback: 'Мягкая обложка',
    digital: 'Цифровой отрывок',
    special_edition: 'Подарочный комплект',
  },
  en: {
    hardcover: 'Hardcover',
    paperback: 'Paperback',
    digital: 'Digital excerpt',
    special_edition: 'Gift set',
  },
  de: {
    hardcover: 'Hardcover',
    paperback: 'Taschenbuch',
    digital: 'Digitaler Auszug',
    special_edition: 'Geschenkset',
  },
};

export const formatLabel = (format: Format, language: Language) => labels[language][format] || format;
