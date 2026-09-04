export type TransactionType = "expense" | "income";

// 'YYYY-MM', narrowed by isMonthKey.
export type MonthKey = string;

export type SortMode = "date" | "amountDesc" | "amountAsc";

export type ThemePreference = "dark" | "light" | "system";

export type EffectiveTheme = "dark" | "light";

export interface DomainTransaction {
  id: number;
  type: TransactionType;
  // Net, whole ARS pesos.
  amount: number;
  // Whole ARS pesos.
  gross: number;
  // 0..10000; always 0 when type === 'income'.
  cashbackBps: number;
  categoryId: number;
  memberId: number;
  // Wall-clock: UTC components ARE Buenos Aires local time.
  date: Date;
}

// Half-open [start, endExclusive).
export interface MonthRange {
  start: Date;
  endExclusive: Date;
}

export interface BudgetProgress {
  spent: number;
  budgeted: number;
  remaining: number;
  // Clamped to 0..100 — drives the bar width.
  barPct: number;
  // UNCAPPED — drives the "127%" label.
  labelPct: number;
  // spent > budgeted.
  overBudget: boolean;
  // budgeted > 0; false selects the neutral bar colour.
  hasBudget: boolean;
}

export interface TransactionFilters {
  type: TransactionType | "all";
  categoryId: number | "all";
  memberId: number | "all";
  // 'YYYY-MM-DD', inclusive.
  from: string | null;
  // 'YYYY-MM-DD', inclusive.
  to: string | null;
}
