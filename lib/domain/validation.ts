import { VALIDATION_MESSAGES as M } from "@/lib/domain/messages";
import { parseDateTimeLocal } from "@/lib/domain/time";
import type { TransactionType } from "@/lib/domain/types";

export type TransactionField =
  | "type"
  | "gross"
  | "cashback"
  | "categoryId"
  | "memberId"
  | "date"
  | "id";
export type FieldErrors<F extends string> = Partial<Record<F, string>>;
export type ParseResult<T, F extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<F> };

export interface RawTransactionForm {
  id?: string;
  type?: string;
  gross?: string;
  cashback?: string;
  categoryId?: string;
  memberId?: string;
  date?: string;
}

export interface ParsedTransactionInput {
  type: TransactionType;
  gross: number;
  cashbackBps: number;
  categoryId: number;
  memberId: number;
  /** Wall-clock. */
  date: Date;
}

const MAX_WHOLE_PESOS = 999_999_999;
const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

/** Parses a whole, positive amount of pesos; every failure has its own message. */
export function parseWholePesos(raw: string | undefined): ParseResult<number, "value"> {
  const text = (raw ?? "").trim();
  if (text === "") return { ok: false, errors: { value: M.grossRequired } };
  if (/^-\d+$/.test(text)) return { ok: false, errors: { value: M.grossNotPositive } };
  // Plain digits, or valid es-AR thousands grouping ('1.500', '12.000.000').
  const plain = /^\d+$/.test(text);
  if (!plain && !/^\d{1,3}(\.\d{3})+$/.test(text)) {
    return { ok: false, errors: { value: M.grossNotWhole } };
  }

  const value = Number(plain ? text : text.replace(/\./g, ""));
  if (value === 0) return { ok: false, errors: { value: M.grossNotPositive } };
  if (value > MAX_WHOLE_PESOS) return { ok: false, errors: { value: M.grossTooLarge } };
  return { ok: true, value };
}

/**
 * Parses a cashback percent ('7', '0.29', '7,5') into integer basis points by
 * STRING arithmetic, never through a float: "0.29" must be exactly 29 and
 * "1.15" exactly 115. An empty value means no cashback.
 */
export function parseCashbackBps(raw: string | undefined): ParseResult<number, "value"> {
  const text = (raw ?? "").trim();
  if (text === "") return { ok: true, value: 0 };

  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text);
  if (match === null) return { ok: false, errors: { value: M.cashbackInvalid } };

  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (bps > 10_000) return { ok: false, errors: { value: M.cashbackInvalid } };
  return { ok: true, value: bps };
}

/** A positive safe integer from a string or number, otherwise `null`. */
export function parsePositiveId(raw: unknown): number | null {
  let value: number;
  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "string" && /^\s*\d+\s*$/.test(raw)) {
    value = Number(raw.trim());
  } else {
    return null;
  }
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export const NAME_MAX_LENGTH = 40;

/** Trims a display name; blank, non-string and over-long (by code point) fail. */
export function parseName(raw: unknown): ParseResult<string, "name"> {
  if (typeof raw !== "string") return { ok: false, errors: { name: M.nameRequired } };
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, errors: { name: M.nameRequired } };
  if ([...trimmed].length > NAME_MAX_LENGTH) {
    return { ok: false, errors: { name: M.nameTooLong } };
  }
  return { ok: true, value: trimmed };
}

/**
 * A list of positive ids, deduplicated (first occurrence wins), or `null` when
 * the input is not an array, is longer than `max` (checked before
 * deduplication) or holds any invalid id.
 */
