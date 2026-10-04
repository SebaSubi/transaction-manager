/**
 * Resolves the member preselected in the add sheet: the last-used member when
 * the cookie holds an ACTIVE member id, otherwise the first active member,
 * otherwise `null` (no active members).
 */
export function resolveDefaultMemberId(
  cookieValue: string | undefined,
  activeMemberIds: readonly number[],
): number | null {
  if (activeMemberIds.length === 0) return null;

  if (cookieValue !== undefined && /^[1-9]\d*$/.test(cookieValue)) {
    const id = Number(cookieValue);
    if (activeMemberIds.includes(id)) return id;
  }

  return activeMemberIds[0];
}
