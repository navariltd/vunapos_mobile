import { describeModifiers, modifierSelectionError, toggleModifier } from "@/features/restaurant/logic/modifierSelections";
import type { ModifierGroupDTO } from "@/features/restaurant/types";

const groups: ModifierGroupDTO[] = [
  {
    name: "spice",
    label: "Spice",
    min_selections: 1,
    max_selections: 1,
    options: [
      { name: "mild", label: "Mild", addon_qty: 0, rate: 0, available: true },
      { name: "hot", label: "Hot", addon_qty: 0, rate: 0, available: true },
    ],
  },
  {
    name: "extras",
    label: "Extras",
    min_selections: 0,
    max_selections: 2,
    options: [
      { name: "cheese", label: "Cheese", addon_item: "CHEESE", addon_qty: 1, rate: 100, available: true },
      { name: "egg", label: "Egg", addon_item: "EGG", addon_qty: 2, rate: 30, available: true },
      { name: "bacon", label: "Bacon", addon_item: "BACON", addon_qty: 1, rate: 150, available: true },
      { name: "truffle", label: "Truffle", addon_item: "TRUFFLE", addon_qty: 1, rate: 900, available: false },
    ],
  },
];

describe("modifier choices", () => {
  it("swaps the choice in a single-choice group", () => {
    let selected = toggleModifier(groups, [], "spice", "mild");
    selected = toggleModifier(groups, selected, "spice", "hot");
    expect(selected).toEqual([{ group: "spice", option: "hot" }]);
  });

  it("caps a multi-choice group at its maximum and ignores unavailable options", () => {
    let selected = toggleModifier(groups, [], "extras", "cheese");
    selected = toggleModifier(groups, selected, "extras", "egg");
    selected = toggleModifier(groups, selected, "extras", "bacon");
    selected = toggleModifier(groups, selected, "extras", "truffle");
    expect(selected.map((choice) => choice.option)).toEqual(["cheese", "egg"]);
    expect(toggleModifier(groups, selected, "extras", "cheese").map((choice) => choice.option)).toEqual(["egg"]);
  });

  it("requires the minimum and prices add-ons per unit", () => {
    expect(modifierSelectionError(groups, [])).toBe("Choose 1 for Spice.");
    const selected = [
      { group: "spice", option: "mild" },
      { group: "extras", option: "egg" },
    ];
    expect(modifierSelectionError(groups, selected)).toBeNull();
    expect(describeModifiers(groups, selected)).toEqual([
      { group: "spice", option: "mild", label: "Spice: Mild", extra_rate: 0 },
      { group: "extras", option: "egg", label: "Extras: Egg", extra_rate: 60 },
    ]);
  });
});
