"use client";

import { FieldError } from "@/components/ui/FieldError";
import { SHEET_COPY } from "@/lib/copy/es";

/**
 * Cashback percentage input. `note` is the display-only preview computed by
 * the caller with the domain `computeNetAmount`; it is never submitted.
 */
export function CashbackField({
  value,
  onChange,
  note,
  error,
  name = "cashback",
}: {
  value: string;
  onChange: (value: string) => void;
  note?: string | null;
  error?: string | null;
  name?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor="entry-cashback">
        {SHEET_COPY.cashbackLabel}
      </label>
      <div className="amount-field">
        <input
          id="entry-cashback"
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="amount-field__input"
          placeholder="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="amount-field__suffix" aria-hidden>
          %
        </span>
      </div>
      <p className="field__note">{note ?? SHEET_COPY.cashbackNote}</p>
      <FieldError message={error} />
    </div>
  );
}
