import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema";
import type { TransactionType } from "@/lib/domain/types";

const HOUSEHOLD = "household";

export interface CategoryRow {
  id: number;
  name: string;
  kind: TransactionType;
  icon: string;
  colorIndex: number;
}

const CATEGORY_COLUMNS = {
  id: categories.id,
  name: categories.name,
  kind: categories.kind,
  icon: categories.icon,
  colorIndex: categories.colorIndex,
} as const;

/**
 * The add/edit sheet's picker read: `WHERE kind = :type AND archived_at IS NULL`.
 * `kind` discriminates expense from income categories in one table.
 */
export async function listActiveCategoriesByKind(
  kind: TransactionType,
  userId: string = HOUSEHOLD,
): Promise<CategoryRow[]> {
  return db
    .select(CATEGORY_COLUMNS)
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.kind, kind),
        isNull(categories.archivedAt),
      ),
    )
    .orderBy(asc(categories.id));
}

export async function listActiveCategories(
  userId: string = HOUSEHOLD,
): Promise<CategoryRow[]> {
  return db
    .select(CATEGORY_COLUMNS)
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.archivedAt)))
    .orderBy(asc(categories.id));
}

/** A category label for display, carrying whether the row is archived. */
export interface CategoryLabel {
  id: number;
  name: string;
  kind: TransactionType;
  icon: string;
  colorIndex: number;
  archived: boolean;
}

/**
 * LABEL RESOLUTION — deliberately INCLUDES archived categories.
 *
 * DO NOT ADD `isNull(categories.archivedAt)` HERE. This is not an oversight,
 * it is the entire reason the function exists.
 *
 * Archiving is a soft delete precisely so history stays readable: a transaction
 * or budget written last March still points at the category it was filed under.
 * Every PICKER read filters archived rows, so an archived category can never be
 * chosen again — but a historical row that references one must still render its
 * label. Filtering here would make an archive look like data loss to the user.
 *
 * `archived` is returned so the caller can mark the label as archived in the
 * UI rather than presenting it as a still-selectable category.
 */
export async function resolveCategoryLabels(
  ids: readonly number[],
  userId: string = HOUSEHOLD,
): Promise<CategoryLabel[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const rows = await db
    .select({ ...CATEGORY_COLUMNS, archivedAt: categories.archivedAt })
    .from(categories)
    .where(and(eq(categories.userId, userId), inArray(categories.id, unique)))
    .orderBy(asc(categories.id));

  return rows.map(({ archivedAt, ...row }) => ({
    ...row,
    archived: archivedAt !== null,
  }));
}

/**
 * BY-ID LABEL READ — deliberately INCLUDES archived categories.
 *
 * DO NOT ADD `isNull(categories.archivedAt)` HERE. The add/edit sheet needs to
 * know whether a referenced category is archived (an edit may keep an
 * unchanged archived value, a create may not), so it must be able to read it.
 * Returns `null` only when the id does not exist for this user.
 */
export async function getCategoryById(
  id: number,
  userId: string = HOUSEHOLD,
): Promise<CategoryLabel | null> {
  const [row] = await db
    .select({ ...CATEGORY_COLUMNS, archivedAt: categories.archivedAt })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)));

  if (row === undefined) return null;
  const { archivedAt, ...label } = row;
  return { ...label, archived: archivedAt !== null };
}

export async function createCategory(
  input: {
    name: string;
    kind: TransactionType;
    icon: string;
    colorIndex: number;
  },
  userId: string = HOUSEHOLD,
): Promise<CategoryRow> {
  const [row] = await db
    .insert(categories)
    .values({ userId, ...input })
    .returning(CATEGORY_COLUMNS);
  return row;
}

/**
 * Soft delete. Budgets, transactions and card_order all reference categories
 * with `ON DELETE RESTRICT`, so history is never rewritten by an archive.
 */
export async function archiveCategory(
  id: number,
  archivedAt: Date,
  userId: string = HOUSEHOLD,
): Promise<void> {
  await db
    .update(categories)
    .set({ archivedAt })
    .where(
      and(
        eq(categories.id, id),
        eq(categories.userId, userId),
        isNull(categories.archivedAt),
      ),
    );
}
