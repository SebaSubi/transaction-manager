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

  it("keeps a comma decimal part and groups the integer part", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "1500,50" } });
    expect(input().value).toBe("1.500,50");
  });

  it("reads an unambiguous dot as the decimal separator", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "1500.5" } });
    expect(input().value).toBe("1.500,5");
  });

  it("leaves a third decimal as typed so validation shows", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "1,505" } });
    expect(input().value).toBe("1,505");
  });

  it("asks iOS for the decimal keyboard", () => {
    render(<Harness />);
    expect(input().inputMode).toBe("decimal");
  });
});
