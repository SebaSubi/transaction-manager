import { describe, expect, it } from "vitest";

import type { CategoryLabel } from "@/lib/db/repositories/categories.repository";
import type { MemberLabel } from "@/lib/db/repositories/members.repository";
import { filterTransactions } from "@/lib/domain/transactions";
import type { DomainTransaction } from "@/lib/domain/types";
import { buildLedgerFilterOptions } from "@/lib/view/ledgerFilterOptions";

function categoryLabel(id: number, name: string, archived = false): CategoryLabel {
  return { id, name, kind: "expense", icon: "tag", colorIndex: 0, archived };
}

function memberLabel(id: number, name: string, archived = false): MemberLabel {
  return { id, name, archived };
}

const ACTIVE_CATEGORIES = [
  { id: 1, name: "Supermercado" },
  { id: 2, name: "Transporte" },
];
const ACTIVE_MEMBERS = [
  { id: 1, name: "Ana" },
  { id: 2, name: "Beto" },
];

describe("buildLedgerFilterOptions", () => {
  it("returns the active lists when the month references only active entries", () => {
    const options = buildLedgerFilterOptions({
      activeCategories: ACTIVE_CATEGORIES,
      activeMembers: ACTIVE_MEMBERS,
      monthCategoryLabels: [categoryLabel(1, "Supermercado")],
      monthMemberLabels: [memberLabel(1, "Ana")],
    });

    expect(options.categories).toEqual([
      { id: 1, name: "Supermercado", archived: false },
      { id: 2, name: "Transporte", archived: false },
    ]);
    expect(options.members).toEqual([
      { id: 1, name: "Ana", archived: false },
      { id: 2, name: "Beto", archived: false },
    ]);
  });

  it("adds an archived category and member referenced by the month, marked archived", () => {
    const options = buildLedgerFilterOptions({
      activeCategories: ACTIVE_CATEGORIES,
      activeMembers: ACTIVE_MEMBERS,
      monthCategoryLabels: [categoryLabel(9, "Gimnasio", true)],
      monthMemberLabels: [memberLabel(8, "Carla", true)],
    });

    expect(options.categories.at(-1)).toEqual({
      id: 9,
      name: "Gimnasio",
      archived: true,
    });
    expect(options.members.at(-1)).toEqual({ id: 8, name: "Carla", archived: true });
  });

  it("does not offer archived entries the month does not reference", () => {
    const options = buildLedgerFilterOptions({
      activeCategories: ACTIVE_CATEGORIES,
      activeMembers: ACTIVE_MEMBERS,
      monthCategoryLabels: [],
      monthMemberLabels: [],
    });

    expect(options.categories.map((o) => o.id)).toEqual([1, 2]);
    expect(options.members.map((o) => o.id)).toEqual([1, 2]);
  });

  it("collapses duplicates by id", () => {
    const options = buildLedgerFilterOptions({
      activeCategories: ACTIVE_CATEGORIES,
      activeMembers: ACTIVE_MEMBERS,
      monthCategoryLabels: [
        categoryLabel(9, "Gimnasio", true),
        categoryLabel(9, "Gimnasio", true),
        categoryLabel(1, "Supermercado"),
      ],
      monthMemberLabels: [memberLabel(1, "Ana"), memberLabel(1, "Ana")],
    });

    expect(options.categories.map((o) => o.id)).toEqual([1, 2, 9]);
    expect(options.members.map((o) => o.id)).toEqual([1, 2]);
  });

  it("orders active entries in repository order, then archived by name", () => {
    const options = buildLedgerFilterOptions({
      activeCategories: [
        { id: 5, name: "Zeta" },
        { id: 2, name: "Alfa" },
      ],
      activeMembers: [],
      monthCategoryLabels: [
        categoryLabel(8, "Viajes", true),
        categoryLabel(7, "Bar", true),
      ],
      monthMemberLabels: [],
    });

    expect(options.categories.map((o) => o.name)).toEqual([
      "Zeta",
      "Alfa",
      "Bar",
      "Viajes",
    ]);
  });

  it("applies an unknown selected id in the filter but never adds it as an option", () => {
    const input = {
      activeCategories: ACTIVE_CATEGORIES,
      activeMembers: ACTIVE_MEMBERS,
      monthCategoryLabels: [categoryLabel(1, "Supermercado")],
      monthMemberLabels: [memberLabel(1, "Ana")],
    };
    const options = buildLedgerFilterOptions(input);
    const transactions: DomainTransaction[] = [
      {
        id: 1,
        type: "expense",
        amount: 100,
        gross: 100,
        cashbackBps: 0,
        categoryId: 1,
        memberId: 1,
        date: new Date("2026-08-10T10:00:00Z"),
      },
    ];

    const filtered = filterTransactions(transactions, {
      type: "all",
      categoryId: 4242,
      memberId: "all",
      from: null,
      to: null,
    });

    expect(filtered).toEqual([]);
    expect(options.categories.map((o) => o.id)).toEqual([1, 2]);
    expect(options.members.map((o) => o.id)).toEqual([1, 2]);
  });
});
