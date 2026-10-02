"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
import { X } from "lucide-react";

import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from "@/app/actions/transactions";
import { AmountField } from "@/components/molecules/AmountField";
import { CashbackField } from "@/components/molecules/CashbackField";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { MemberPicker } from "@/components/molecules/MemberPicker";
import { OptionGrid } from "@/components/molecules/OptionGrid";
import { SegmentedControl } from "@/components/molecules/SegmentedControl";
import { useEntrySheet } from "@/components/organisms/EntrySheetProvider";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { Icon } from "@/components/ui/Icon";
import { SHEET_COPY, cashbackPreview } from "@/lib/copy/es";
import { categoryColor } from "@/lib/domain/categories";
import { formatArs } from "@/lib/domain/format";
import { computeNetAmount } from "@/lib/domain/money";
import type { TransactionType } from "@/lib/domain/types";
import { parseCashbackBps, parseWholePesos } from "@/lib/domain/validation";
import {
  INITIAL_TRANSACTION_FORM_STATE,
  type TransactionFormState,
} from "@/lib/actions/state";

const TYPE_OPTIONS = [
  { value: "expense", label: SHEET_COPY.typeExpense },
  { value: "income", label: SHEET_COPY.typeIncome },
] as const;

/** The sheet renders only while open, so every opening starts from a fresh form. */
export function EntrySheet() {
  const { open } = useEntrySheet();
  return open ? <EntryForm /> : null;
}

/** Display-only preview: the same pure function the server uses for the net. */
function previewFor(type: TransactionType, grossRaw: string, cashbackRaw: string): string | null {
  if (type !== "expense") return null;
  const gross = parseWholePesos(grossRaw);
  const cashback = parseCashbackBps(cashbackRaw);
  if (!gross.ok || !cashback.ok || cashback.value === 0) return null;

  const net = computeNetAmount({
    type,
    gross: gross.value,
    cashbackBps: cashback.value,
  });
  return cashbackPreview(formatArs(net), formatArs(gross.value - net));
}

