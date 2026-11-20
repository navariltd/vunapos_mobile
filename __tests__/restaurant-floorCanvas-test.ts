import { fittingLines } from "@/features/restaurant/components/FloorCanvas";

describe("table text fitting", () => {
  it("shows status lines only while they fit the table's height and width", () => {
    const lines = ["Free", "4 seats"];
    expect(fittingLines(lines, { width: 90, height: 90 }, 18, 12)).toBe(2);
    expect(fittingLines(lines, { width: 90, height: 40 }, 14, 11)).toBe(1);
    expect(fittingLines(lines, { width: 30, height: 90 }, 12, 12)).toBe(0);
  });

  it("stops at the first line that would be cut, so text never truncates", () => {
    expect(fittingLines(["Occupied · 12 min", "2 guests"], { width: 50, height: 90 }, 14, 10)).toBe(0);
  });
});
