// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ restoreMember: vi.fn(), restoreCategory: vi.fn() }));

vi.mock("@/app/actions/members", () => ({ restoreMemberAction: actions.restoreMember }));
vi.mock("@/app/actions/categories", () => ({ restoreCategoryAction: actions.restoreCategory }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ArchivedSection } from "@/components/organisms/ArchivedSection";

const members = [{ id: 4, name: "Ana" }];
const categories = [{ id: 7, name: "Vieja", icon: "tag", color: "var(--accent-0)" }];

beforeEach(() => {
  actions.restoreMember.mockReset();
  actions.restoreCategory.mockReset();
});
afterEach(cleanup);

describe("ArchivedSection", () => {
  it("shows the empty message when nothing is archived", () => {
    render(<ArchivedSection members={[]} categories={[]} />);
    expect(screen.getByText("No hay elementos archivados.")).toBeDefined();
  });

  it("lists both kinds", () => {
    render(<ArchivedSection members={members} categories={categories} />);
    expect(screen.getByText("Ana")).toBeDefined();
    expect(screen.getByText("Vieja")).toBeDefined();
    expect(screen.queryByText("No hay elementos archivados.")).toBeNull();
  });

  it("restores a member without confirmation", async () => {
    actions.restoreMember.mockResolvedValue({ status: "ok" });
    render(<ArchivedSection members={members} categories={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    });

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(actions.restoreMember).toHaveBeenCalledTimes(1);
    expect(actions.restoreMember).toHaveBeenCalledWith(4);
  });

  it("restores a category without confirmation", async () => {
    actions.restoreCategory.mockResolvedValue({ status: "ok" });
    render(<ArchivedSection members={[]} categories={categories} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    });

    expect(actions.restoreCategory).toHaveBeenCalledWith(7);
  });

  it("shows a per-row error and keeps the other rows untouched", async () => {
    actions.restoreCategory.mockResolvedValue({
      status: "error",
      message: "Ya existe una categoría activa con ese nombre.",
    });
    render(<ArchivedSection members={members} categories={categories} />);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Restaurar" })[1]);
    });

    expect(screen.getAllByText("Ya existe una categoría activa con ese nombre.")).toHaveLength(1);
    expect(actions.restoreMember).not.toHaveBeenCalled();
  });
});
