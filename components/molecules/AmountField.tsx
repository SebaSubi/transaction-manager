"use client";

import { FieldError } from "@/components/ui/FieldError";
import { SHEET_COPY } from "@/lib/copy/es";

/** Whole-peso amount input: numeric keypad, `$` prefix, no decimals. */
export function AmountField({
  value,
  onChange,
  error,
  name = "gross",
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  name?: string;
}) {
  return (
    <div className="field">
      <div className="amount-field">
        <span className="amount-field__prefix" aria-hidden>
          $
        </span>
        <input
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="amount-field__input"
          aria-label={SHEET_COPY.amountAriaLabel}
          placeholder={SHEET_COPY.amountPlaceholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}
