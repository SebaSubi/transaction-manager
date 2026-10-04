"use client";

import { useState } from "react";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ICON_LABELS } from "@/lib/copy/es";
import { CATEGORY_ICON_KEYS } from "@/lib/domain/categoryIcons";

/**
 * Radio group over the 21 pickable icons. The choice is written to a hidden
 * `icon` input so a plain form action receives it.
 */
export function IconPicker({
  defaultValue = "",
  name = "icon",
  ariaLabel,
}: {
  defaultValue?: string;
  name?: string;
  ariaLabel?: string;
}) {
  const [selected, setSelected] = useState(defaultValue);

  return (
    <div className="icon-picker" role="radiogroup" aria-label={ariaLabel}>
      <input type="hidden" name={name} value={selected} />
      {CATEGORY_ICON_KEYS.map((key) => {
        const active = key === selected;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={ICON_LABELS[key]}
            className={active ? "icon-picker__item icon-picker__item--active" : "icon-picker__item"}
            onClick={() => setSelected(key)}
          >
            <CategoryIcon name={key} size={20} />
          </button>
        );
      })}
    </div>
  );
}
