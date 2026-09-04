/**
 * The number of accent colours in each cycle. This is the SINGLE numeric
 * coupling between the domain and `app/globals.css`, where both the light and
 * dark cycles are declared as `--accent-0` .. `--accent-5`.
 */
export const ACCENT_CYCLE_LENGTH = 6 as const;

/**
 * Applies a stored explicit order: known ids first, in `order`'s sequence,
 * then everything else in input order. Ids present in `order` but absent from
 * `categories` (archived) are skipped. Non-mutating.
 *
 * Generic over `T` so it works on full rows and view models alike, without the
 * domain knowing either shape.
 */
export function orderCategories<T extends { id: number }>(
  categories: readonly T[],
  order: readonly number[],
): T[] {
  const byId = new Map<number, T>(categories.map((category) => [category.id, category]));
  const placed = new Set<number>();
  const ordered: T[] = [];

  for (const id of order) {
    const category = byId.get(id);
    if (category !== undefined && !placed.has(id)) {
      ordered.push(category);
      placed.add(id);
    }
  }

  for (const category of categories) {
    if (!placed.has(category.id)) {
      ordered.push(category);
      placed.add(category.id);
    }
  }

  return ordered;
}

/**
 * Returns a CSS custom-property REFERENCE, never a hex literal.
 *
 * This is what keeps the effective theme out of React render state: the same
 * string is produced on the server and on the client, and the browser resolves
 * the light or dark palette from the `[data-theme]` attribute on `<html>`.
 * Returning a hex literal would force the theme into render — the one value the
 * server cannot know for `'system'` — and guarantee a hydration mismatch on
 * every category card (design §7).
 */
export function categoryColor(colorIndex: number): string {
  const wrapped =
    ((Math.trunc(colorIndex) % ACCENT_CYCLE_LENGTH) + ACCENT_CYCLE_LENGTH) %
    ACCENT_CYCLE_LENGTH;
  return `var(--accent-${wrapped})`;
}

/** The colour index a newly created category should take. */
export function nextColorIndex(activeCategoryCount: number): number {
  return (
    ((Math.trunc(activeCategoryCount) % ACCENT_CYCLE_LENGTH) + ACCENT_CYCLE_LENGTH) %
    ACCENT_CYCLE_LENGTH
  );
}
