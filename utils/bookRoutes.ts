import { Book } from '../types';

export const getBookPath = (book: Pick<Book, 'id'>) => `/product/${encodeURIComponent(book.id)}`;

export const findBookByRouteId = (books: Book[], routeId?: string | null) => {
  const decoded = decodeURIComponent(routeId || '');
  return books.find(book => book.id === decoded || (book.aliases || []).includes(decoded));
};

export const isAliasRoute = (book: Pick<Book, 'id' | 'aliases'> | null | undefined, routeId?: string | null) => {
  if (!book) return false;
  return decodeURIComponent(routeId || '') !== book.id;
};
