"use client";

import { startTransition, useState } from "react";

import { restoreCategoryAction } from "@/app/actions/categories";
import { restoreMemberAction } from "@/app/actions/members";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SettingsRow } from "@/components/molecules/SettingsRow";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { PROFILE_COPY } from "@/lib/copy/es";
import type { MutationResult } from "@/lib/actions/state";
import type { SettingsCategoryView, SettingsMemberView } from "@/lib/view/settings";

type RowKey = `member-${number}` | `category-${number}`;

/** Archived members and categories, restorable without confirmation. */
export function ArchivedSection({
  members,
  categories,
}: {
  members: readonly SettingsMemberView[];
  categories: readonly SettingsCategoryView[];
}) {
  const [pendingKey, setPendingKey] = useState<RowKey | null>(null);
  const [errors, setErrors] = useState<Partial<Record<RowKey, string>>>({});

  function restore(key: RowKey, run: () => Promise<MutationResult>) {
    setPendingKey(key);
    startTransition(async () => {
      const result = await run();
      startTransition(() => {
        setPendingKey(null);
        setErrors((previous) => {
          const next = { ...previous };
          if (result.status === "error") next[key] = result.message;
          else delete next[key];
          return next;
        });
      });
    });
  }

  const empty = members.length === 0 && categories.length === 0;

  return (
    <section className="archived-section">
      <h2 className="section-title">{PROFILE_COPY.archivedSection}</h2>
      {empty ? <EmptyState message={PROFILE_COPY.archivedEmpty} /> : null}

      {members.length > 0 ? (
        <>
          <h3 className="archived-section__subtitle">{PROFILE_COPY.archivedMembers}</h3>
          <ul className="settings-list">
            {members.map((member) => {
              const key: RowKey = `member-${member.id}`;
              return (
                <SettingsRow key={key} name={member.name} error={errors[key]}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pendingKey === key}
                    onClick={() => restore(key, () => restoreMemberAction(member.id))}
                  >
                    {pendingKey === key ? PROFILE_COPY.restorePending : PROFILE_COPY.restore}
                  </Button>
                </SettingsRow>
              );
            })}
          </ul>
        </>
      ) : null}

      {categories.length > 0 ? (
        <>
          <h3 className="archived-section__subtitle">{PROFILE_COPY.archivedCategories}</h3>
          <ul className="settings-list">
            {categories.map((category) => {
              const key: RowKey = `category-${category.id}`;
              return (
                <SettingsRow
                  key={key}
                  leading={<CategoryIcon name={category.icon} color={category.color} />}
                  name={category.name}
                  error={errors[key]}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pendingKey === key}
                    onClick={() => restore(key, () => restoreCategoryAction(category.id))}
                  >
                    {pendingKey === key ? PROFILE_COPY.restorePending : PROFILE_COPY.restore}
                  </Button>
                </SettingsRow>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
