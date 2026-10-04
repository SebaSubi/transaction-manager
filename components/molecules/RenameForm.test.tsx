// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ rename: vi.fn() }));

vi.mock("@/app/actions/categories", () => ({
  renameCategoryAction: actions.rename,
}));

import { RenameForm } from "@/components/molecules/RenameForm";

beforeEach(() => actions.rename.mockReset());
afterEach(cleanup);

describe("RenameForm", () => {
  it("submits the id and the typed name", async () => {
    actions.rename.mockResolvedValue({ status: "saved", id: 3, name: "Nuevo" });
    const onDone = vi.fn();
    render(<RenameForm categoryId={3} currentName="Viejo" onDone={onDone} />);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nuevo" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    });

    expect(actions.rename).toHaveBeenCalledTimes(1);
    const form = actions.rename.mock.calls[0][1] as FormData;
    expect(form.get("id")).toBe("3");
    expect(form.get("name")).toBe("Nuevo");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders the field error and stays open", async () => {
    actions.rename.mockResolvedValue({
      status: "error",
      fieldErrors: { name: "El nombre es obligatorio." },
      formError: null,
    });
    const onDone = vi.fn();
    render(<RenameForm categoryId={3} currentName="Viejo" onDone={onDone} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    });

    expect(screen.getByText("El nombre es obligatorio.")).toBeDefined();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("cancel calls onDone without calling the action", () => {
    const onDone = vi.fn();
    render(<RenameForm categoryId={3} currentName="Viejo" onDone={onDone} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(actions.rename).not.toHaveBeenCalled();
  });
});
