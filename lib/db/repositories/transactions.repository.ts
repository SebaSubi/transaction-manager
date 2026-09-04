import "server-only";

import { and, asc, desc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { transactions } from "@/lib/db/schema";
import type { DomainTransaction, MonthRange, TransactionType } from "@/lib/domain/types";

const HOUSEHOLD = "household";

const TRANSACTION_COLUMNS = {
  id: transactions.id,
  type: transactions.type,
  amount: transactions.amount,
  gross: transactions.gross,
  cashbackBps: transactions.cashbackBps,
  categoryId: transactions.categoryId,
  memberId: transactions.memberId,
  date: transactions.date,
} as const;

/**
 * Lists one month's transactions using the caller-supplied HALF-OPEN range:
 * `date >= start AND date < endExclusive`.
 *
 * The bounds come from `monthRange()` in lib/domain/month.ts, which is their
 * only producer. There is deliberately no `LIKE`, no `startsWith` and no month
 * string anywhere in this query — the prototype's `date.startsWith(monthKey)`
 * prefix match is structurally impossible here. Served by
 * `transactions_month_idx` on (user_id, date).
 */
export async function listTransactionsInRange(
  range: MonthRange,
  userId: string = HOUSEHOLD,
): Promise<DomainTransaction[]> {
  return db
    .select(TRANSACTION_COLUMNS)
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, range.start),
        lt(transactions.date, range.endExclusive),
      ),
    )
    .orderBy(desc(transactions.date), desc(transactions.id));
}

/**
 * Every transaction ever recorded, ascending. `totalBalance()` spans all
 * history rather than the selected month (obs #59), so it needs this read.
 */
export async function listAllTransactions(
  userId: string = HOUSEHOLD,
): Promise<DomainTransaction[]> {
  return db
    .select(TRANSACTION_COLUMNS)
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(asc(transactions.date), asc(transactions.id));
}

export interface NewTransaction {
  type: TransactionType;
  /** Net, whole ARS pesos — already produced by `computeNetAmount`. */
  amount: number;
  gross: number;
  /** 0..10000; the DB CHECK forces 0 when `type` is 'income'. */
  cashbackBps: number;
  categoryId: number;
  memberId: number;
  /** Buenos Aires wall-clock. */
  date: Date;
}

export async function createTransaction(
  input: NewTransaction,
  userId: string = HOUSEHOLD,
): Promise<DomainTransaction> {
  const [row] = await db
    .insert(transactions)
    .values({ userId, ...input })
    .returning(TRANSACTION_COLUMNS);
  return row;
}
