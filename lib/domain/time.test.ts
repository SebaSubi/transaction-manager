import { afterEach, describe, expect, it, vi } from "vitest";

import {
  nowInBuenosAires,
  parseDateTimeLocal,
  toDateTimeLocalValue,
  wallClockFromParts,
} from "@/lib/domain/time";

afterEach(() => {
  vi.useRealTimers();
});

describe("nowInBuenosAires", () => {
  it("does not record tomorrow's date for a 21:00 Buenos Aires action", () => {
    vi.useFakeTimers();
    // 2026-08-15T00:00Z is 21:00 on 2026-08-14 in Buenos Aires.
    vi.setSystemTime(new Date("2026-08-15T00:00:00.000Z"));

    const now = nowInBuenosAires();

    expect(now.toISOString().slice(0, 10)).toBe("2026-08-14");
    expect(now.getUTCHours()).toBe(21);
  });

  it("applies a constant UTC-3 offset with no daylight-saving adjustment", () => {
    // January (southern summer) and July (southern winter) must agree.
    for (const instant of ["2026-01-15T12:00:00.000Z", "2026-07-15T12:00:00.000Z"]) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(instant));

      const offsetMs = new Date(instant).getTime() - nowInBuenosAires().getTime();

      expect(offsetMs).toBe(3 * 60 * 60 * 1000);
      vi.useRealTimers();
    }
  });
});

describe("wallClockFromParts", () => {
  it("treats month as 1-based and stores the parts as UTC components", () => {
    const date = wallClockFromParts(2026, 8, 14, 21, 30);
    expect(date.toISOString()).toBe("2026-08-14T21:30:00.000Z");
  });

  it("builds January from month = 1", () => {
    expect(wallClockFromParts(2026, 1, 1, 0, 0).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
});

describe("toDateTimeLocalValue", () => {
  it("renders the Buenos Aires wall clock without shifting it", () => {
    vi.useFakeTimers();
    // 2026-08-15T00:00Z is 21:00 on 2026-08-14 in Buenos Aires.
    vi.setSystemTime(new Date("2026-08-15T00:00:00.000Z"));

    expect(toDateTimeLocalValue(nowInBuenosAires())).toBe("2026-08-14T21:00");
  });

  it("zero-pads every component", () => {
    expect(toDateTimeLocalValue(wallClockFromParts(2026, 1, 5, 7, 3))).toBe(
      "2026-01-05T07:03",
    );
  });
});

describe("parseDateTimeLocal", () => {
  it("parses a valid value into a wall-clock Date", () => {
    expect(parseDateTimeLocal("2026-08-14T21:00")?.toISOString()).toBe(
      "2026-08-14T21:00:00.000Z",
    );
  });

  it("stores the entered wall clock unchanged under TZ=UTC", () => {
    const parsed = parseDateTimeLocal("2026-03-01T00:30");
    expect(parsed?.getUTCHours()).toBe(0);
    expect(parsed?.getUTCMinutes()).toBe(30);
  });

  it("drops optional seconds", () => {
    expect(parseDateTimeLocal("2026-08-14T21:00:45")?.toISOString()).toBe(
      "2026-08-14T21:00:00.000Z",
    );
  });

  it.each([
    "2026-02-30T10:00",
    "2026-13-01T10:00",
    "2026-08-14T24:00",
    "2026-08-14T10:60",
    "",
    "garbage",
    "2026-08-14",
    "2026-08-14 10:00",
  ])("rejects %j", (value) => {
    expect(parseDateTimeLocal(value)).toBeNull();
  });
});
