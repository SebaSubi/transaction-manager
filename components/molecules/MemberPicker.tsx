"use client";

import { ArchivedTag } from "@/components/ui/ArchivedTag";

export interface MemberPickerItem {
  id: number;
  name: string;
  /** Only ever true for the row's own stored value on edit. */
  archived?: boolean;
}

/** "Quién" buttons. Submits the selected id through a hidden input. */
export function MemberPicker({
  options,
  value,
  onChange,
  name = "memberId",
  ariaLabel,
}: {
  options: readonly MemberPickerItem[];
  value: number | null;
  onChange: (id: number) => void;
  name?: string;
  ariaLabel: string;
}) {
  return (
    <div className="member-picker" role="radiogroup" aria-label={ariaLabel}>
      <input type="hidden" name={name} value={value === null ? "" : String(value)} />
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? "member-picker__item member-picker__item--active" : "member-picker__item"}
            onClick={() => onChange(option.id)}
          >
            {option.name}
            {option.archived === true ? <ArchivedTag /> : null}
          </button>
        );
      })}
    </div>
  );
}
