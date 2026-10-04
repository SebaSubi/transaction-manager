import type { CategoryLabel } from "@/lib/db/repositories/categories.repository";
import type { MemberLabel } from "@/lib/db/repositories/members.repository";
import { categoryColor } from "@/lib/domain/categories";
import {
  formatArs,
  formatPercent,
  formatShortDate,
  formatSignedArs,
} from "@/lib/domain/format";
import { toDateTimeLocalValue } from "@/lib/domain/time";
import type { DomainTransaction, TransactionType } from "@/lib/domain/types";

/**
 * Render-ready, serializable ledger row. `Date` never crosses the
 * server/client boundary: only strings and numbers do.
 */
export interface LedgerRowView {
  id: number;
  type: TransactionType;
  /** `formatSignedArs(type, amount)` — the persisted net. */
  amountLabel: string;
  /** `formatArs(gross)` when the row is an expense with cashback. */
  grossLabel: string | null;
  /** '7% cashback', only for an expense with cashback. */
  cashbackLabel: string | null;
  dateLabel: string;
  category: {
    id: number;
    name: string;
    icon: string;
    archived: boolean;
    /** Derived here with `categoryColor`; components never see `colorIndex`. */
    color: string;
  };
  member: { id: number; name: string; archived: boolean };
  /** Seed strings for the edit form inputs. */
  edit: { gross: string; cashback: string; dateValue: string };
}

/**
 * Maps a persisted transaction and its labels to a view. Pages and Server
 * Actions share this mapper, so the row an action returns has exactly the
 * shape the page renders.
 */
export function toLedgerRowView(
  tx: DomainTransaction,
  category: CategoryLabel,
  member: MemberLabel,
): LedgerRowView {
  const hasCashback = tx.type === "expense" && tx.cashbackBps > 0;

  return {
    id: tx.id,
    type: tx.type,
    amountLabel: formatSignedArs(tx.type, tx.amount),
    grossLabel: hasCashback ? formatArs(tx.gross) : null,
    cashbackLabel: hasCashback ? `${formatPercent(tx.cashbackBps)}% cashback` : null,
    dateLabel: formatShortDate(tx.date),
    category: {
      id: category.id,
      name: category.name,
      icon: category.icon,
      archived: category.archived,
      color: categoryColor(category.colorIndex),
    },
    member: { id: member.id, name: member.name, archived: member.archived },
    edit: {
      gross: String(tx.gross),
      cashback: formatPercent(tx.cashbackBps),
      dateValue: toDateTimeLocalValue(tx.date),
    },
  };
}
