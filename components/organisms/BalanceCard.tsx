import { balanceLabel } from "@/lib/copy/es";
import { formatArs } from "@/lib/domain/format";

/** This-month balance. A negative balance takes the expense colour. */
export function BalanceCard({
  monthName,
  balance,
}: {
  monthName: string;
  balance: number;
}) {
  const amountClass =
    balance < 0
      ? "balance-card__amount balance-card__amount--negative"
      : "balance-card__amount";

  return (
    <section className="balance-card">
      <p className="balance-card__label">{balanceLabel(monthName)}</p>
      <p className={amountClass}>{formatArs(balance)}</p>
    </section>
  );
}
