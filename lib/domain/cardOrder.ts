/**
 * Merges the visible card order with the stored one. Visible ids come first
 * (deduplicated, first occurrence wins), then every stored id not yet placed,
 * in stored order. Never drops a stored id, so archived categories keep their
 * position. Does not mutate its inputs.
 */
export function mergeCardOrder(
  visible: readonly number[],
  stored: readonly number[],
): number[] {
  const seen = new Set<number>();
  const merged: number[] = [];
  for (const id of [...visible, ...stored]) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged;
}

/** True when every id is in the allowed set. */
export function checkCardOrderIds(
  ids: readonly number[],
  allowed: ReadonlySet<number>,
): boolean {
  return ids.every((id) => allowed.has(id));
}

/** Element-wise equality of two id lists. */
export function sameOrder(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
