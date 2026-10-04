import { describe, expect, it } from "vitest";

import {
  isMonthKey,
  monthKeyLabel,
  monthKeyOf,
  monthAbbrev,
  monthNameOf,
  monthRange,
  nextMonthKey,
  prevMonthKey,
} from "@/lib/domain/month";

describe("isMonthKey", () => {
  it.each(["2026-01", "2026-08", "2026-12", "1999-10"])("accepts %s", (value) => {
    expect(isMonthKey(value)).toBe(true);
  });

  it.each(["2026-00", "2026-13", "2026-8", "26-08", "2026-08-01", "", "agosto"])(
    "rejects %s",
    (value) => {
      expect(isMonthKey(value)).toBe(false);
    },
  );
});

describe("monthKeyOf", () => {
  it("reads the UTC components of a wall-clock Date", () => {
    expect(monthKeyOf(new Date(Date.UTC(2026, 7, 14, 21, 0)))).toBe("2026-08");
  });

  it("does not roll into the next month at the last instant", () => {
    expect(monthKeyOf(new Date(Date.UTC(2026, 7, 31, 23, 59, 59)))).toBe("2026-08");
  });
});

describe("monthKeyLabel", () => {
  it("formats the Spanish label", () => {
    expect(monthKeyLabel("2026-08")).toBe("Agosto 2026");
  });

  it.each([
    ["2026-01", "Enero 2026"],
    ["2026-12", "Diciembre 2026"],
  ])("formats %s as %s", (key, expected) => {
    expect(monthKeyLabel(key)).toBe(expected);
  });
});

describe("prevMonthKey", () => {
  it("rolls over the year boundary", () => {
    expect(prevMonthKey("2026-01")).toBe("2025-12");
  });

  it("steps back within the same year", () => {
    expect(prevMonthKey("2026-08")).toBe("2026-07");
  });
});

describe("monthRange", () => {
  it("returns a half-open range for the requested month", () => {
    const range = monthRange("2026-08");
    expect(range.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("excludes a transaction dated exactly at endExclusive", () => {
    const { start, endExclusive } = monthRange("2026-08");
    const boundary = new Date("2026-09-01T00:00:00.000Z");
    expect(boundary >= start && boundary < endExclusive).toBe(false);
  });

  it("is half-open across February, whose length is not 30 or 31", () => {
    const range = monthRange("2026-02");
    expect(range.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("is half-open across December, rolling into the next year", () => {
    const range = monthRange("2026-12");
    expect(range.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("invalid month keys", () => {
  it.each([
    ["monthKeyLabel", () => monthKeyLabel("2026-13")],
    ["prevMonthKey", () => prevMonthKey("nope")],
    ["monthRange", () => monthRange("2026-8")],
    ["monthKeyOf", () => monthKeyOf(new Date("not-a-date"))],
  ])("%s throws RangeError", (_label, call) => {
    expect(call).toThrow(RangeError);
  });
});

describe("nextMonthKey", () => {
  it.each([
    ["2026-12", "2027-01"],
    ["2026-08", "2026-09"],
    ["2026-01", "2026-02"],
  ])("%s -> %s", (key, expected) => {
    expect(nextMonthKey(key)).toBe(expected);
  });

  it("is symmetric with prevMonthKey", () => {
    for (const key of ["2026-01", "2026-08", "2026-12"]) {
      expect(prevMonthKey(nextMonthKey(key))).toBe(key);
      expect(nextMonthKey(prevMonthKey(key))).toBe(key);
    }
  });

  it("throws RangeError on an invalid key", () => {
    expect(() => nextMonthKey("2026-13")).toThrow(RangeError);
  });
});

describe("monthAbbrev", () => {
  it.each([
    [1, "ene"],
    [8, "ago"],
    [12, "dic"],
  ])("%i -> %s", (month, expected) => {
    expect(monthAbbrev(month)).toBe(expected);
  });
});

describe("monthNameOf", () => {
  it.each([
    ["2026-01", "Enero"],
    ["2026-10", "Octubre"],
    ["2026-12", "Diciembre"],
  ] as const)("names %s as %s", (key, name) => {
    expect(monthNameOf(key)).toBe(name);
  });

  it("throws on an invalid key", () => {
    expect(() => monthNameOf("2026-13")).toThrow(RangeError);
  });
});
