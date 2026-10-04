"use server";

import { revalidateShellTabs } from "@/lib/actions/revalidate";
import type { MutationResult, NameFormState } from "@/lib/actions/state";
import { assertSession } from "@/lib/auth/requireSession";
import { MEMBERS_ACTIVE_NAME_UQ, isUniqueViolation } from "@/lib/db/errors";
import {
  archiveMember,
  createMember,
  getMemberById,
  listActiveMembers,
  unarchiveMember,
} from "@/lib/db/repositories/members.repository";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";
import { checkMemberArchivable } from "@/lib/domain/settings";
import { nowInBuenosAires } from "@/lib/domain/time";
import { parseName, parsePositiveId } from "@/lib/domain/validation";

const M = VALIDATION_MESSAGES;

export async function createMemberAction(
  _previous: NameFormState,
  form: FormData,
): Promise<NameFormState> {
  await assertSession();

  const rawName = form.get("name");
  const name = parseName(typeof rawName === "string" ? rawName : undefined);
  if (!name.ok) {
    return { status: "error", fieldErrors: name.errors, formError: null };
  }

  let created: { id: number; name: string };
  try {
    created = await createMember(name.value);
  } catch (error) {
    if (isUniqueViolation(error, MEMBERS_ACTIVE_NAME_UQ)) {
      return {
        status: "error",
        fieldErrors: { name: M.memberNameTaken },
        formError: null,
      };
    }
    return { status: "error", fieldErrors: {}, formError: M.saveFailed };
  }

  revalidateShellTabs();
  return { status: "saved", id: created.id, name: created.name };
}

/** Archiving an already-archived member is a success, not an error. */
export async function archiveMemberAction(id: unknown): Promise<MutationResult> {
  await assertSession();

  const memberId = parsePositiveId(id);
  if (memberId === null) return { status: "error", message: M.archiveFailed };

  try {
    const [member, active] = await Promise.all([
      getMemberById(memberId),
      listActiveMembers(),
    ]);

    const decision = checkMemberArchivable(member, active.length);
    if (decision === "noop") return { status: "ok" };
    if (decision !== "archive") return { status: "error", message: decision };

    try {
      await archiveMember(memberId, nowInBuenosAires());
    } catch {
      // The repository's single-statement guard refused: a concurrent archive
      // took the second-to-last member, so this one is now the last.
      return { status: "error", message: M.lastActiveMember };
    }
  } catch {
    return { status: "error", message: M.archiveFailed };
  }

  revalidateShellTabs();
  return { status: "ok" };
}

/** Restoring an already-active member is a success, not an error. */
export async function restoreMemberAction(id: unknown): Promise<MutationResult> {
  await assertSession();

  const memberId = parsePositiveId(id);
  if (memberId === null) return { status: "error", message: M.restoreFailed };

  try {
    const member = await getMemberById(memberId);
    if (member === null) return { status: "error", message: M.memberMissing };
    if (!member.archived) return { status: "ok" };

    const restored = await unarchiveMember(memberId);
    if (restored === null) return { status: "error", message: M.restoreFailed };
  } catch (error) {
    if (isUniqueViolation(error, MEMBERS_ACTIVE_NAME_UQ)) {
      return { status: "error", message: M.memberRestoreNameTaken };
    }
    return { status: "error", message: M.restoreFailed };
  }

  revalidateShellTabs();
  return { status: "ok" };
}
