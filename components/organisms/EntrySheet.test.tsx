// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/app/actions/transactions", () => ({
  createTransactionAction: actions.create,
  updateTransactionAction: actions.update,
  deleteTransactionAction: actions.remove,
}));

import { EntrySheet } from "@/components/organisms/EntrySheet";
import {
  EntrySheetProvider,
  useEntrySheet,
} from "@/components/organisms/EntrySheetProvider";
import type { CategoryRow } from "@/lib/db/repositories/categories.repository";
import type { MemberRow } from "@/lib/db/repositories/members.repository";
import type { LedgerRowView } from "@/lib/view/ledger";

const categories: CategoryRow[] = [
  { id: 1, name: "Super", kind: "expense", icon: "shopping-cart", colorIndex: 0 },
  { id: 2, name: "Luz", kind: "expense", icon: "lightbulb", colorIndex: 1 },
  { id: 3, name: "Sueldo", kind: "income", icon: "banknote", colorIndex: 2 },
];
const members: MemberRow[] = [
  { id: 10, name: "Sofi" },
  { id: 11, name: "Mati" },
];

const row: LedgerRowView = {
  id: 5,
  type: "expense",
  amountLabel: "-$31.000",
  grossLabel: "$33.333",
  cashbackLabel: "7% cashback",
  dateLabel: "14 ago · 21:00",
  category: { id: 1, name: "Super", icon: "shopping-cart", archived: false, color: "var(--accent-0)" },
  member: { id: 11, name: "Mati", archived: false },
  edit: { gross: "33333", cashback: "7", dateValue: "2026-08-14T21:00" },
};

const archivedRow: LedgerRowView = {
  ...row,
  category: { id: 99, name: "Vieja", icon: "tag", archived: true, color: "var(--accent-3)" },
  member: { id: 98, name: "Ex", archived: true },
};

/** Opens the sheet from a button, the way the FAB and the ledger rows do. */
function Opener({ edit }: { edit?: LedgerRowView }) {
  const { openCreate, openEdit } = useEntrySheet();
  return (
    <button type="button" onClick={() => (edit ? openEdit(edit) : openCreate())}>
      abrir
    </button>
  );
}

function setup(options: { edit?: LedgerRowView; members?: MemberRow[]; defaultMemberId?: number | null } = {}) {
  render(
    <EntrySheetProvider
      categories={categories}
      members={options.members ?? members}
      defaultMemberId={options.defaultMemberId === undefined ? 10 : options.defaultMemberId}
    >
      <Opener edit={options.edit} />
      <EntrySheet />
    </EntrySheetProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "abrir" }));
}

function hidden(name: string): string | undefined {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-15T00:00:00Z"));
  actions.create.mockReset();
  actions.update.mockReset();
  actions.remove.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useEntrySheet", () => {
  it("throws outside the provider", () => {
    function Probe() {
      useEntrySheet();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/EntrySheetProvider/);
    spy.mockRestore();
  });
});

