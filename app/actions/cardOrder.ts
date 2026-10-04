"use server";

import { revalidatePath } from "next/cache";

import type { MutationResult } from "@/lib/actions/state";
import { assertSession } from "@/lib/auth/requireSession";
import {
  getStoredCardOrder,
  replaceCardOrder,
} from "@/lib/db/repositories/cardOrder.repository";
import { listActiveCategoriesByKind } from "@/lib/db/repositories/categories.repository";
import {
  checkCardOrderIds,
  mergeCardOrder,
  sameOrder,
} from "@/lib/domain/cardOrder";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";
import { parseIdList } from "@/lib/domain/validation";

const M = VALIDATION_MESSAGES;

/** More than any household will ever have; bounds the payload of a direct POST. */
const MAX_CARD_IDS = 200;

/**
 * Persists the visible card order. `orderedIds` is `unknown` on purpose: a
 * Server Action is reachable by a direct POST, so it is re-validated.
 *
 * The merge runs against the RAW stored order (archived included), so the
 * positions of archived categories survive a reorder.
 */
export async function reorderCardsAction(
  orderedIds: unknown,
): Promise<MutationResult> {
  await assertSession();

  const ids = parseIdList(orderedIds, MAX_CARD_IDS);
  if (ids === null || ids.length === 0) {
    return { status: "error", message: M.cardOrderSaveFailed };
  }

  try {
    const [activeExpense, stored] = await Promise.all([
      listActiveCategoriesByKind("expense"),
      getStoredCardOrder(),
    ]);

    const allowed = new Set(activeExpense.map((category) => category.id));
    if (!checkCardOrderIds(ids, allowed)) {
      return { status: "error", message: M.cardOrderSaveFailed };
    }

    const merged = mergeCardOrder(ids, stored);
    if (sameOrder(merged, stored)) return { status: "ok" };

    await replaceCardOrder(merged);
  } catch {
    return { status: "error", message: M.cardOrderSaveFailed };
  }

  revalidatePath("/inicio");
  return { status: "ok" };
}
