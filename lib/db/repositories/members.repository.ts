import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { members } from "@/lib/db/schema";

/** The single-household auth scope. There is no multi-tenant story yet. */
const HOUSEHOLD = "household";

export interface MemberRow {
  id: number;
  name: string;
}

/** Active members only — archived rows never reach a picker. */
export async function listActiveMembers(
  userId: string = HOUSEHOLD,
): Promise<MemberRow[]> {
  return db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.userId, userId), isNull(members.archivedAt)))
    .orderBy(asc(members.name));
}

/** A member label for display, carrying whether the row is archived. */
export interface MemberLabel {
  id: number;
  name: string;
  archived: boolean;
}

/**
 * LABEL RESOLUTION — deliberately INCLUDES archived members.
 *
 * DO NOT ADD `isNull(members.archivedAt)` HERE. This is not an oversight, it is
 * the entire reason the function exists.
 *
 * Archiving is a soft delete precisely so history stays readable: a transaction
 * recorded against "Mati" must keep showing "Mati" after Mati is archived.
 * Every PICKER read filters archived rows, so an archived member can never be
 * assigned again — but a historical row that references one must still render
 * its label. Filtering here would make an archive look like data loss.
 *
 * `archived` is returned so the caller can mark the label as archived in the
 * UI rather than presenting it as a still-selectable member.
 */
export async function resolveMemberLabels(
  ids: readonly number[],
  userId: string = HOUSEHOLD,
): Promise<MemberLabel[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      archivedAt: members.archivedAt,
    })
    .from(members)
    .where(and(eq(members.userId, userId), inArray(members.id, unique)))
    .orderBy(asc(members.id));

  return rows.map(({ archivedAt, ...row }) => ({
    ...row,
    archived: archivedAt !== null,
  }));
}

export async function createMember(
  name: string,
  userId: string = HOUSEHOLD,
): Promise<MemberRow> {
  const [row] = await db
    .insert(members)
    .values({ userId, name })
    .returning({ id: members.id, name: members.name });
  return row;
}

/**
 * Archives a member. Soft delete, never `DELETE`: transactions carry an
 * `ON DELETE RESTRICT` foreign key, so a hard delete would either fail or
 * orphan history.
 *
 * Refuses when it would archive the LAST active member (source rule: removeUser
 * is blocked when only one user remains, obs #59). The count and the update run
 * in one statement so a concurrent archive cannot slip between them.
 */
export async function archiveMember(
  id: number,
  archivedAt: Date,
  userId: string = HOUSEHOLD,
): Promise<void> {
  const updated = await db
    .update(members)
    .set({ archivedAt })
    .where(
      and(
        eq(members.id, id),
        eq(members.userId, userId),
        isNull(members.archivedAt),
        sql`(SELECT count(*) FROM ${members} m WHERE m.user_id = ${userId} AND m.archived_at IS NULL) > 1`,
      ),
    )
    .returning({ id: members.id });

  if (updated.length === 0) {
    throw new Error(
      `Cannot archive member ${id}: it is either already archived or the last active member.`,
    );
  }
}
