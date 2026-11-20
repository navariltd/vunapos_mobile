import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, RadioButton, Text } from "react-native-paper";

import { Sheet } from "@/features/restaurant/components/Sheet";
import { kitchenRoutingComplete } from "@/features/restaurant/logic/kitchenRouting";
import type { KitchenRoutingIssue } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { spacing, typography } from "@/theme/tokens";

const REASON: Record<KitchenRoutingIssue["items"][number]["reason"], string> = {
  missing: "No matching station",
  ambiguous: "Several stations match",
  invalid: "Previous station unavailable",
};

/** Items the server could not route: pick a station for each, for this round only. */
export function KitchenRoutingSheet({
  issue,
  initial = {},
  onConfirm,
  onClose,
}: {
  issue: KitchenRoutingIssue;
  initial?: Record<string, string>;
  onConfirm: (selections: Record<string, string>) => void;
  onClose: () => void;
}) {
  const { palette } = useAppearance();
  const [selections, setSelections] = useState(initial);
  return (
    <Sheet
      description="Choose where to prepare these items. This applies to this round only and does not change the station setup."
      footer={
        <>
          <Button onPress={onClose}>Back</Button>
          <Button
            disabled={!issue.stations.length || !kitchenRoutingComplete(issue, selections)}
            mode="contained"
            onPress={() => onConfirm(selections)}
          >
            Use stations
          </Button>
        </>
      }
      onClose={onClose}
      title="Choose kitchen stations"
      visible
    >
      {!issue.stations.length ? (
        <Text style={{ color: palette.error }}>
          No enabled stations are available to you. Ask a manager to set up Kitchen Stations for this restaurant.
        </Text>
      ) : (
        issue.items.map((item) => {
          const stations = item.candidates.length
            ? issue.stations.filter((station) => item.candidates.includes(station.name))
            : issue.stations;
          return (
            <View key={item.item_code} style={[styles.item, { borderColor: palette.border, backgroundColor: palette.surface }]}>
              <Text style={[styles.code, { color: palette.onSurface }]}>{item.item_code}</Text>
              <Text style={[styles.reason, { color: palette.onSurfaceMuted }]}>
                {item.item_group} · {REASON[item.reason]}
              </Text>
              <RadioButton.Group
                onValueChange={(value) => setSelections((current) => ({ ...current, [item.item_code]: value }))}
                value={selections[item.item_code] ?? ""}
              >
                {(stations.length ? stations : issue.stations).map((station) => (
                  <RadioButton.Item key={station.name} label={station.station_name} mode="android" value={station.name} />
                ))}
              </RadioButton.Group>
            </View>
          );
        })
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  code: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  item: { borderRadius: 12, borderWidth: 1 },
  reason: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small, paddingHorizontal: spacing.sm },
});