export function parseIdList(raw: unknown, max: number): number[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null;
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const item of raw) {
    const id = parsePositiveId(item);
    if (id === null) return null;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function parseType(raw: string | undefined): TransactionType | null {
  return raw === "expense" || raw === "income" ? raw : null;
}

function parseDate(raw: string | undefined): Date | null {
  const date = parseDateTimeLocal((raw ?? "").trim());
  if (date === null) return null;
  const year = date.getUTCFullYear();
  return year >= MIN_YEAR && year <= MAX_YEAR ? date : null;
}

/**
 * Validates the whole transaction form. Pure, never throws, takes no clock: an
 * empty date is an error here, never defaulted (the sheet owns the create
 * default). A submitted `amount` is never read; net is computed server-side.
 */
export function parseTransactionForm(
  raw: RawTransactionForm,
): ParseResult<ParsedTransactionInput, TransactionField> {
  const errors: FieldErrors<TransactionField> = {};

  if (raw.id !== undefined && raw.id !== "" && parsePositiveId(raw.id) === null) {
    errors.id = M.transactionNotFound;
  }

  const type = parseType(raw.type);
  if (type === null) errors.type = M.typeInvalid;

  const gross = parseWholePesos(raw.gross);
  if (!gross.ok) errors.gross = gross.errors.value;

  // Income forces cashback to 0: a stale value never blocks an income save.
  let cashbackBps = 0;
  if (type !== "income") {
    const cashback = parseCashbackBps(raw.cashback);
    if (cashback.ok) cashbackBps = cashback.value;
    else errors.cashback = cashback.errors.value;
  }

  const categoryId = parsePositiveId(raw.categoryId);
  if (categoryId === null) errors.categoryId = M.categoryRequired;

  const memberId = parsePositiveId(raw.memberId);
  if (memberId === null) errors.memberId = M.memberRequired;

  const date = parseDate(raw.date);
  if (date === null) errors.date = M.dateInvalid;

  if (
    Object.keys(errors).length > 0 ||
    type === null ||
    !gross.ok ||
    categoryId === null ||
    memberId === null ||
    date === null
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { type, gross: gross.value, cashbackBps, categoryId, memberId, date },
  };
}

/** Budget amounts follow the same whole-peso rules, with a single message. */
export function parseBudgetAmount(raw: string | undefined): ParseResult<number, "amount"> {
  const parsed = parseWholePesos(raw);
  return parsed.ok
    ? parsed
    : { ok: false, errors: { amount: M.budgetAmountInvalid } };
}

export interface ReferenceFacts {
  type: TransactionType;
  category: { id: number; kind: TransactionType; archived: boolean } | null;
  member: { id: number; archived: boolean } | null;
  /** The stored references of the row being edited; `null` on create. */
  existing: { categoryId: number; memberId: number } | null;
}

/**
 * Decides reference validity from facts the action loaded. An archived
 * category or member is allowed ONLY on update and only when it equals the
 * value already stored on the row (Q7).
 */
export function checkTransactionReferences(
  facts: ReferenceFacts,
): FieldErrors<TransactionField> {
  const errors: FieldErrors<TransactionField> = {};
  const { category, member, existing } = facts;

  if (category === null) {
    errors.categoryId = M.categoryMissing;
  } else if (category.kind !== facts.type) {
    errors.categoryId = M.categoryKindMismatch;
  } else if (category.archived && existing?.categoryId !== category.id) {
    errors.categoryId = M.categoryUnavailable;
  }

  if (member === null) {
    errors.memberId = M.memberUnavailable;
  } else if (member.archived && existing?.memberId !== member.id) {
    errors.memberId = M.memberUnavailable;
  }

  return errors;
}

/**
 * A budget category must exist and be an expense category. An archived one is
 * accepted only when the month already has a row for it (editing an existing
 * archived row); a new row requires an active category.
 */
export function checkBudgetCategory(
  category: { kind: TransactionType; archived: boolean } | null,
  hasRowThisMonth: boolean,
): string | null {
  if (category === null) return M.categoryMissing;
  if (category.kind !== "expense") return M.budgetCategoryNotExpense;
  if (category.archived && !hasRowThisMonth) return M.categoryUnavailable;
  return null;
}
