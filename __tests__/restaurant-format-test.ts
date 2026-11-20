import { formatMoney, hasOffer, itemImageUrl } from "@/features/restaurant/format";

describe("restaurant formatting", () => {
  it("formats money with the currency code", () => {
    expect(formatMoney(1200, "KES")).toMatch(/KES\s?1,200\.00/);
    expect(formatMoney(undefined, "KES", 0)).toMatch(/KES\s?0/);
  });

  it("resolves site-relative images and keeps absolute ones", () => {
    expect(itemImageUrl("/files/burger.jpg", "https://site.example.com/")).toBe("https://site.example.com/files/burger.jpg");
    expect(itemImageUrl("https://cdn.example.com/a.png", "https://site.example.com")).toBe("https://cdn.example.com/a.png");
    expect(itemImageUrl("", "https://site.example.com")).toBeNull();
  });

  it("detects an offer only below the list price", () => {
    expect(hasOffer({ rate: 2805, price_list_rate: 3300 })).toBe(true);
    expect(hasOffer({ rate: 3300, price_list_rate: 3300 })).toBe(false);
    expect(hasOffer({ rate: 100 })).toBe(false);
  });
});
