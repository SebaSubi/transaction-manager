// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsRow } from "@/components/molecules/SettingsRow";

afterEach(cleanup);

describe("SettingsRow", () => {
  it("renders the leading slot, the name and the trailing actions", () => {
    render(
      <SettingsRow leading={<span>L</span>} name="Ana">
        <button type="button">Archivar</button>
      </SettingsRow>,
    );

    expect(screen.getByText("L")).toBeDefined();
    expect(screen.getByText("Ana")).toBeDefined();
    expect(screen.getByRole("button", { name: "Archivar" })).toBeDefined();
  });

  it("renders an error line when given", () => {
    render(<SettingsRow name="Ana" error="No se pudo archivar." />);
    expect(screen.getByRole("alert").textContent).toBe("No se pudo archivar.");
  });
});
