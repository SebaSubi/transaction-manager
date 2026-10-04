"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useState,
  type ReactNode,
} from "react";

import type { CategoryRow } from "@/lib/db/repositories/categories.repository";
import type { MemberRow } from "@/lib/db/repositories/members.repository";
import { nowInBuenosAires, toDateTimeLocalValue } from "@/lib/domain/time";
import type { LedgerRowView } from "@/lib/view/ledger";
import {
  EMPTY_OVERLAY,
  reduceOverlay,
  type LedgerOverlay,
  type OverlayAction,
} from "@/lib/view/ledgerOverlay";

export interface EntrySheetContextValue {
  open: boolean;
  mode: "create" | "edit";
  editingRow: LedgerRowView | null;
  defaultMemberId: number | null;
  /** Computed in `openCreate()` (an event handler), never during render. */
  initialDateValue: string;
  /** Active categories of both kinds. */
  categories: readonly CategoryRow[];
  /** Active members. */
  members: readonly MemberRow[];
  overlay: LedgerOverlay;
  dispatchOverlay: (action: OverlayAction) => void;
  openCreate: () => void;
  openEdit: (row: LedgerRowView) => void;
  close: () => void;
  rememberMember: (memberId: number) => void;
}

const EntrySheetContext = createContext<EntrySheetContextValue | null>(null);

/**
 * Owns the sheet state shared by the FAB, the ledger rows and the sheet
 * itself, plus the optimistic ledger overlay (design Decisions 1 and 5). The
 * picker data and the default member arrive from the server layout.
 */
export function EntrySheetProvider({
  categories,
  members,
  defaultMemberId,
  children,
}: {
  categories: readonly CategoryRow[];
  members: readonly MemberRow[];
  defaultMemberId: number | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingRow, setEditingRow] = useState<LedgerRowView | null>(null);
  const [initialDateValue, setInitialDateValue] = useState("");
  const [lastMemberId, setLastMemberId] = useState<number | null>(defaultMemberId);
  // The base is the constant empty overlay, so it clears itself when the
  // transition ends, exactly when the revalidated server rows arrive.
  const [overlay, dispatchOverlay] = useOptimistic(EMPTY_OVERLAY, reduceOverlay);

  const openCreate = useCallback(() => {
    setInitialDateValue(toDateTimeLocalValue(nowInBuenosAires()));
    setMode("create");
    setEditingRow(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((row: LedgerRowView) => {
    setMode("edit");
    setEditingRow(row);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const rememberMember = useCallback((memberId: number) => setLastMemberId(memberId), []);

  const value = useMemo<EntrySheetContextValue>(
    () => ({
      open,
      mode,
      editingRow,
      defaultMemberId: lastMemberId,
      initialDateValue,
      categories,
      members,
      overlay,
      dispatchOverlay,
      openCreate,
      openEdit,
      close,
      rememberMember,
    }),
    [
      open,
      mode,
      editingRow,
      lastMemberId,
      initialDateValue,
      categories,
      members,
      overlay,
      dispatchOverlay,
      openCreate,
      openEdit,
      close,
      rememberMember,
    ],
  );

  return <EntrySheetContext.Provider value={value}>{children}</EntrySheetContext.Provider>;
}

/** Fails loudly when used outside `EntrySheetProvider`. */
export function useEntrySheet(): EntrySheetContextValue {
  const context = useContext(EntrySheetContext);
  if (context === null) {
    throw new Error("useEntrySheet must be used inside <EntrySheetProvider>.");
  }
  return context;
}
