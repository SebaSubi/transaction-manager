import { cookies } from "next/headers";

import { ProfileScreen } from "@/components/screens/ProfileScreen";
import {
  listActiveCategoriesByKind,
  listArchivedCategories,
} from "@/lib/db/repositories/categories.repository";
import {
  listActiveMembers,
  listArchivedMembers,
} from "@/lib/db/repositories/members.repository";
import { isThemePreference } from "@/lib/domain/theme";
import { DEFAULT_THEME_PREFERENCE, THEME_COOKIE } from "@/lib/theme/cookies";
import {
  toSettingsCategoryView,
  toSettingsMemberView,
} from "@/lib/view/settings";

/**
 * Perfil container. Reads active and archived members and expense categories
 * plus the theme cookie (`cookies()` is async in this Next.js version), and
 * maps them to view models.
 */
export default async function PerfilPage() {
  const [members, archivedMembers, categories, archivedCategories, store] =
    await Promise.all([
      listActiveMembers(),
      listArchivedMembers(),
      listActiveCategoriesByKind("expense"),
      listArchivedCategories("expense"),
      cookies(),
    ]);

  const stored = store.get(THEME_COOKIE)?.value;
  const themePreference = isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;

  return (
    <ProfileScreen
      members={members.map(toSettingsMemberView)}
      categories={categories.map(toSettingsCategoryView)}
      archivedMembers={archivedMembers.map(toSettingsMemberView)}
      archivedCategories={archivedCategories.map(toSettingsCategoryView)}
      themePreference={themePreference}
    />
  );
}
