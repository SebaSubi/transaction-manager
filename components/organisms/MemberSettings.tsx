"use client";

import { startTransition, useActionState, useState } from "react";

import { archiveMemberAction, createMemberAction } from "@/app/actions/members";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { SettingsRow } from "@/components/molecules/SettingsRow";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Input } from "@/components/ui/Input";
import { PROFILE_COPY, archiveMemberConfirmTitle } from "@/lib/copy/es";
import { INITIAL_NAME_FORM_STATE, type NameFormState } from "@/lib/actions/state";
import type { SettingsMemberView } from "@/lib/view/settings";

/** Active members: add form, plus archive behind a confirmation dialog. */
export function MemberSettings({ members }: { members: readonly SettingsMemberView[] }) {
  const [confirming, setConfirming] = useState<SettingsMemberView | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addState, addAction, adding] = useActionState<NameFormState, FormData>(
    createMemberAction,
    INITIAL_NAME_FORM_STATE,
  );
  const addErrors = addState.status === "error" ? addState.fieldErrors : {};

  function confirmArchive(member: SettingsMemberView) {
    setPending(true);
    startTransition(async () => {
      const result = await archiveMemberAction(member.id);
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
      <h2 className="section-title">{PROFILE_COPY.membersSection}</h2>
      <ul className="settings-list">
        {members.map((member) => (
          <SettingsRow key={member.id} leading={<Avatar name={member.name} />} name={member.name}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setError(null);
                setConfirming(member);
              }}
            >
              {PROFILE_COPY.archive}
            </Button>
          </SettingsRow>
        ))}
      </ul>

      {confirming !== null ? (
        <ConfirmDialog
          title={archiveMemberConfirmTitle(confirming.name)}
          body={PROFILE_COPY.archiveMemberBody}
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
          placeholder={PROFILE_COPY.memberPlaceholder}
          aria-label={PROFILE_COPY.addMember}
        />
        <FieldError message={addErrors.name} />
        <FieldError message={addState.status === "error" ? addState.formError : null} />
        <Button type="submit" disabled={adding}>
          {PROFILE_COPY.memberSubmit}
        </Button>
      </form>
    </section>
  );
}
