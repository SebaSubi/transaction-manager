import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Icon } from "@/components/ui/Icon";
import { LEDGER_COPY } from "@/lib/copy/es";
import { monthKeyLabel, nextMonthKey, prevMonthKey } from "@/lib/domain/month";
import type { MonthKey } from "@/lib/domain/types";

/**
 * ‹ August 2026 › with two plain links. Server-rendered: no client JS, and
 * push navigation so Back walks through months. The caller decides which
 * screen the links point at via `hrefFor`.
 */
export function MonthStepper({
  month,
  hrefFor,
}: {
  month: MonthKey;
  hrefFor: (month: MonthKey) => string;
}) {
  return (
    <div className="month-stepper">
      <Link
        href={hrefFor(prevMonthKey(month))}
        aria-label={LEDGER_COPY.previousMonthAriaLabel}
        className="month-stepper__step"
      >
        <Icon as={ChevronLeft} size={20} />
      </Link>
      <span className="month-stepper__label">{monthKeyLabel(month)}</span>
      <Link
        href={hrefFor(nextMonthKey(month))}
        aria-label={LEDGER_COPY.nextMonthAriaLabel}
        className="month-stepper__step"
      >
        <Icon as={ChevronRight} size={20} />
      </Link>
    </div>
  );
}
