"use client";

import { ArchivedTag } from "@/components/ui/ArchivedTag";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

export interface OptionGridItem {
  id: number;
  name: string;
  icon: string;
  /** A `var(--accent-N)` reference. */
  color: string;
  /** Only ever true for the row's own stored value on edit. */
  archived?: boolean;
}

/** Category picker grid. Submits the selected id through a hidden input. */
export function OptionGrid({
  options,
  value,
  onChange,
  name = "categoryId",
  ariaLabel,
}: {
  options: readonly OptionGridItem[];
  value: number | null;
  onChange: (id: number) => void;
  name?: string;
  ariaLabel: string;
}) {
  return (
    <div className="option-grid" role="radiogroup" aria-label={ariaLabel}>
      <input type="hidden" name={name} value={value === null ? "" : String(value)} />
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? "option-grid__item option-grid__item--active" : "option-grid__item"}
            onClick={() => onChange(option.id)}
          >
            <CategoryIcon name={option.icon} color={option.color} />
            <span className="option-grid__name">{option.name}</span>
            {option.archived === true ? <ArchivedTag /> : null}
          </button>
        );
      })}
    </div>
  );
}
