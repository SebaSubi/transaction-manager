import { monthAbbrev } from "@/lib/domain/month";
import type { TransactionType } from "@/lib/domain/types";

/**
 * Groups digits with '.' manually. `toLocaleString` is deliberately avoided:
 * server and browser ICU data can disagree, which would cause a hydration
 * mismatch on every amount.
 */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Raw digits for display while typing: '12000000' -> '12.000.000'. */
export function formatPesoInput(digits: string): string {
  return groupThousands(digits);
}

/**
 * Normalizes an amount input while typing (es-AR): digits are re-grouped with
 * '.' thousands separators and an optional ',' decimal part of at most 2
 * digits is kept. A '.' is read as a decimal point only when that is
 * unambiguous: a trailing '.' ('1500.') or 1-2 digits after the only '.' with
 * no comma ('1500.5', '12.50'). '1.500' stays thousands. Anything else
 * (letters, a minus, spaces, a second comma, 3+ decimals) is returned unchanged
 * so server-side validation shows its message; nothing is silently dropped.
 */
export function normalizePesoInput(text: string): string {
  if (/[^\d.,]/.test(text)) return text;

  let integerPart: string;
  let decimalPart: string | null = null;

  const commaParts = text.split(",");
  if (commaParts.length > 2) return text;
  if (commaParts.length === 2) {
    if (commaParts[1].includes(".") || commaParts[1].length > 2) return text;
    integerPart = commaParts[0].replace(/\./g, "");
    decimalPart = commaParts[1];
  } else {
    const decimalDot = /^(\d+)\.(\d{0,2})$/.exec(text);
    if (decimalDot !== null) {
      integerPart = decimalDot[1];
      decimalPart = decimalDot[2];
    } else {
      integerPart = text.replace(/\./g, "");
    }
  }

  if (integerPart === "" && decimalPart === null) return text;
  const grouped = integerPart === "" ? "0" : groupThousands(integerPart);
  return decimalPart === null ? grouped : `${grouped},${decimalPart}`;
}

/**
 * Integer cents -> es-AR peso text: 1989800 -> '$19.898'; 1989850 ->
 * '$19.898,50'; -500 -> '-$5'. The ',xx' part appears only when the cents are
 * non-zero, so whole-peso amounts read as before. Never rounds.
 */
export function formatArs(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const pesos = Math.trunc(abs / 100);
  const fraction = abs % 100;
  const decimals = fraction === 0 ? "" : `,${String(fraction).padStart(2, "0")}`;
  return `${sign}$${groupThousands(String(pesos))}${decimals}`;
}

/**
 * Integer cents -> text for an amount input: 150000 -> '1.500'; 150050 ->
 * '1.500,50'. Same shape as `formatArs` without the '$'.
 */
export function formatCentsInput(cents: number): string {
  return formatArs(cents).replace("$", "");
}

/** Expense -> '-$31.000', income -> '+$50.000'. */
export function formatSignedArs(type: TransactionType, amount: number): string {
  return `${type === "expense" ? "-" : "+"}${formatArs(Math.abs(amount))}`;
}

/**
 * '14 ago · 21:00' from the wall-clock UTC components (which ARE Buenos Aires
 * local time under the `TZ=UTC` invariant), so nothing is shifted.
 */
export function formatShortDate(wallClock: Date): string {
  const hours = String(wallClock.getUTCHours()).padStart(2, "0");
  const minutes = String(wallClock.getUTCMinutes()).padStart(2, "0");
  return `${wallClock.getUTCDate()} ${monthAbbrev(wallClock.getUTCMonth() + 1)} · ${hours}:${minutes}`;
}

/** Basis points -> percent with a comma decimal and trimmed zeros: 750 -> '7,5'. */
export function formatPercent(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const fraction = String(bps % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction === "" ? String(whole) : `${whole},${fraction}`;
}
