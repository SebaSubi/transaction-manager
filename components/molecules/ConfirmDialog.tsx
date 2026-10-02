"use client";

import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";

/**
 * Confirmation prompt (`role="alertdialog"`). It only reports the choice:
 * `onConfirm` runs once on confirm, `onCancel` on cancel, nothing otherwise.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending = false,
  pendingLabel,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  pendingLabel?: string;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
      <h3 id="confirm-title" className="confirm-dialog__title">
        {title}
      </h3>
      <p id="confirm-body" className="confirm-dialog__body">
        {body}
      </p>
      <FieldError message={error} />
      <div className="confirm-dialog__actions">
        <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" disabled={pending} onClick={onConfirm}>
          {pending && pendingLabel !== undefined ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
