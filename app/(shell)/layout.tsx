import { BottomNav } from "@/components/organisms/BottomNav";
import { SystemThemeWatcher } from "@/components/organisms/SystemThemeWatcher";

/**
 * The 430px mobile shell shared by all four tab routes. The width lives in
 * `app/globals.css` (`.shell { max-width: 430px }`) rather than an inline
 * style so it stays one declaration for the whole app.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <SystemThemeWatcher />
      <main className="shell__content">{children}</main>
      <BottomNav />
    </div>
  );
}
