import { cookies } from "next/headers";

import { BottomNav } from "@/components/organisms/BottomNav";
import { EntrySheet } from "@/components/organisms/EntrySheet";
import { EntrySheetProvider } from "@/components/organisms/EntrySheetProvider";
import { SystemThemeWatcher } from "@/components/organisms/SystemThemeWatcher";
import { listActiveCategories } from "@/lib/db/repositories/categories.repository";
import { listActiveMembers } from "@/lib/db/repositories/members.repository";
import { resolveDefaultMemberId } from "@/lib/domain/members";
import { LAST_MEMBER_COOKIE } from "@/lib/members/cookies";

/**
 * The 430px mobile shell shared by all four tab routes. The width lives in
 * `app/globals.css` (`.shell { max-width: 430px }`) rather than an inline
 * style so it stays one declaration for the whole app.
 *
 * It is also the container for the add/edit sheet: it reads the picker data
 * and the last-used-member cookie once per request, so the sheet opens
 * instantly on every tab. The provider shares its state with the FAB and the
 * ledger rows.
 */
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const [categories, members, cookieStore] = await Promise.all([
    listActiveCategories(),
    listActiveMembers(),
    cookies(),
  ]);

  const defaultMemberId = resolveDefaultMemberId(
    cookieStore.get(LAST_MEMBER_COOKIE)?.value,
    members.map((member) => member.id),
  );

  return (
    <div className="shell">
      <SystemThemeWatcher />
      <EntrySheetProvider
        categories={categories}
        members={members}
        defaultMemberId={defaultMemberId}
      >
        <main className="shell__content">{children}</main>
        <BottomNav />
        <EntrySheet />
      </EntrySheetProvider>
    </div>
  );
}