describe("EntrySheet (create)", () => {
  it("renders nothing until opened", () => {
    render(
      <EntrySheetProvider categories={categories} members={members} defaultMemberId={10}>
        <EntrySheet />
      </EntrySheetProvider>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("preselects defaultMemberId and uses the Buenos Aires now as the date", () => {
    setup();

    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Nuevo movimiento")).toBeDefined();
    expect(screen.getByRole("radio", { name: "Sofi" }).getAttribute("aria-checked")).toBe("true");
    expect(hidden("memberId")).toBe("10");
    expect((screen.getByLabelText("Fecha y hora") as HTMLInputElement).value).toBe("2026-08-14T21:00");
  });

  it("offers expense categories and swaps to income categories on the type switch", () => {
    setup();
    expect(screen.getByRole("radio", { name: "Super" })).toBeDefined();
    expect(screen.queryByRole("radio", { name: "Sueldo" })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.getByRole("radio", { name: "Sueldo" })).toBeDefined();
    expect(screen.queryByRole("radio", { name: "Super" })).toBeNull();
  });

  it("clears an incompatible selected category when the type changes", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "Super" }));
    expect(hidden("categoryId")).toBe("1");

    fireEvent.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(hidden("categoryId")).toBe("");
  });

  it("hides the cashback field for income", () => {
    setup();
    expect(screen.getByLabelText("Cashback")).toBeDefined();

    fireEvent.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.queryByLabelText("Cashback")).toBeNull();
    expect(document.querySelector('input[name="cashback"]')).toBeNull();
  });

  it("previews the net and the saving with computeNetAmount and never submits them", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "33333" } });
    fireEvent.change(screen.getByLabelText("Cashback"), { target: { value: "7" } });

    expect(screen.getByText("Gasto final $31.000 · ahorro $2.333")).toBeDefined();
    expect(document.querySelector('input[name="amount"]')).toBeNull();
  });

  it("shows the default cashback note without a preview", () => {
    setup();
    expect(screen.getByText("Descuento sobre el monto")).toBeDefined();
  });

  it("keeps entered values and shows Spanish validation errors on a failed save", async () => {
    actions.create.mockResolvedValue({
      status: "error",
      fieldErrors: { categoryId: "Falta elegir una categoría." },
      formError: null,
    });
    setup();
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "500" } });

    await act(async () => {
      fireEvent.submit(document.querySelector("form")!);
    });

    expect(actions.create).toHaveBeenCalledTimes(1);
    const sent = actions.create.mock.calls[0][1] as FormData;
    expect(sent.get("gross")).toBe("500");
    expect(sent.get("type")).toBe("expense");
    expect(sent.get("memberId")).toBe("10");
    expect(screen.getByRole("alert").textContent).toBe("Falta elegir una categoría.");
    expect((screen.getByLabelText("Monto") as HTMLInputElement).value).toBe("500");
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("closes the sheet after a successful create", async () => {
    actions.create.mockResolvedValue({ status: "saved", row, memberId: 10 });
    setup();

    await act(async () => {
      fireEvent.submit(document.querySelector("form")!);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows No hay personas activas. and disables submit when there are no active members", () => {
    setup({ members: [], defaultMemberId: null });

    expect(screen.getByText("No hay personas activas.")).toBeDefined();
    expect((screen.getByRole("button", { name: "Registrar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("closes on Escape", () => {
    setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("EntrySheet (edit)", () => {
  it("pre-fills from row.edit", () => {
    setup({ edit: row });

    expect(screen.getByText("Editar movimiento")).toBeDefined();
    expect((screen.getByLabelText("Monto") as HTMLInputElement).value).toBe("33333");
    expect((screen.getByLabelText("Cashback") as HTMLInputElement).value).toBe("7");
    expect((screen.getByLabelText("Fecha y hora") as HTMLInputElement).value).toBe("2026-08-14T21:00");
    expect(screen.getByRole("radio", { name: "Super" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Mati" }).getAttribute("aria-checked")).toBe("true");
    expect(hidden("id")).toBe("5");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDefined();
  });

  it("shows an archived category and member marked (en archivo) as the row's own stored value", () => {
    setup({ edit: archivedRow });

    expect(within(screen.getByRole("radio", { name: /Vieja/ })).getByText("(en archivo)")).toBeDefined();
    expect(within(screen.getByRole("radio", { name: /Ex/ })).getByText("(en archivo)")).toBeDefined();
    expect(screen.getByRole("radio", { name: /Vieja/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("does not re-offer the archived category after switching the type away", () => {
    setup({ edit: archivedRow });

    fireEvent.click(screen.getByRole("radio", { name: "Ingreso" }));

    expect(screen.queryByRole("radio", { name: /Vieja/ })).toBeNull();
    expect(hidden("categoryId")).toBe("");
  });

  it("dispatches update with the edited form and closes on success", async () => {
    actions.update.mockResolvedValue({ status: "saved", row, memberId: 11 });
    setup({ edit: row });

    await act(async () => {
      fireEvent.submit(document.querySelector("form")!);
    });

    expect(actions.update).toHaveBeenCalledTimes(1);
    expect((actions.update.mock.calls[0][1] as FormData).get("id")).toBe("5");
    expect(actions.create).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a confirmation from the delete button and cancel does not delete", () => {
    setup({ edit: row });

    fireEvent.click(screen.getByRole("button", { name: "Eliminar movimiento" }));
    expect(screen.getByRole("alertdialog")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(actions.remove).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("deletes once on confirm and closes the sheet", async () => {
    actions.remove.mockResolvedValue({ status: "deleted", id: 5 });
    setup({ edit: row });
    fireEvent.click(screen.getByRole("button", { name: "Eliminar movimiento" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    });

    expect(actions.remove).toHaveBeenCalledExactlyOnceWith(5);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the sheet open and shows the error when the delete fails", async () => {
    actions.remove.mockResolvedValue({ status: "error", message: "No se pudo eliminar el movimiento." });
    setup({ edit: row });
    fireEvent.click(screen.getByRole("button", { name: "Eliminar movimiento" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    });

    expect(screen.getByText("No se pudo eliminar el movimiento.")).toBeDefined();
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});
