/**
 * Shared-password comparison. Node runtime ONLY.
 *
 * Deliberately separate from `lib/auth/session.ts`: `node:crypto` does not
 * exist on the Edge runtime, and `proxy.ts` imports the session module.
 * Keeping the password check here means the Edge bundle never reaches for a
 * Node module. Only `app/actions/login.ts` (a Server Action, Node runtime)
 * imports this file.
 */

/**
 * Constant-time shared-password check.
 *
 * Both operands are hashed FIRST so the comparison runs over two fixed 32-byte
 * digests: it therefore leaks neither the password's content nor its length.
 * Plain `===` is rejected — it short-circuits at the first differing byte, so
 * a longer shared prefix takes measurably longer and leaks the password one
 * character at a time.
 */
export async function passwordMatches(
  submitted: string,
  expected: string,
): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");

  const submittedDigest = createHash("sha256").update(submitted, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();

  return timingSafeEqual(submittedDigest, expectedDigest);
}
