"use client";

import { startTransition, useActionState, useState } from "react";

import { archiveCategoryAction, createCategoryAction } from "@/app/actions/categories";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { IconPicker } from "@/components/molecules/IconPicker";
import { RenameForm } from "@/components/molecules/RenameForm";
import { SettingsRow } from "@/components/molecules/SettingsRow";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { PROFILE_COPY, archiveCategoryConfirmTitle } from "@/lib/copy/es";
import { INITIAL_NAME_FORM_STATE, type NameFormState } from "@/lib/actions/state";
import type { SettingsCategoryView } from "@/lib/view/settings";

/** Active expense categories: add with icon, inline rename, archive with confirmation. */
export function CategorySettings({
  categories,
}: {
  categories: readonly SettingsCategoryView[];
}) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<SettingsCategoryView | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addState, addAction, adding] = useActionState<NameFormState, FormData>(
    createCategoryAction,
    INITIAL_NAME_FORM_STATE,
  );
  const addErrors = addState.status === "error" ? addState.fieldErrors : {};

  function confirmArchive(category: SettingsCategoryView) {
    setPending(true);
    startTransition(async () => {
      const result = await archiveCategoryAction(category.id);
      startTransition(() => {
        setPending(false);
        if (result.status === "error") {
          setError(result.message);
        } else {
          setError(null);
          setConfirming(null);
        }
      });
    });
  }

  return (
    <section className="settings-section">
      <h2 className="section-title">{PROFILE_COPY.categoriesSection}</h2>
      <ul className="settings-list">
        {categories.map((category) => (
          <SettingsRow
            key={category.id}
            leading={<CategoryIcon name={category.icon} color={category.color} />}
            name={
              renamingId === category.id ? (
                <RenameForm
                  categoryId={category.id}
                  currentName={category.name}
                  onDone={() => setRenamingId(null)}
                />
              ) : (
                category.name
              )
            }
          >
            {renamingId === category.id ? null : (
              <>
                <Button type="button" variant="ghost" onClick={() => setRenamingId(category.id)}>
                  {PROFILE_COPY.rename}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setError(null);
                    setConfirming(category);
                  }}
                >
                  {PROFILE_COPY.archive}
                </Button>
              </>
            )}
          </SettingsRow>
        ))}
      </ul>

      {confirming !== null ? (
        <ConfirmDialog
          title={archiveCategoryConfirmTitle(confirming.name)}
          body={PROFILE_COPY.archiveCategoryBody}
          confirmLabel={PROFILE_COPY.archiveConfirm}
          cancelLabel={PROFILE_COPY.cancel}
          pending={pending}
          pendingLabel={PROFILE_COPY.archivePending}
          error={error}
          onConfirm={() => confirmArchive(confirming)}
          onCancel={() => {
            setError(null);
            setConfirming(null);
          }}
        />
      ) : null}

      <form action={addAction} className="settings-add">
        <Input
          name="name"
          autoComplete="off"
          placeholder={PROFILE_COPY.nameLabel}
          aria-label={PROFILE_COPY.addCategory}
        />
        <FieldError message={addErrors.name} />
        <IconPicker ariaLabel={PROFILE_COPY.iconLabel} />
        <FieldError message={addErrors.icon} />
        <FieldError message={addState.status === "error" ? addState.formError : null} />
        <Button type="submit" disabled={adding}>
          {PROFILE_COPY.addCategory}
        </Button>
      </form>
    </section>
  );
}
