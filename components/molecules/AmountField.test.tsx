// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AmountField } from "@/components/molecules/AmountField";

afterEach(cleanup);

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <AmountField value={value} onChange={setValue} />;
}

function input() {
  return screen.getByLabelText("Monto") as HTMLInputElement;
}

describe("AmountField", () => {
  it("groups digits with thousands dots as the user types", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "12000000" } });
    expect(input().value).toBe("12.000.000");
  });

  it("shows a saved raw value grouped", () => {
    render(<Harness initial="33333" />);
    expect(input().value).toBe("33.333");
  });

  it("leaves a value with a comma as typed", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "1500,50" } });
    expect(input().value).toBe("1500,50");
  });
});