function EntryForm() {
  const {
    mode,
    editingRow,
    defaultMemberId,
    initialDateValue,
    categories,
    members,
    dispatchOverlay,
    close,
    rememberMember,
  } = useEntrySheet();

  const editing = mode === "edit" ? editingRow : null;

  const [type, setType] = useState<TransactionType>(editing?.type ?? "expense");
  const [gross, setGross] = useState(editing?.edit.gross ?? "");
  const [cashback, setCashback] = useState(
    editing === null || editing.edit.cashback === "0" ? "" : editing.edit.cashback,
  );
  const [categoryId, setCategoryId] = useState<number | null>(editing?.category.id ?? null);
  const [memberId, setMemberId] = useState<number | null>(
    editing?.member.id ?? defaultMemberId,
  );
  const [date, setDate] = useState(editing?.edit.dateValue ?? initialDateValue);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const [state, formAction, pending] = useActionState<TransactionFormState, FormData>(
    async (previous, formData) => {
      // Optimistic dim only on edit: a created row's month, filters and position
      // are unknown on the client.
      if (editing !== null) dispatchOverlay({ kind: "pending", id: editing.id });

      const action = editing !== null ? updateTransactionAction : createTransactionAction;
      const result = await action(previous, formData);

      if (result.status === "saved") {
        rememberMember(result.memberId);
        // Post-await state updates are not part of the action transition, so
        // they are wrapped explicitly (Next.js interactive-apps guide).
        startTransition(() => {
          if (editing !== null) dispatchOverlay({ kind: "replace", row: result.row });
          close();
        });
      }
      return result;
    },
    INITIAL_TRANSACTION_FORM_STATE,
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  // Active categories of the chosen kind, plus the row's own archived category
  // only while the type still matches the stored one. It is never re-offered
  // after the type is switched away.
  const categoryOptions = [
    ...categories
      .filter((category) => category.kind === type)
      .map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: categoryColor(category.colorIndex),
      })),
    ...(editing !== null && editing.category.archived && editing.type === type
      ? [
          {
            id: editing.category.id,
            name: editing.category.name,
            icon: editing.category.icon,
            color: editing.category.color,
            archived: true,
          },
        ]
      : []),
  ];

  const memberOptions = [
    ...members.map((member) => ({ id: member.id, name: member.name })),
    ...(editing !== null && editing.member.archived
      ? [{ id: editing.member.id, name: editing.member.name, archived: true }]
      : []),
  ];

  const noMembers = memberOptions.length === 0;
  const errors = state.status === "error" ? state.fieldErrors : {};
  const formError = state.status === "error" ? (state.formError ?? errors.id ?? null) : null;

  function changeType(next: TransactionType) {
    if (next === type) return;
    setType(next);
    // The selected category survives only when it is valid for the new type.
    // The row's own archived category is not in `categories`; its kind is the
    // stored type.
    if (categoryId === null) return;
    const kind = categories.find((category) => category.id === categoryId)?.kind ?? editing?.type;
    if (kind !== next) setCategoryId(null);
  }

  function confirmDelete() {
    if (editing === null) return;
    setDeleteError(null);
    startDelete(async () => {
      dispatchOverlay({ kind: "remove", id: editing.id });
      const result = await deleteTransactionAction(editing.id);
      if (result.status === "deleted") {
        startTransition(close);
      } else {
        startTransition(() => setDeleteError(result.message));
      }
    });
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet__header">
          <h2 id="entry-sheet-title" className="sheet__title">
            {mode === "edit" ? SHEET_COPY.titleEdit : SHEET_COPY.titleCreate}
          </h2>
          <button
            type="button"
            className="sheet__close"
            aria-label={SHEET_COPY.closeAriaLabel}
            onClick={close}
          >
            <Icon as={X} size={20} />
          </button>
        </header>

        <form action={formAction} className="sheet__form">
          {editing !== null ? <input type="hidden" name="id" value={editing.id} /> : null}
          <input type="hidden" name="type" value={type} />

          <SegmentedControl
            options={TYPE_OPTIONS}
            value={type}
            onChange={changeType}
            ariaLabel={`${SHEET_COPY.typeExpense} / ${SHEET_COPY.typeIncome}`}
          />
          <FieldError message={errors.type} />

          <AmountField value={gross} onChange={setGross} error={errors.gross} />

          {type === "expense" ? (
            <CashbackField
              value={cashback}
              onChange={setCashback}
              note={previewFor(type, gross, cashback)}
              error={errors.cashback}
            />
          ) : null}

          <div className="field">
            <span className="field__label">{SHEET_COPY.categoryLabel}</span>
            <OptionGrid
              options={categoryOptions}
              value={categoryId}
              onChange={setCategoryId}
              ariaLabel={SHEET_COPY.categoryLabel}
            />
            <FieldError message={errors.categoryId} />
          </div>

          <div className="field">
            <span className="field__label">{SHEET_COPY.memberLabel}</span>
            {noMembers ? (
              <p className="field__note">{SHEET_COPY.noMembers}</p>
            ) : (
              <MemberPicker
                options={memberOptions}
                value={memberId}
                onChange={setMemberId}
                ariaLabel={SHEET_COPY.memberLabel}
              />
            )}
            <FieldError message={errors.memberId} />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="entry-date">
              {SHEET_COPY.dateLabel}
            </label>
            <input
              id="entry-date"
              name="date"
              type="datetime-local"
              className="input"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <FieldError message={errors.date} />
          </div>

          <FieldError message={formError} />

          <Button type="submit" disabled={pending || noMembers}>
            {pending
              ? SHEET_COPY.submitPending
              : mode === "edit"
                ? SHEET_COPY.submitEdit
                : SHEET_COPY.submitCreate}
          </Button>

          {editing !== null ? (
            <Button
              type="button"
              variant="ghost"
              className="sheet__delete"
              disabled={pending || deleting}
              onClick={() => setConfirming(true)}
            >
              {SHEET_COPY.deleteButton}
            </Button>
          ) : null}
        </form>

        {confirming ? (
          <ConfirmDialog
            title={SHEET_COPY.confirmTitle}
            body={SHEET_COPY.confirmBody}
            confirmLabel={SHEET_COPY.confirmAction}
            cancelLabel={SHEET_COPY.confirmCancel}
            pendingLabel={SHEET_COPY.confirmPending}
            pending={deleting}
            error={deleteError}
            onConfirm={confirmDelete}
            onCancel={() => {
              setConfirming(false);
              setDeleteError(null);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
