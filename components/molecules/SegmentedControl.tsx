"use client";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

/** A single-choice toggle (Gasto/Ingreso, Todos/Gastos/Ingresos). */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={selected ? "segmented__option segmented__option--active" : "segmented__option"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
