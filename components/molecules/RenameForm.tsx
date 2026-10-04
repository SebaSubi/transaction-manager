"use client";

import { startTransition, useActionState } from "react";

import { renameCategoryAction } from "@/app/actions/categories";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { PROFILE_COPY } from "@/lib/copy/es";
import { INITIAL_NAME_FORM_STATE, type NameFormState } from "@/lib/actions/state";

/** Inline rename for one category: name input plus Guardar and Cancelar. */
export function RenameForm({
  categoryId,
  currentName,
  onDone,
}: {
  categoryId: number;
  currentName: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<NameFormState, FormData>(
    async (previous, formData) => {
      const result = await renameCategoryAction(previous, formData);
      if (result.status === "saved") startTransition(onDone);
      return result;
    },
    INITIAL_NAME_FORM_STATE,
  );
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="rename-form">
      <input type="hidden" name="id" value={categoryId} />
      <Input
        name="name"
        defaultValue={currentName}
        autoComplete="off"
        aria-label={PROFILE_COPY.nameLabel}
      />
      <FieldError message={errors.name} />
      <FieldError message={errors.id} />
      <FieldError message={state.status === "error" ? state.formError : null} />
      <div className="rename-form__actions">
        <Button type="button" variant="ghost" onClick={onDone}>
          {PROFILE_COPY.cancel}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? PROFILE_COPY.saving : PROFILE_COPY.save}
        </Button>
      </div>
    </form>
  );
}
