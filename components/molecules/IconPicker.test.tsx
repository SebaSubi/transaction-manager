// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IconPicker } from "@/components/molecules/IconPicker";
import { ICON_LABELS } from "@/lib/copy/es";

afterEach(cleanup);

describe("IconPicker", () => {
  it("renders exactly 21 radios with Spanish labels", () => {
    render(<IconPicker />);
    const radios = screen.getAllByRole("radio");

    expect(radios).toHaveLength(21);
    expect(screen.getByRole("radio", { name: ICON_LABELS["shopping-cart"] })).toBeDefined();
    expect(screen.getByRole("radio", { name: "Otros" })).toBeDefined();
  });

  it("writes the selected key to the hidden icon input", () => {
    const { container } = render(<IconPicker />);
    const hidden = container.querySelector('input[name="icon"]') as HTMLInputElement;
    expect(hidden.value).toBe("");

    fireEvent.click(screen.getByRole("radio", { name: "Casa" }));

    expect(hidden.value).toBe("house");
    expect(screen.getByRole("radio", { name: "Casa" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Gota" }).getAttribute("aria-checked")).toBe("false");
  });

  it("starts with the given default selected", () => {
    const { container } = render(<IconPicker defaultValue="gift" />);
    expect((container.querySelector('input[name="icon"]') as HTMLInputElement).value).toBe("gift");
  });
});
