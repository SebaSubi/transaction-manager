import { describe, expect, it } from "vitest";

import type { LedgerRowView } from "@/lib/view/ledger";
import {
  EMPTY_OVERLAY,
  applyOverlay,
  reduceOverlay,
} from "@/lib/view/ledgerOverlay";

function row(id: number, amountLabel = "-$100"): LedgerRowView {
  return {
    id,
    type: "expense",
    amountLabel,
    grossLabel: null,
    cashbackLabel: null,
    dateLabel: "1 ago · 10:00",
    category: { id: 1, name: "Cat", icon: "tag", archived: false, color: "var(--accent-1)" },
    member: { id: 1, name: "Ana", archived: false },
    edit: { gross: "100", cashback: "0", dateValue: "2026-08-01T10:00" },
  };
}

const ROWS = [row(1), row(2), row(3)];

describe("reduceOverlay", () => {
  it("marks a row pending", () => {
    const next = reduceOverlay(EMPTY_OVERLAY, { kind: "pending", id: 2 });
    expect(next.pendingIds).toEqual([2]);
    expect(next.removedIds).toEqual([]);
  });

  it("marks a row removed", () => {
    const next = reduceOverlay(EMPTY_OVERLAY, { kind: "remove", id: 2 });
    expect(next.removedIds).toEqual([2]);
  });

  it("stores a replacement and clears the pending flag for that row", () => {
    const pending = reduceOverlay(EMPTY_OVERLAY, { kind: "pending", id: 2 });
    const replacement = row(2, "-$999");
    const next = reduceOverlay(pending, { kind: "replace", row: replacement });

    expect(next.replaced[2]).toBe(replacement);
    expect(next.pendingIds).toEqual([]);
  });

  it("does not mutate the previous overlay and ignores duplicates", () => {
    const once = reduceOverlay(EMPTY_OVERLAY, { kind: "pending", id: 2 });
    const twice = reduceOverlay(once, { kind: "pending", id: 2 });

    expect(EMPTY_OVERLAY.pendingIds).toEqual([]);
    expect(twice.pendingIds).toEqual([2]);
  });
});

describe("applyOverlay", () => {
  it("returns rows unchanged (not pending) for the empty overlay", () => {
    const result = applyOverlay(ROWS, EMPTY_OVERLAY);

    expect(result).toEqual(ROWS.map((r) => ({ ...r, pending: false })));
  });

  it("dims pending rows only", () => {
    const overlay = reduceOverlay(EMPTY_OVERLAY, { kind: "pending", id: 2 });

    expect(applyOverlay(ROWS, overlay).map((r) => r.pending)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("hides removed rows", () => {
    const overlay = reduceOverlay(EMPTY_OVERLAY, { kind: "remove", id: 2 });

    expect(applyOverlay(ROWS, overlay).map((r) => r.id)).toEqual([1, 3]);
  });

  it("swaps a replaced row with the server-returned row in place", () => {
    const overlay = reduceOverlay(EMPTY_OVERLAY, {
      kind: "replace",
      row: row(2, "-$999"),
    });
    const result = applyOverlay(ROWS, overlay);

    expect(result.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(result[1].amountLabel).toBe("-$999");
  });

  it("ignores overlay entries for rows that are not in the list", () => {
    const overlay = reduceOverlay(EMPTY_OVERLAY, {
      kind: "replace",
      row: row(99),
    });

    expect(applyOverlay(ROWS, overlay).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("resets to the base rows when the overlay returns to EMPTY_OVERLAY", () => {
    const dirty = reduceOverlay(EMPTY_OVERLAY, { kind: "remove", id: 1 });

    expect(applyOverlay(ROWS, dirty)).toHaveLength(2);
    expect(applyOverlay(ROWS, EMPTY_OVERLAY)).toHaveLength(3);
  });
});
