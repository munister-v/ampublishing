import { Book, BookVariant, Format, Language } from '../types';

export const DEFAULT_BOOK_FORMAT: Format = 'paperback';

const editionLanguage: Record<Language, string> = {
  ru: 'Русский',
  en: 'Russian',
  de: 'Russisch',
};

export const createDefaultBookVariant = (book: Book, language: Language): BookVariant => ({
  id: `${book.id || 'book'}-paperback`,
  format: DEFAULT_BOOK_FORMAT,
  language: editionLanguage[language],
  price: Number(book.price || 0),
  stock: Number(book.stock || 0),
  isbn: '',
});

export const ensureBookVariants = (book: Book, language: Language): BookVariant[] =>
  Array.isArray(book.variants) && book.variants.length > 0
    ? book.variants
    : [createDefaultBookVariant(book, language)];

export const getPrimaryBookVariant = (book: Book, language: Language): BookVariant =>
  ensureBookVariants(book, language)[0];

export const getBookFormats = (book: Book): Format[] => {
  const formats = Array.isArray(book.variants)
    ? book.variants.map(variant => variant.format).filter(Boolean)
    : [];
  return formats.length > 0 ? Array.from(new Set(formats)) : [DEFAULT_BOOK_FORMAT];
};
