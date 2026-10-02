"use client";

import { LedgerRow } from "@/components/molecules/LedgerRow";
import { useEntrySheet } from "@/components/organisms/EntrySheetProvider";
import type { LedgerRowView } from "@/lib/view/ledger";
import { applyOverlay } from "@/lib/view/ledgerOverlay";

/**
 * Server rows with the optimistic overlay applied: removed rows disappear,
 * pending rows dim, replaced rows show the server-returned view. A row click
 * opens the edit sheet.
 */
export function LedgerList({ rows }: { rows: readonly LedgerRowView[] }) {
  const { overlay, openEdit } = useEntrySheet();

  return (
    <ul className="ledger-list">
      {applyOverlay(rows, overlay).map(({ pending, ...row }) => (
        <li key={row.id}>
          <LedgerRow row={row} pending={pending} onSelect={openEdit} />
        </li>
      ))}
    </ul>
  );
}
