import { VALIDATION_MESSAGES as M } from "@/lib/domain/messages";
import type { TransactionType } from "@/lib/domain/types";

/**
 * Only expense categories are managed from Perfil. `need = 'active'` also
 * rejects an archived row (rename); `'any'` accepts it (archive, restore).
 * Returns `null` when allowed, otherwise the Spanish message.
 */
export function checkManagedCategory(
  category: { kind: TransactionType; archived: boolean } | null,
  need: "active" | "any",
): string | null {
  if (category === null) return M.categoryMissing;
  if (category.kind !== "expense") return M.categoryNotManaged;
  if (need === "active" && category.archived) return M.categoryUnavailable;
  return null;
}

/** Decides whether a member can be archived, given the active member count. */
export function checkMemberArchivable(
  member: { archived: boolean } | null,
  activeCount: number,
): "archive" | "noop" | string {
  if (member === null) return M.memberMissing;
  if (member.archived) return "noop";
  if (activeCount <= 1) return M.lastActiveMember;
  return "archive";
}
