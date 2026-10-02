// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";

afterEach(cleanup);

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="¿Eliminar este movimiento?"
      body="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      cancelLabel="Cancelar"
      pendingLabel="Eliminando…"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("is an alertdialog with the title and body", () => {
    setup();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeDefined();
    expect(screen.getByText("¿Eliminar este movimiento?")).toBeDefined();
    expect(screen.getByText("Esta acción no se puede deshacer.")).toBeDefined();
  });

  it("cancel leaves the confirm action uncalled", () => {
    const { onConfirm, onCancel } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirm calls the action once", () => {
    const { onConfirm, onCancel } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("shows the pending label and disables both buttons while pending", () => {
    render(
      <ConfirmDialog
        title="t"
        body="b"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        pendingLabel="Eliminando…"
        pending
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect((screen.getByRole("button", { name: "Eliminando…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
