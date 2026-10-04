import { describe, expect, it } from "vitest";

import { VALIDATION_MESSAGES as M } from "@/lib/domain/messages";
import {
  checkBudgetCategory,
  checkTransactionReferences,
  parseBudgetAmount,
  parseCashbackBps,
  parsePositiveId,
  parseTransactionForm,
  parseWholePesos,
  type RawTransactionForm,
  type ReferenceFacts,
} from "@/lib/domain/validation";

describe("parseWholePesos", () => {
  it.each([
    ["33333", 33333],
    ["  500  ", 500],
    ["1", 1],
    ["999999999", 999_999_999],
    ["1.500", 1500],
    ["33.333", 33333],
    ["12.000.000", 12_000_000],
    ["  1.500  ", 1500],
  ])("accepts %j", (raw, value) => {
    expect(parseWholePesos(raw)).toEqual({ ok: true, value });
  });

  it.each([
    ["33,5", M.grossNotWhole],
    ["1.5", M.grossNotWhole],
    ["1.50", M.grossNotWhole],
    ["1,5", M.grossNotWhole],
    ["1.5000", M.grossNotWhole],
    [".500", M.grossNotWhole],
    ["1..500", M.grossNotWhole],
    ["1.500,5", M.grossNotWhole],
    ["1.", M.grossNotWhole],
    ["abc", M.grossNotWhole],
    ["12abc", M.grossNotWhole],
    ["0", M.grossNotPositive],
    ["-5", M.grossNotPositive],
    ["", M.grossRequired],
    ["   ", M.grossRequired],
    [undefined, M.grossRequired],
    ["1000000000", M.grossTooLarge],
  ])("rejects %j with its own message", (raw, message) => {
    expect(parseWholePesos(raw)).toEqual({ ok: false, errors: { value: message } });
  });
});

describe("parseCashbackBps", () => {
  it.each([
    ["", 0],
    [undefined, 0],
    ["   ", 0],
    ["0", 0],
    ["7", 700],
    ["0.29", 29],
    ["1.15", 115],
    ["7,5", 750],
    ["7.5", 750],
    ["12.34", 1234],
    ["100", 10000],
    ["100.00", 10000],
  ])("accepts %j as %i bps", (raw, value) => {
    expect(parseCashbackBps(raw)).toEqual({ ok: true, value });
  });

  it.each(["7.255", "100.01", "-1", "abc", "101", "7.", ".5", "1e2", "7 5"])(
    "rejects %j",
    (raw) => {
      expect(parseCashbackBps(raw)).toEqual({
        ok: false,
        errors: { value: M.cashbackInvalid },
      });
    },
  );
});

const VALID: RawTransactionForm = {
  type: "expense",
  gross: "33333",
  cashback: "7",
  categoryId: "3",
  memberId: "2",
  date: "2026-08-14T21:00",
};

describe("parseTransactionForm", () => {
  it("parses a valid expense", () => {
    const result = parseTransactionForm(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      type: "expense",
      gross: 33333,
      cashbackBps: 700,
      categoryId: 3,
      memberId: 2,
    });
    expect(result.value.date.toISOString()).toBe("2026-08-14T21:00:00.000Z");
  });

  it("forces cashback to 0 for income even with a stale value", () => {
    const result = parseTransactionForm({ ...VALID, type: "income", cashback: "7" });
    expect(result.ok && result.value.cashbackBps).toBe(0);
  });

  it("does not block an income save on an invalid stale cashback", () => {
    const result = parseTransactionForm({ ...VALID, type: "income", cashback: "abc" });
    expect(result.ok && result.value.cashbackBps).toBe(0);
  });

  it("ignores a submitted amount field", () => {
    const raw = { ...VALID, amount: "1" } as RawTransactionForm;
    const result = parseTransactionForm(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toHaveProperty("amount");
  });

  it("rejects an empty date instead of defaulting it", () => {
    expect(parseTransactionForm({ ...VALID, date: "" })).toEqual({
      ok: false,
      errors: { date: M.dateInvalid },
    });
  });

  it("takes no clock argument", () => {
    expect(parseTransactionForm.length).toBe(1);
  });

  it.each(["2026-02-30T10:00", "2026-08-14", "1999-01-01T10:00", "2100-01-01T10:00"])(
    "rejects the date %j",
    (date) => {
      expect(parseTransactionForm({ ...VALID, date })).toEqual({
        ok: false,
        errors: { date: M.dateInvalid },
      });
    },
  );

  it.each([undefined, "", "transfer", "EXPENSE"])("rejects the type %j", (type) => {
    const result = parseTransactionForm({ ...VALID, type });
    expect(result).toMatchObject({ ok: false, errors: { type: M.typeInvalid } });
  });

  it.each(["0", "-1", "1.5", "abc", "", undefined])(
    "rejects the non-positive or malformed category id %j",
    (categoryId) => {
      expect(parseTransactionForm({ ...VALID, categoryId })).toEqual({
        ok: false,
        errors: { categoryId: M.categoryRequired },
      });
    },
  );

  it.each(["0", "-1", "1.5", "abc", "", undefined])(
    "rejects the non-positive or malformed member id %j",
    (memberId) => {
      expect(parseTransactionForm({ ...VALID, memberId })).toEqual({
        ok: false,
        errors: { memberId: M.memberRequired },
      });
    },
  );

  it("accepts an edit id and rejects a malformed one", () => {
    expect(parseTransactionForm({ ...VALID, id: "9" }).ok).toBe(true);
    expect(parseTransactionForm({ ...VALID, id: "1; DROP" })).toMatchObject({
      ok: false,
      errors: { id: M.transactionNotFound },
    });
  });

  it("reports every invalid field at once", () => {
    const result = parseTransactionForm({
      type: "expense",
      gross: "0",
      cashback: "abc",
      categoryId: "",
      memberId: "",
      date: "",
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        gross: M.grossNotPositive,
        cashback: M.cashbackInvalid,
        categoryId: M.categoryRequired,
        memberId: M.memberRequired,
        date: M.dateInvalid,
      },
    });
  });
});

