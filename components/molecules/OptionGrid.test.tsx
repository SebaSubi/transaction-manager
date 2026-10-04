// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MemberPicker } from "@/components/molecules/MemberPicker";
import { OptionGrid } from "@/components/molecules/OptionGrid";

afterEach(cleanup);

const categories = [
  { id: 1, name: "Super", icon: "shopping-cart", color: "var(--accent-0)" },
  { id: 2, name: "Luz", icon: "lightbulb", color: "var(--accent-1)" },
];

describe("OptionGrid", () => {
  it("renders active options without an archived marker", () => {
    render(<OptionGrid options={categories} value={1} onChange={() => {}} ariaLabel="Categoría" />);

    expect(screen.getByRole("radio", { name: "Super" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Luz" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText("(en archivo)")).toBeNull();
  });

  it("renders an injected archived option marked (en archivo)", () => {
    render(
      <OptionGrid
        options={[...categories, { id: 9, name: "Vieja", icon: "tag", color: "var(--accent-2)", archived: true }]}
        value={9}
        onChange={() => {}}
        ariaLabel="Categoría"
      />,
    );

    expect(screen.getAllByText("(en archivo)")).toHaveLength(1);
  });

  it("submits the selected id through a hidden input and reports changes", () => {
    const onChange = vi.fn();
    const { container } = render(
      <OptionGrid options={categories} value={1} onChange={onChange} ariaLabel="Categoría" />,
    );

    expect(container.querySelector<HTMLInputElement>('input[name="categoryId"]')?.value).toBe("1");
    fireEvent.click(screen.getByRole("radio", { name: "Luz" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe("MemberPicker", () => {
  const members = [
    { id: 1, name: "Sofi" },
    { id: 2, name: "Mati" },
  ];

  it("renders active members with no archived marker", () => {
    render(<MemberPicker options={members} value={2} onChange={() => {}} ariaLabel="Quién" />);

    expect(screen.getByRole("radio", { name: "Mati" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByText("(en archivo)")).toBeNull();
  });

  it("renders an injected archived member marked (en archivo) and reports selection", () => {
    const onChange = vi.fn();
    render(
      <MemberPicker
        options={[...members, { id: 7, name: "Ex", archived: true }]}
        value={7}
        onChange={onChange}
        ariaLabel="Quién"
      />,
    );

    expect(screen.getAllByText("(en archivo)")).toHaveLength(1);
    fireEvent.click(screen.getByRole("radio", { name: "Sofi" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
