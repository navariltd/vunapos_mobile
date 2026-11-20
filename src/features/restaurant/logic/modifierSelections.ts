import type { ModifierGroupDTO } from "@/features/restaurant/types";

export function modifierSelectionError(
  groups: ModifierGroupDTO[],
  selected: { group: string; option: string }[]
): string | null {
  if (
    selected.some(
      (choice) => !groups.some((group) => group.name === choice.group)
    )
  )
    return "Review unavailable modifier groups.";
  if (
    new Set(selected.map((choice) => `${choice.group}:${choice.option}`))
      .size !== selected.length
  )
    return "A choice cannot be selected twice.";
  for (const group of groups) {
    const choices = selected.filter((choice) => choice.group === group.name);
    if (
      choices.some(
        (choice) =>
          !group.options.some(
            (option) => option.name === choice.option && option.available
          )
      )
    )
      return `Review unavailable choices in ${group.label}.`;
    if (
      choices.length < group.min_selections ||
      choices.length > group.max_selections
    )
      return `Choose ${
        group.min_selections === group.max_selections
          ? group.min_selections
          : `${group.min_selections}–${group.max_selections}`
      } for ${group.label}.`;
  }
  return null;
}

type Choice = { group: string; option: string };

/**
 * Tap an option: a single-choice group swaps its choice, a multi-choice group
 * adds it until its maximum, and tapping a chosen option removes it.
 */
export function toggleModifier(groups: ModifierGroupDTO[], selected: Choice[], group: string, option: string): Choice[] {
  const definition = groups.find((row) => row.name === group);
  if (!definition) return selected;
  const chosen = selected.some((choice) => choice.group === group && choice.option === option);
  if (chosen) return selected.filter((choice) => !(choice.group === group && choice.option === option));
  const available = definition.options.some((row) => row.name === option && row.available);
  if (!available) return selected;
  if (definition.max_selections === 1) {
    return [...selected.filter((choice) => choice.group !== group), { group, option }];
  }
  const inGroup = selected.filter((choice) => choice.group === group).length;
  return inGroup >= definition.max_selections ? selected : [...selected, { group, option }];
}

/** The chosen options with their labels and the extra each adds to one unit. */
export function describeModifiers(groups: ModifierGroupDTO[], selected: Choice[]) {
  return groups.flatMap((group) =>
    group.options
      .filter((option) => selected.some((choice) => choice.group === group.name && choice.option === option.name))
      .map((option) => ({
        group: group.name,
        option: option.name,
        label: `${group.label}: ${option.label}`,
        extra_rate: option.addon_item ? option.rate * option.addon_qty : 0,
      })),
  );
}
