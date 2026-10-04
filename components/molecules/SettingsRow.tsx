import type { ReactNode } from "react";

import { FieldError } from "@/components/ui/FieldError";

/** A settings list row: leading icon or avatar, name, trailing action slot. */
export function SettingsRow({
  leading,
  name,
  error,
  children,
}: {
  leading?: ReactNode;
  name: ReactNode;
  error?: string | null;
  children?: ReactNode;
}) {
  return (
    <li className="settings-row">
      <div className="settings-row__main">
        {leading !== undefined ? <span className="settings-row__leading">{leading}</span> : null}
        <span className="settings-row__name">{name}</span>
        {children !== undefined ? <span className="settings-row__actions">{children}</span> : null}
      </div>
      <FieldError message={error} />
    </li>
  );
}
