"use client";

import { FieldError } from "@/components/ui/FieldError";
import { SHEET_COPY } from "@/lib/copy/es";
import { normalizePesoInput } from "@/lib/domain/format";

/** Whole-peso amount input: numeric keypad, `$` prefix, no decimals. Digits are grouped with thousands dots as typed. */
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
          value={normalizePesoInput(value)}
          onChange={(event) => onChange(normalizePesoInput(event.target.value))}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}
