"use server";

import { revalidateShellTabs } from "@/lib/actions/revalidate";
import type { MutationResult, NameFormState } from "@/lib/actions/state";
import { assertSession } from "@/lib/auth/requireSession";
import { CATEGORIES_ACTIVE_NAME_UQ, isUniqueViolation } from "@/lib/db/errors";
import {
  archiveCategory,
  createCategory,
  getCategoryById,
  listActiveCategories,
  renameCategory,
  unarchiveCategory,
} from "@/lib/db/repositories/categories.repository";
import { nextColorIndex } from "@/lib/domain/categories";
import { isCategoryIconKey } from "@/lib/domain/categoryIcons";
import { VALIDATION_MESSAGES } from "@/lib/domain/messages";
import { checkManagedCategory } from "@/lib/domain/settings";
import { nowInBuenosAires } from "@/lib/domain/time";
import { parseName, parsePositiveId } from "@/lib/domain/validation";

const M = VALIDATION_MESSAGES;

function formString(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

export async function createCategoryAction(
  _previous: NameFormState,
  form: FormData,
): Promise<NameFormState> {
  await assertSession();

  const name = parseName(formString(form, "name"));
  const icon = formString(form, "icon");
  const iconValid = isCategoryIconKey(icon);
  if (!name.ok || !iconValid) {
    return {
      status: "error",
      fieldErrors: {
        ...(name.ok ? {} : name.errors),
        ...(iconValid ? {} : { icon: M.iconRequired }),
      },
      formError: null,
    };
  }

  let created: { id: number; name: string };
  try {
    const active = await listActiveCategories();
    created = await createCategory({
      name: name.value,
      kind: "expense",
      icon,
      colorIndex: nextColorIndex(active.length),
    });
  } catch (error) {
    if (isUniqueViolation(error, CATEGORIES_ACTIVE_NAME_UQ)) {
      return {
        status: "error",
        fieldErrors: { name: M.categoryNameTaken },
        formError: null,
      };
    }
    return { status: "error", fieldErrors: {}, formError: M.saveFailed };
  }

  revalidateShellTabs();
  return { status: "saved", id: created.id, name: created.name };
}

export async function renameCategoryAction(
  _previous: NameFormState,
  form: FormData,
): Promise<NameFormState> {
  await assertSession();

  const id = parsePositiveId(formString(form, "id"));
  if (id === null) {
    return { status: "error", fieldErrors: {}, formError: M.categoryMissing };
  }
  const name = parseName(formString(form, "name"));
  if (!name.ok) {
    return { status: "error", fieldErrors: name.errors, formError: null };
  }

  let renamed: { id: number; name: string } | null;
  try {
    const category = await getCategoryById(id);
    const problem = checkManagedCategory(category, "active");
    if (problem !== null) {
      return { status: "error", fieldErrors: {}, formError: problem };
    }
    renamed = await renameCategory(id, "expense", name.value);
  } catch (error) {
    if (isUniqueViolation(error, CATEGORIES_ACTIVE_NAME_UQ)) {
      return {
        status: "error",
        fieldErrors: { name: M.categoryNameTaken },
        formError: null,
      };
    }
    return { status: "error", fieldErrors: {}, formError: M.saveFailed };
  }
  if (renamed === null) {
    return { status: "error", fieldErrors: {}, formError: M.categoryUnavailable };
  }

  revalidateShellTabs();
  return { status: "saved", id: renamed.id, name: renamed.name };
}

/** Archiving an already-archived category is a success, not an error. */
export async function archiveCategoryAction(id: unknown): Promise<MutationResult> {
  await assertSession();

  const categoryId = parsePositiveId(id);
  if (categoryId === null) return { status: "error", message: M.archiveFailed };

  try {
    const category = await getCategoryById(categoryId);
    const problem = checkManagedCategory(category, "any");
    if (problem !== null) return { status: "error", message: problem };
    if (category?.archived) return { status: "ok" };

    await archiveCategory(categoryId, nowInBuenosAires());
  } catch {
    return { status: "error", message: M.archiveFailed };
  }

  revalidateShellTabs();
  return { status: "ok" };
}

/** Restoring an already-active category is a success, not an error. */
export async function restoreCategoryAction(id: unknown): Promise<MutationResult> {
  await assertSession();

  const categoryId = parsePositiveId(id);
  if (categoryId === null) return { status: "error", message: M.restoreFailed };

  try {
    const category = await getCategoryById(categoryId);
    const problem = checkManagedCategory(category, "any");
    if (problem !== null) return { status: "error", message: problem };
    if (category?.archived === false) return { status: "ok" };

    const restored = await unarchiveCategory(categoryId, "expense");
    if (restored === null) return { status: "error", message: M.restoreFailed };
  } catch (error) {
    if (isUniqueViolation(error, CATEGORIES_ACTIVE_NAME_UQ)) {
      return { status: "error", message: M.categoryRestoreNameTaken };
    }
    return { status: "error", message: M.restoreFailed };
  }

  revalidateShellTabs();
  return { status: "ok" };
}
