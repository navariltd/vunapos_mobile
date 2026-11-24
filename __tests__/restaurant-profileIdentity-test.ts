import { profileIdentity } from "@/features/restaurant/logic/profileIdentity";

describe("profileIdentity", () => {
  it("reads a dotted email as a name with first and last initials", () => {
    expect(profileIdentity("jane.wanjiru@cafe.co.ke")).toEqual({ name: "Jane Wanjiru", initials: "JW" });
  });

  it("drops trailing digits from demo-style ids", () => {
    expect(profileIdentity("wl.waiter2@javademo.local")).toEqual({ name: "Wl Waiter", initials: "WW" });
  });

  it("uses the first two letters of a single word", () => {
    expect(profileIdentity("Administrator")).toEqual({ name: "Administrator", initials: "AD" });
  });

  it("falls back while the user is still loading", () => {
    expect(profileIdentity(null)).toEqual({ name: "Signed in", initials: "?" });
  });
});
