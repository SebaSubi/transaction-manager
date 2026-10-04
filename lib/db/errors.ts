/**
 * Postgres unique-violation detection. Pure: no `server-only`, no Drizzle
 * import, so it is unit-testable.
 */
export const UNIQUE_VIOLATION = "23505";
export const MEMBERS_ACTIVE_NAME_UQ = "members_active_name_uq";
export const CATEGORIES_ACTIVE_NAME_UQ = "categories_active_name_uq";

const MAX_CAUSE_HOPS = 5;

/**
 * Walks `error` then `error.cause` (at most 5 hops) looking for
 * `{ code: '23505', constraint }`. Drizzle wraps the driver's `NeonDbError`
 * in a `DrizzleQueryError`, so the SQLSTATE lives on `cause`. Matching the
 * constraint name too means an unrelated unique violation is never mislabeled.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  for (let hop = 0; hop <= MAX_CAUSE_HOPS; hop += 1) {
    if (typeof current !== "object" || current === null) return false;
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (candidate.code === UNIQUE_VIOLATION && candidate.constraint === constraint) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}
