import { describe, expect, it } from "vitest";

import {
  formatArs,
  formatPercent,
  formatPesoInput,
  normalizePesoInput,
  formatShortDate,
  formatSignedArs,
} from "@/lib/domain/format";

describe("formatArs", () => {
  it.each([
    [0, "$0"],
    [999, "$999"],
    [1000, "$1.000"],
    [1234567, "$1.234.567"],
    [-5000, "-$5.000"],
  ])("%i -> %s", (amount, expected) => {
    expect(formatArs(amount)).toBe(expected);
  });
});

describe("formatSignedArs", () => {
  it("prefixes an expense with a minus", () => {
    expect(formatSignedArs("expense", 31000)).toBe("-$31.000");
  });

  it("prefixes an income with a plus", () => {
    expect(formatSignedArs("income", 50000)).toBe("+$50.000");
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
    ["1.50", "150"],
    ["", ""],
  ])("regroups %j -> %j", (raw, expected) => {
    expect(normalizePesoInput(raw)).toBe(expected);
  });

  it.each(["1500,50", "33,5", "abc", "12abc", "-5", "1 500", "."])(
    "leaves %j unchanged so server validation shows",
    (raw) => {
      expect(normalizePesoInput(raw)).toBe(raw);
    },
  );
});
