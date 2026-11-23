import { describe, expect, it } from "vitest";

import {
  formatArs,
  formatCentsInput,
  formatPercent,
  formatPesoInput,
  normalizePesoInput,
  formatShortDate,
  formatSignedArs,
} from "@/lib/domain/format";

describe("formatArs", () => {
  it.each([
    [0, "$0"],
    [99900, "$999"],
    [100000, "$1.000"],
    [123456700, "$1.234.567"],
    [-500000, "-$5.000"],
    [1989800, "$19.898"],
    [1989850, "$19.898,50"],
    [1989805, "$19.898,05"],
    [50, "$0,50"],
    [5, "$0,05"],
    [-1050, "-$10,50"],
  ])("%i cents -> %s", (amount, expected) => {
    expect(formatArs(amount)).toBe(expected);
  });
});

describe("formatSignedArs", () => {
  it("prefixes an expense with a minus", () => {
    expect(formatSignedArs("expense", 3100000)).toBe("-$31.000");
  });

  it("prefixes an income with a plus", () => {
    expect(formatSignedArs("income", 5000050)).toBe("+$50.000,50");
  });
});

describe("formatShortDate", () => {
  it("renders the wall clock without shifting it", () => {
    expect(formatShortDate(new Date("2026-08-14T21:00:00.000Z"))).toBe("14 ago · 21:00");
  });

  it("does not zero-pad the day and pads the time", () => {
    expect(formatShortDate(new Date("2026-01-05T07:03:00.000Z"))).toBe("5 ene · 07:03");
  });
});

describe("formatPercent", () => {
  it.each([
    [700, "7"],
    [750, "7,5"],
    [725, "7,25"],
    [0, "0"],
    [10000, "100"],
    [29, "0,29"],
    [115, "1,15"],
  ])("%i bps -> %s", (bps, expected) => {
    expect(formatPercent(bps)).toBe(expected);
  });
});

describe("formatPesoInput", () => {
  it.each([
    ["", ""],
    ["5", "5"],
    ["500", "500"],
    ["1500", "1.500"],
    ["12000000", "12.000.000"],
  ])("%j -> %j", (raw, expected) => {
    expect(formatPesoInput(raw)).toBe(expected);
  });
});

describe("normalizePesoInput", () => {
  it.each([
    ["12000000", "12.000.000"],
    ["12.000.0000", "120.000.000"],
    ["1.500", "1.500"],
    ["1.50", "1,50"],
    ["1500.5", "1.500,5"],
    ["1500.", "1.500,"],
    ["1.500.", "1.500"],
    ["1500,50", "1.500,50"],
    ["1.500,5", "1.500,5"],
    [",5", "0,5"],
    ["0,", "0,"],
    ["", ""],
  ])("regroups %j -> %j", (raw, expected) => {
    expect(normalizePesoInput(raw)).toBe(expected);
  });

  it.each(["abc", "12abc", "-5", "1 500", ".", "1,234", "1,5,5", "1,5.5"])(
    "leaves %j unchanged so server validation shows",
    (raw) => {
      expect(normalizePesoInput(raw)).toBe(raw);
    },
  );
});

describe("formatCentsInput", () => {
  it.each([
    [150000, "1.500"],
    [150050, "1.500,50"],
    [5, "0,05"],
  ])("%i cents -> %s", (cents, expected) => {
    expect(formatCentsInput(cents)).toBe(expected);
  });
});
