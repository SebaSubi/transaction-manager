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

/** One transaction by id, or `null` when it does not exist for this user. */
export async function getTransactionById(
  id: number,
  userId: string = HOUSEHOLD,
): Promise<DomainTransaction | null> {
  const [row] = await db
    .select(TRANSACTION_COLUMNS)
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)));
  return row ?? null;
}

/**
 * One-statement `UPDATE ... WHERE user_id AND id RETURNING`. Returns `null`
 * when the row vanished (deleted from another device), never throws for it.
 */
export async function updateTransaction(
  id: number,
  input: NewTransaction,
  userId: string = HOUSEHOLD,
): Promise<DomainTransaction | null> {
  const [row] = await db
    .update(transactions)
    .set(input)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning(TRANSACTION_COLUMNS);
  return row ?? null;
}

/**
 * One-statement `DELETE ... RETURNING id`. Returns `false` when the row was
 * already gone; that is not an error (deleting twice must not lose data or
 * fail).
 */
export async function deleteTransaction(
  id: number,
  userId: string = HOUSEHOLD,
): Promise<boolean> {
  const deleted = await db
    .delete(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning({ id: transactions.id });
  return deleted.length > 0;
}
