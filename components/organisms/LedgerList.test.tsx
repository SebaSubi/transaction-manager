// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { startTransition } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/transactions", () => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
  deleteTransactionAction: vi.fn(),
}));

import { EntrySheet } from "@/components/organisms/EntrySheet";
import { EntrySheetProvider, useEntrySheet } from "@/components/organisms/EntrySheetProvider";
import { LedgerList } from "@/components/organisms/LedgerList";
import type { LedgerRowView } from "@/lib/view/ledger";
import type { OverlayAction } from "@/lib/view/ledgerOverlay";

function makeRow(id: number, category: string): LedgerRowView {
  return {
    id,
    type: "expense",
    amountLabel: `-$${id}00`,
    grossLabel: null,
    cashbackLabel: null,
    dateLabel: "14 ago · 21:00",
    category: { id, name: category, icon: "tag", archived: false, color: "var(--accent-0)" },
    member: { id: 1, name: "Sofi", archived: false },
    edit: { gross: `${id}00`, cashback: "0", dateValue: "2026-08-14T21:00" },
  };
}

const rows = [makeRow(1, "Super"), makeRow(2, "Luz")];

/** Holds an optimistic overlay open the way a pending server action does. */
function Dispatcher({ action, release }: { action: OverlayAction; release: Promise<void> }) {
  const { dispatchOverlay } = useEntrySheet();
  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          dispatchOverlay(action);
          await release;
        })
      }
    >
      aplicar
    </button>
  );
}

function setup(action?: OverlayAction) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  render(
    <EntrySheetProvider categories={[]} members={[]} defaultMemberId={null}>
      {action !== undefined ? <Dispatcher action={action} release={gate} /> : null}
      <LedgerList rows={rows} />
      <EntrySheet />
    </EntrySheetProvider>,
  );
  return { release };
}

afterEach(cleanup);

describe("LedgerList", () => {
  it("renders one row per view", () => {
    setup();
    expect(screen.getByText("Super")).toBeDefined();
    expect(screen.getByText("Luz")).toBeDefined();
  });

  it("hides a row removed by the optimistic overlay", async () => {
    const { release } = setup({ kind: "remove", id: 1 });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "aplicar" }));
    });

    expect(screen.queryByText("Super")).toBeNull();
    expect(screen.getByText("Luz")).toBeDefined();
    await act(async () => release());
  });

  it("dims a pending row", async () => {
    const { release } = setup({ kind: "pending", id: 2 });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "aplicar" }));
    });

    const luz = screen.getByText("Luz").closest("button.ledger-row")!;
    const super_ = screen.getByText("Super").closest("button.ledger-row")!;
    expect(luz.hasAttribute("data-pending")).toBe(true);
    expect(super_.hasAttribute("data-pending")).toBe(false);
    await act(async () => release());
  });

  it("opens the edit sheet on row click", () => {
    setup();

    fireEvent.click(screen.getByText("Luz").closest("button.ledger-row")!);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Editar movimiento")).toBeDefined();
  });
});
