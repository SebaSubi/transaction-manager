"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import type {
  DeleteResult,
  TransactionFormState,
} from "@/lib/actions/state";
import { assertSession } from "@/lib/auth/requireSession";
import { getCategoryById } from "@/lib/db/repositories/categories.repository";
import { getMemberById } from "@/lib/db/repositories/members.repository";
import {
  createTransaction,
  deleteTransaction,
  getTransactionById,
  updateTransaction,
  type NewTransaction,
} from "@/lib/db/repositories/transactions.repository";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";
import { computeNetAmount } from "@/lib/domain/money";
import { toDateTimeLocalValue } from "@/lib/domain/time";
import type { DomainTransaction } from "@/lib/domain/types";
import {
  checkTransactionReferences,
  parsePositiveId,
  parseTransactionForm,
  type FieldErrors,
  type RawTransactionForm,
  type TransactionField,
} from "@/lib/domain/validation";
import {
  LAST_MEMBER_COOKIE,
  LAST_MEMBER_MAX_AGE_SECONDS,
} from "@/lib/members/cookies";
import { toLedgerRowView } from "@/lib/view/ledger";

const M = VALIDATION_MESSAGES;

/** Tabs whose data a transaction write can change. */
const AFFECTED_PATHS = ["/movimientos", "/presupuesto", "/inicio"] as const;

function field(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * FormData -> plain record. An `amount` field is deliberately never read: the
 * stored net is always computed server-side from gross and cashback.
 */
function readForm(form: FormData): RawTransactionForm {
  return {
    id: field(form, "id"),
    type: field(form, "type"),
    gross: field(form, "gross"),
    cashback: field(form, "cashback"),
    categoryId: field(form, "categoryId"),
    memberId: field(form, "memberId"),
    date: field(form, "date"),
  };
}

function fieldErrorState(
  fieldErrors: FieldErrors<TransactionField>,
): TransactionFormState {
  return { status: "error", fieldErrors, formError: null };
}

function formErrorState(message: string): TransactionFormState {
  return { status: "error", fieldErrors: {}, formError: message };
}

/**
 * Shared body of create and update (design Decision 2). `assertSession` is the
 * first statement of each exported action, before this runs.
 */
async function saveTransaction(
  form: FormData,
  mode: "create" | "update",
): Promise<TransactionFormState> {
  const raw = readForm(form);

  let id: number | null = null;
  if (mode === "update") {
    id = parsePositiveId(raw.id);
    if (id === null) return fieldErrorState({ id: M.transactionNotFound });
  }

  const parsed = parseTransactionForm(raw);
  if (!parsed.ok) return fieldErrorState(parsed.errors);
  const input = parsed.value;

  let existing: DomainTransaction | null = null;
  if (id !== null) {
    existing = await getTransactionById(id);
    if (existing === null) return formErrorState(M.transactionNotFound);
  }

  const [category, member] = await Promise.all([
    getCategoryById(input.categoryId),
    getMemberById(input.memberId),
  ]);

  const referenceErrors = checkTransactionReferences({
    type: input.type,
    category,
    member,
    existing:
      existing === null
        ? null
        : { categoryId: existing.categoryId, memberId: existing.memberId },
  });
  if (Object.keys(referenceErrors).length > 0) {
    return fieldErrorState(referenceErrors);
  }
  if (category === null || member === null) {
    // Unreachable: a null reference always yields a reference error above.
    return formErrorState(M.saveFailed);
  }

  // The ONLY place a stored net is computed.
  const amount = computeNetAmount({
    type: input.type,
    gross: input.gross,
    cashbackBps: input.cashbackBps,
  });

  // An untouched date keeps the stored value, so its seconds survive an edit.
  const date =
    existing !== null &&
    toDateTimeLocalValue(existing.date) === toDateTimeLocalValue(input.date)
      ? existing.date
      : input.date;

  const write: NewTransaction = {
    type: input.type,
    amount,
    gross: input.gross,
    cashbackBps: input.cashbackBps,
    categoryId: input.categoryId,
    memberId: input.memberId,
    date,
  };

  let persisted: DomainTransaction | null;
  try {
    persisted =
      id === null
        ? await createTransaction(write)
        : await updateTransaction(id, write);
  } catch {
    return formErrorState(M.saveFailed);
  }
  if (persisted === null) return formErrorState(M.transactionNotFound);

  (await cookies()).set(LAST_MEMBER_COOKIE, String(input.memberId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: LAST_MEMBER_MAX_AGE_SECONDS,
  });

  for (const path of AFFECTED_PATHS) revalidatePath(path);

  return {
    status: "saved",
    row: toLedgerRowView(persisted, category, member),
    memberId: input.memberId,
  };
}

export async function createTransactionAction(
  _previous: TransactionFormState,
  form: FormData,
): Promise<TransactionFormState> {
  await assertSession();
  return saveTransaction(form, "create");
}

export async function updateTransactionAction(
  _previous: TransactionFormState,
  form: FormData,
): Promise<TransactionFormState> {
  await assertSession();
  return saveTransaction(form, "update");
}

/**
 * `id` is `unknown` on purpose: a Server Action is reachable by a direct POST,
 * so the argument is re-validated rather than trusted from its TypeScript type.
 * Deleting an already-deleted row is a success, not an error.
 */
export async function deleteTransactionAction(id: unknown): Promise<DeleteResult> {
  await assertSession();

  const parsedId = parsePositiveId(id);
  if (parsedId === null) return { status: "error", message: M.deleteFailed };

  try {
    await deleteTransaction(parsedId);
  } catch {
    return { status: "error", message: M.deleteFailed };
  }

  for (const path of AFFECTED_PATHS) revalidatePath(path);
  return { status: "deleted", id: parsedId };
}
