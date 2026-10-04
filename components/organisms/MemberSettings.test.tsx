// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ create: vi.fn(), archive: vi.fn(), restore: vi.fn() }));

vi.mock("@/app/actions/members", () => ({
  createMemberAction: actions.create,
  archiveMemberAction: actions.archive,
  restoreMemberAction: actions.restore,
}));

import { MemberSettings } from "@/components/organisms/MemberSettings";

const members = [
  { id: 1, name: "Sofi" },
  { id: 2, name: "Santi" },
];

beforeEach(() => {
  actions.create.mockReset();
  actions.archive.mockReset();
});
afterEach(cleanup);

describe("MemberSettings", () => {
  it("lists the members", () => {
    render(<MemberSettings members={members} />);
    expect(screen.getByText("Sofi")).toBeDefined();
    expect(screen.getByText("Santi")).toBeDefined();
  });

  it("submits the typed name through the add form", async () => {
    actions.create.mockResolvedValue({ status: "saved", id: 3, name: "Nico" });
    render(<MemberSettings members={members} />);

    fireEvent.change(screen.getByLabelText("Agregar persona"), { target: { value: "Nico" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    });

    expect(actions.create).toHaveBeenCalledTimes(1);
    expect((actions.create.mock.calls[0][1] as FormData).get("name")).toBe("Nico");
  });

  it("shows the field error from the add form", async () => {
    actions.create.mockResolvedValue({
      status: "error",
      fieldErrors: { name: "Ya existe una persona con ese nombre." },
      formError: null,
    });
    render(<MemberSettings members={members} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    });

    expect(screen.getByText("Ya existe una persona con ese nombre.")).toBeDefined();
  });

  it("opens the confirmation on archive without calling the action", () => {
    render(<MemberSettings members={members} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Archivar" })[0]);

    expect(screen.getByRole("alertdialog")).toBeDefined();
    expect(screen.getByText("¿Archivar a Sofi?")).toBeDefined();
    expect(actions.archive).not.toHaveBeenCalled();
  });

  it("cancel closes the dialog and calls nothing", () => {
    render(<MemberSettings members={members} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Archivar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(actions.archive).not.toHaveBeenCalled();
  });

  it("confirm calls the action once with the member id and closes", async () => {
    actions.archive.mockResolvedValue({ status: "ok" });
    render(<MemberSettings members={members} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Archivar" })[1]);

    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Archivar" }));
    });

    expect(actions.archive).toHaveBeenCalledTimes(1);
    expect(actions.archive).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("keeps the dialog open and shows the message when archiving fails", async () => {
    actions.archive.mockResolvedValue({ status: "error", message: "No se puede archivar a la última persona activa." });
    render(<MemberSettings members={members} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Archivar" })[0]);

    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Archivar" }));
    });

    expect(screen.getByRole("alertdialog")).toBeDefined();
    expect(screen.getByText("No se puede archivar a la última persona activa.")).toBeDefined();
  });
});
