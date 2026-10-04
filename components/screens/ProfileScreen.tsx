import { ArchivedSection } from "@/components/organisms/ArchivedSection";
import { CategorySettings } from "@/components/organisms/CategorySettings";
import { MemberSettings } from "@/components/organisms/MemberSettings";
import { ThemeSwitch } from "@/components/organisms/ThemeSwitch";
import { PROFILE_COPY } from "@/lib/copy/es";
import type { ThemePreference } from "@/lib/domain/types";
import type { SettingsCategoryView, SettingsMemberView } from "@/lib/view/settings";

/** Perfil layout: members, expense categories, archived items and the theme. */
export function ProfileScreen({
  members,
  categories,
  archivedMembers,
  archivedCategories,
  themePreference,
}: {
  members: readonly SettingsMemberView[];
  categories: readonly SettingsCategoryView[];
  archivedMembers: readonly SettingsMemberView[];
  archivedCategories: readonly SettingsCategoryView[];
  themePreference: ThemePreference;
}) {
  return (
    <section className="screen">
      <h1 className="screen__title">{PROFILE_COPY.title}</h1>
      <MemberSettings members={members} />
      <CategorySettings categories={categories} />
      <ArchivedSection members={archivedMembers} categories={archivedCategories} />
      <ThemeSwitch preference={themePreference} />
    </section>
  );
}
