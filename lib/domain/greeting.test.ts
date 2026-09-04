import { describe, expect, it } from "vitest";

import { greeting } from "@/lib/domain/greeting";

function atHour(hour: number): Date {
  return new Date(Date.UTC(2026, 7, 14, hour, 0));
}

describe("greeting", () => {
  it.each([
    [0, "Buenos días"],
    [9, "Buenos días"],
    [11, "Buenos días"],
    [12, "Buenas tardes"],
    [18, "Buenas tardes"],
    [19, "Buenas noches"],
    [23, "Buenas noches"],
  ])("returns the right greeting at hour %s", (hour, expected) => {
    expect(greeting(atHour(hour))).toBe(expected);
  });
});