describe("parseBudgetAmount", () => {
  it("accepts a whole positive amount", () => {
    expect(parseBudgetAmount("150000")).toEqual({ ok: true, value: 150000 });
  });

  it("accepts thousands grouping with dots", () => {
    expect(parseBudgetAmount("12.000.000")).toEqual({ ok: true, value: 12_000_000 });
  });

  it.each(["1.5", "0", "-3", "", undefined, "abc", "1000000000"])(
    "rejects %j with the budget message",
    (raw) => {
      expect(parseBudgetAmount(raw)).toEqual({
        ok: false,
        errors: { amount: M.budgetAmountInvalid },
      });
    },
  );
});

describe("parsePositiveId", () => {
  it.each([
    ["7", 7],
    [7, 7],
    [" 12 ", 12],
  ])("accepts %j", (raw, expected) => {
    expect(parsePositiveId(raw)).toBe(expected);
  });

  it.each(["1; DROP", -1, "-1", 1.5, "1.5", {}, undefined, null, 0, "0", "", NaN, Infinity, []])(
    "rejects %j",
    (raw) => {
      expect(parsePositiveId(raw)).toBeNull();
    },
  );

  it("rejects ids beyond the safe integer range", () => {
    expect(parsePositiveId("9007199254740993")).toBeNull();
  });
});

describe("checkTransactionReferences", () => {
  const facts = (overrides: Partial<ReferenceFacts> = {}): ReferenceFacts => ({
    type: "expense",
    category: { id: 3, kind: "expense", archived: false },
    member: { id: 2, archived: false },
    existing: null,
    ...overrides,
  });

  it("accepts active, matching references", () => {
    expect(checkTransactionReferences(facts())).toEqual({});
  });

  it("flags a missing category and a missing member", () => {
    expect(checkTransactionReferences(facts({ category: null, member: null }))).toEqual({
      categoryId: M.categoryMissing,
      memberId: M.memberUnavailable,
    });
  });

  it("flags a category kind mismatch", () => {
    expect(
      checkTransactionReferences(
        facts({ category: { id: 3, kind: "income", archived: false } }),
      ),
    ).toEqual({ categoryId: M.categoryKindMismatch });
  });

  it("rejects an archived category and member on create", () => {
    expect(
      checkTransactionReferences(
        facts({
          category: { id: 3, kind: "expense", archived: true },
          member: { id: 2, archived: true },
        }),
      ),
    ).toEqual({ categoryId: M.categoryUnavailable, memberId: M.memberUnavailable });
  });

  it("allows an archived value on update only when it equals the stored one", () => {
    const archived = {
      category: { id: 3, kind: "expense" as const, archived: true },
      member: { id: 2, archived: true },
    };
    expect(
      checkTransactionReferences(
        facts({ ...archived, existing: { categoryId: 3, memberId: 2 } }),
      ),
    ).toEqual({});
    expect(
      checkTransactionReferences(
        facts({ ...archived, existing: { categoryId: 4, memberId: 5 } }),
      ),
    ).toEqual({ categoryId: M.categoryUnavailable, memberId: M.memberUnavailable });
  });
});

describe("checkBudgetCategory", () => {
  it("rejects a missing category", () => {
    expect(checkBudgetCategory(null, false)).toBe(M.categoryMissing);
  });

  it("rejects an income category", () => {
    expect(checkBudgetCategory({ kind: "income", archived: false }, false)).toBe(
      M.budgetCategoryNotExpense,
    );
  });

  it("accepts an active expense category", () => {
    expect(checkBudgetCategory({ kind: "expense", archived: false }, false)).toBeNull();
  });

  it("accepts an archived expense category only when a row exists this month", () => {
    expect(checkBudgetCategory({ kind: "expense", archived: true }, true)).toBeNull();
    expect(checkBudgetCategory({ kind: "expense", archived: true }, false)).toBe(
      M.categoryUnavailable,
    );
  });
});
