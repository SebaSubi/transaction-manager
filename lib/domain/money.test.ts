import { describe, expect, it } from "vitest";

import { bpsToPercent, computeNetAmount, percentToBps } from "@/lib/domain/money";

describe("computeNetAmount", () => {
  it("reduces an expense below gross by the cashback rate, rounding once", () => {
    // 33333 * 0.93 = 30999.69 -> 31000
    expect(
      computeNetAmount({ type: "expense", gross: 33333, cashbackBps: percentToBps(7) }),
    ).toBe(31000);
  });

  it("caps the result at zero and never returns a negative number", () => {
    // 150% clamps to 10000 bps at the percent boundary, so net is exactly 0.
    expect(
      computeNetAmount({ type: "expense", gross: 1000, cashbackBps: percentToBps(150) }),
    ).toBe(0);
  });

  it("ignores cashback entirely for income", () => {
    expect(
      computeNetAmount({ type: "income", gross: 50000, cashbackBps: percentToBps(10) }),
    ).toBe(50000);
  });

  it("rounds the fractional intermediate exactly once", () => {
    // 100 * 0.67 = 67.0 exactly; the result is an integer, never re-rounded.
    const net = computeNetAmount({
      type: "expense",
      gross: 100,
      cashbackBps: percentToBps(33),
    });
    expect(net).toBe(67);
    expect(Number.isInteger(net)).toBe(true);
  });

  it("returns gross unchanged when the cashback rate is zero", () => {
    expect(computeNetAmount({ type: "expense", gross: 1234, cashbackBps: 0 })).toBe(1234);
  });

  it.each([
    ["negative gross", { type: "expense" as const, gross: -1, cashbackBps: 0 }],
    ["fractional gross", { type: "expense" as const, gross: 10.5, cashbackBps: 0 }],
    ["bps above 10000", { type: "expense" as const, gross: 100, cashbackBps: 10001 }],
    ["negative bps", { type: "expense" as const, gross: 100, cashbackBps: -1 }],
    ["fractional bps", { type: "expense" as const, gross: 100, cashbackBps: 12.5 }],
  ])("throws RangeError on %s", (_label, input) => {
    expect(() => computeNetAmount(input)).toThrow(RangeError);
  });
});

describe("percentToBps", () => {
  it.each([
    [7, 700],
    [7.5, 750],
    [0, 0],
    [100, 10000],
  ])("converts %s%% to %s bps", (percent, expected) => {
    expect(percentToBps(percent)).toBe(expected);
  });

  it("clamps out-of-range percents into 0..10000", () => {
    expect(percentToBps(150)).toBe(10000);
    expect(percentToBps(-5)).toBe(0);
  });

  it("rounds to the nearest basis point", () => {
    expect(percentToBps(7.126)).toBe(713);
  });
});

describe("bpsToPercent", () => {
  it("round-trips a whole-percent rate", () => {
    expect(bpsToPercent(percentToBps(7.5))).toBe(7.5);
  });

  it("converts basis points back to percent", () => {
    expect(bpsToPercent(10000)).toBe(100);
    expect(bpsToPercent(0)).toBe(0);
  });
});
