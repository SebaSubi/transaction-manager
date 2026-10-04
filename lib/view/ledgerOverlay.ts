import type { LedgerRowView } from "@/lib/view/ledger";

/**
 * Optimistic overlay over the server-rendered ledger rows (design Decision 5).
 *
 * The provider holds `useOptimistic(EMPTY_OVERLAY, reduceOverlay)`. Because the
 * base is the constant empty overlay, it clears itself when the transition
 * ends, which is exactly when the revalidated server rows arrive. `replaced`
 * only ever holds rows the SERVER returned: the client never computes a net.
 */
export interface LedgerOverlay {
  pendingIds: readonly number[];
  removedIds: readonly number[];
  replaced: Readonly<Record<number, LedgerRowView>>;
}

export type OverlayAction =
  | { kind: "pending"; id: number }
  | { kind: "remove"; id: number }
  | { kind: "replace"; row: LedgerRowView };

export const EMPTY_OVERLAY: LedgerOverlay = {
  pendingIds: [],
  removedIds: [],
  replaced: {},
};

function withId(ids: readonly number[], id: number): readonly number[] {
  return ids.includes(id) ? ids : [...ids, id];
}

export function reduceOverlay(
  overlay: LedgerOverlay,
  action: OverlayAction,
): LedgerOverlay {
  switch (action.kind) {
    case "pending":
      return { ...overlay, pendingIds: withId(overlay.pendingIds, action.id) };
    case "remove":
      return { ...overlay, removedIds: withId(overlay.removedIds, action.id) };
    case "replace":
      return {
        ...overlay,
        pendingIds: overlay.pendingIds.filter((id) => id !== action.row.id),
        replaced: { ...overlay.replaced, [action.row.id]: action.row },
      };
  }
}

export function applyOverlay(
  rows: readonly LedgerRowView[],
  overlay: LedgerOverlay,
): Array<LedgerRowView & { pending: boolean }> {
  return rows
    .filter((row) => !overlay.removedIds.includes(row.id))
    .map((row) => ({
      ...(overlay.replaced[row.id] ?? row),
      pending: overlay.pendingIds.includes(row.id),
    }));
}
