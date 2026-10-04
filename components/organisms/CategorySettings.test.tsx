// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  create: vi.fn(),
  rename: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
}));

vi.mock("@/app/actions/categories", () => ({
  createCategoryAction: actions.create,
  renameCategoryAction: actions.rename,
  archiveCategoryAction: actions.archive,
  restoreCategoryAction: actions.restore,
}));

import { CategorySettings } from "@/components/organisms/CategorySettings";

const categories = [
  { id: 1, name: "Super", icon: "shopping-cart", color: "var(--accent-0)" },
  { id: 2, name: "Luz", icon: "lightbulb", color: "var(--accent-1)" },
];

beforeEach(() => {
  for (const mock of Object.values(actions)) mock.mockReset();
});
afterEach(cleanup);

describe("CategorySettings", () => {
  it("lists the categories", () => {
    render(<CategorySettings categories={categories} />);
    expect(screen.getByText("Super")).toBeDefined();
    expect(screen.getByText("Luz")).toBeDefined();
  });

  it("adds a category with the picked icon", async () => {
    actions.create.mockResolvedValue({ status: "saved", id: 3, name: "Nafta" });
    render(<CategorySettings categories={categories} />);

    fireEvent.change(screen.getByLabelText("Agregar categoría"), { target: { value: "Nafta" } });
    fireEvent.click(screen.getByRole("radio", { name: "Carrito" }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Agregar categoría" })[0]);
    });

    expect(actions.create).toHaveBeenCalledTimes(1);
    const form = actions.create.mock.calls[0][1] as FormData;
    expect(form.get("name")).toBe("Nafta");
    expect(form.get("icon")).toBe("shopping-cart");
  });

  it("shows the icon field error", async () => {
    actions.create.mockResolvedValue({
      status: "error",
      fieldErrors: { icon: "Elija un ícono." },
      formError: null,
    });
    render(<CategorySettings categories={categories} />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Agregar categoría" })[0]);
    });

    expect(screen.getByText("Elija un ícono.")).toBeDefined();
  });

  it("opens an inline rename form for one row and closes it on cancel", () => {
    render(<CategorySettings categories={categories} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Cambiar nombre" })[0]);

    expect(screen.getByDisplayValue("Super")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByDisplayValue("Super")).toBeNull();
    expect(actions.rename).not.toHaveBeenCalled();
  });

  it("archive asks for confirmation; cancel calls nothing", () => {
    render(<CategorySettings categories={categories} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Archivar" })[1]);

    expect(screen.getByText("¿Archivar la categoría Luz?")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(actions.archive).not.toHaveBeenCalled();
  });

  it("confirm calls the archive action once with the id", async () => {
    actions.archive.mockResolvedValue({ status: "ok" });
    render(<CategorySettings categories={categories} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Archivar" })[1]);

    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Archivar" }));
    });

    expect(actions.archive).toHaveBeenCalledTimes(1);
    expect(actions.archive).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
