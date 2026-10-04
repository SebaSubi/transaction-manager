import { monthRange } from "@/lib/domain/month";
import type { DomainTransaction, MonthKey } from "@/lib/domain/types";

/**
 * Nets income against expense across EVERY transaction supplied.
 *
 * The caller passes the full history, never a month slice: the home screen's
 * balance spans all time and is deliberately not month-scoped (obs #59).
 * Both sides consume the NET `amount`, already cashback-adjusted exactly once
 * by `computeNetAmount` on the write path.
 */
export function totalBalance(transactions: readonly DomainTransaction[]): number {
  let balance = 0;
  for (const transaction of transactions) {
    balance += transaction.type === "income" ? transaction.amount : -transaction.amount;
  }
  return balance;
}

/**
 * Sums NET expense amounts for one category.
 *
 * Contract: `transactions` is ALREADY month-scoped by the caller. The domain
 * never filters by month string — that is the repository's half-open range
 * query (`date >= start AND date < endExclusive`). Keeping the scoping out of
 * here is what structurally removes the prototype's `date.startsWith(monthKey)`
 * prefix match rather than relocating it.
 */
export function spentForCategory(
  transactions: readonly DomainTransaction[],
  categoryId: number,
): number {
  let spent = 0;
  for (const transaction of transactions) {
    if (transaction.type === "expense" && transaction.categoryId === categoryId) {
      spent += transaction.amount;
    }
  }
  return spent;
}

/**
 * Income minus expense (NET amounts) for one month. Only rows inside the
 * half-open `monthRange(monthKey)` count, so the result is correct even when
 * the caller passes a wider slice.
 */
export function monthBalance(
  transactions: readonly DomainTransaction[],
  monthKey: MonthKey,
): number {
  const { start, endExclusive } = monthRange(monthKey);
  const from = start.getTime();
  const to = endExclusive.getTime();
  let balance = 0;
  for (const transaction of transactions) {
    const at = transaction.date.getTime();
    if (at < from || at >= to) continue;
    balance += transaction.type === "income" ? transaction.amount : -transaction.amount;
  }
  return balance;
}
