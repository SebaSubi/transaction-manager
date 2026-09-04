import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { cardOrder, categories } from "@/lib/db/schema";

const HOUSEHOLD = "household";

/**
 * The stored home-card order, archived categories excluded by the join.
 *
 * Returns ids only: `orderCategories()` in lib/domain/categories.ts applies the
 * order to whatever row shape the caller holds, so the domain stays generic.
 * `ORDER BY position, category_id` because `card_order` carries no unique
 * constraint on position (a reorder write would need a deferrable one), so the
 * secondary key is what keeps ties deterministic.
 */
export async function getCardOrder(userId: string = HOUSEHOLD): Promise<number[]> {
  const rows = await db
    .select({ categoryId: cardOrder.categoryId })
    .from(cardOrder)
    .innerJoin(categories, eq(categories.id, cardOrder.categoryId))
    .where(and(eq(cardOrder.userId, userId), isNull(categories.archivedAt)))
    .orderBy(asc(cardOrder.position), asc(cardOrder.categoryId));

  return rows.map((row) => row.categoryId);
}

/**
 * Replaces the whole order in ONE round trip.
 *
 * `neon-http` is non-interactive: `db.transaction(callback)` is unavailable
 * because there is no session to hold a transaction open across statements
 * (design §1). `db.batch([...])` is the driver's non-interactive equivalent —
 * the DELETE and the INSERT are sent together and applied atomically, so a
 * reorder can never leave the user with a partially-written order.
 */
export async function replaceCardOrder(
  categoryIds: readonly number[],
  userId: string = HOUSEHOLD,
): Promise<void> {
  const remove = db.delete(cardOrder).where(eq(cardOrder.userId, userId));

  if (categoryIds.length === 0) {
    await db.batch([remove]);
    return;
  }

  const insert = db.insert(cardOrder).values(
    categoryIds.map((categoryId, position) => ({ userId, categoryId, position })),
  );

  await db.batch([remove, insert]);
}
