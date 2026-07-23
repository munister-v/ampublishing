/**
 * Deterministic 3-digit "plate number" for a book's FIG. badge on the product
 * page. Book ids are content slugs (e.g. "orden-ne-spravedlivosti"), not
 * numbers, so showing them raw looked like a leaked internal identifier
 * rather than an editorial catalog-plate number. Hashing keeps it stable
 * across renders/languages without needing an admin-managed sequence field.
 */
export function figureNumber(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return String((hash % 999) + 1).padStart(3, '0');
}
