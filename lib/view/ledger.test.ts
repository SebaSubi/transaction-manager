import { describe, expect, it } from "vitest";

import type { CategoryLabel } from "@/lib/db/repositories/categories.repository";
import type { MemberLabel } from "@/lib/db/repositories/members.repository";
import { categoryColor } from "@/lib/domain/categories";
import { toDateTimeLocalValue } from "@/lib/domain/time";
import type { DomainTransaction } from "@/lib/domain/types";
import { toLedgerRowView } from "@/lib/view/ledger";

function tx(overrides: Partial<DomainTransaction> = {}): DomainTransaction {
  return {
    id: 7,
    type: "expense",
    amount: 31000,
    gross: 33333,
    cashbackBps: 700,
    categoryId: 3,
    memberId: 2,
    date: new Date("2026-08-14T21:00:00Z"),
    ...overrides,
  };
}

function category(overrides: Partial<CategoryLabel> = {}): CategoryLabel {
  return {
    id: 3,
    name: "Supermercado",
    kind: "expense",
    icon: "shopping-cart",
    colorIndex: 4,
    archived: false,
    ...overrides,
  };
}

function member(overrides: Partial<MemberLabel> = {}): MemberLabel {
  return { id: 2, name: "Ana", archived: false, ...overrides };
}

describe("toLedgerRowView", () => {
  it("renders the signed net amount and the date label", () => {
    const view = toLedgerRowView(tx(), category(), member());

    expect(view.id).toBe(7);
    expect(view.type).toBe("expense");
    expect(view.amountLabel).toBe("-$31.000");
    expect(view.dateLabel).toBe("14 ago · 21:00");
  });

  it("shows gross and cashback labels only for an expense with cashback", () => {
    const view = toLedgerRowView(tx(), category(), member());

    expect(view.grossLabel).toBe("$33.333");
    expect(view.cashbackLabel).toBe("7% cashback");
  });

  it("omits gross and cashback labels for an expense without cashback", () => {
    const view = toLedgerRowView(
      tx({ cashbackBps: 0, gross: 31000 }),
      category(),
      member(),
    );

    expect(view.grossLabel).toBeNull();
    expect(view.cashbackLabel).toBeNull();
  });

  it("never shows gross or cashback for an income", () => {
    const view = toLedgerRowView(
      tx({ type: "income", amount: 50000, gross: 50000, cashbackBps: 0 }),
      category({ kind: "income" }),
      member(),
    );

    expect(view.amountLabel).toBe("+$50.000");
    expect(view.grossLabel).toBeNull();
    expect(view.cashbackLabel).toBeNull();
  });

  it("flags archived category and member", () => {
    const view = toLedgerRowView(
      tx(),
      category({ archived: true }),
      member({ archived: true }),
    );

    expect(view.category.archived).toBe(true);
    expect(view.member.archived).toBe(true);
  });

  it("derives the category color from the color index", () => {
    const view = toLedgerRowView(tx(), category({ colorIndex: 4 }), member());

    expect(view.category.color).toBe(categoryColor(4));
    expect(view.category).not.toHaveProperty("colorIndex");
    expect(view.category).toMatchObject({
      id: 3,
      name: "Supermercado",
      icon: "shopping-cart",
    });
    expect(view.member).toEqual({ id: 2, name: "Ana", archived: false });
  });

  it("seeds the edit form with input-ready strings", () => {
    const view = toLedgerRowView(
      tx({ cashbackBps: 750 }),
      category(),
      member(),
    );

    expect(view.edit).toEqual({
      gross: "33333",
      cashback: "7,5",
      dateValue: toDateTimeLocalValue(new Date("2026-08-14T21:00:00Z")),
    });
    expect(view.edit.dateValue).toBe("2026-08-14T21:00");
  });

  it("is serializable: no Date instance appears anywhere in the output", () => {
    const view = toLedgerRowView(tx(), category(), member());
    const containsDate = (value: unknown): boolean =>
      value instanceof Date ||
      (typeof value === "object" &&
        value !== null &&
        Object.values(value).some(containsDate));

    expect(containsDate(view)).toBe(false);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });
});
