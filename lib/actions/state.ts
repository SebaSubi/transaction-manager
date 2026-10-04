import type {
  FieldErrors,
  TransactionField,
} from "@/lib/domain/validation";
import type { LedgerRowView } from "@/lib/view/ledger";

/**
 * Server Action state and result types, kept out of the `"use server"` modules
 * because those may export async functions only (same reason as
 * `lib/auth/loginState.ts`).
 */

export type TransactionFormState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: FieldErrors<TransactionField>;
      formError: string | null;
    }
  | { status: "saved"; row: LedgerRowView; memberId: number };

export type DeleteResult =
  | { status: "deleted"; id: number }
  | { status: "error"; message: string };

export type BudgetFormState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: Partial<Record<"amount" | "categoryId" | "month", string>>;
      formError: string | null;
    }
  | { status: "saved"; categoryId: number; amount: number };

export type BudgetMutationResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export type CopyResult =
  | { status: "copied"; count: number }
  | { status: "nothing" }
  | { status: "error"; message: string };

export type NameField = "name" | "icon" | "id";

export type NameFormState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: Partial<Record<NameField, string>>;
      formError: string | null;
    }
  | { status: "saved"; id: number; name: string };

export type MutationResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export const INITIAL_NAME_FORM_STATE: NameFormState = { status: "idle" };

export const INITIAL_TRANSACTION_FORM_STATE: TransactionFormState = {
  status: "idle",
};

export const INITIAL_BUDGET_FORM_STATE: BudgetFormState = { status: "idle" };
