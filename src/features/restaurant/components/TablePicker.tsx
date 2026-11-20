import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, IconButton, Text } from "react-native-paper";

import { FloorCanvas } from "@/features/restaurant/components/FloorCanvas";
import { RestaurantPlaceholder } from "@/features/restaurant/components/RestaurantPlaceholder";
import { useFloorPlan, useTableStatus } from "@/features/restaurant/hooks/useFloorData";
import { useNow } from "@/features/restaurant/hooks/useNow";
import {
  legendStatuses,
  statusFor,
  TABLE_STATUS_LABEL,
  tableStatusLines,
  type TableStatusView,
} from "@/features/restaurant/logic/tableStatus";
import { STATUS_ICON, tableStatusColors } from "@/features/restaurant/theme";
import type { RestaurantTableDTO, TableStatusDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

const ZOOM_STEPS = [1, 1.5, 2, 3];

type TablePickerProps = {
  /** Shown above the floor, e.g. "Choose a table for Dine In". */
  prompt?: string;
  /** Tables to show as selected (joining or transferring a visit). */
  selected?: string[];
  onPick: (table: RestaurantTableDTO, row: TableStatusDTO | undefined) => void;
  onCancel?: () => void;
};

/** The service floor as a table picker: every active table with its live status. Read-only layout. */
export function TablePicker({ prompt, selected = [], onPick, onCancel }: TablePickerProps) {
  const { appearance, palette } = useAppearance();
  const floorPlan = useFloorPlan();
  const tableStatus = useTableStatus();
  const now = useNow();
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [view, setView] = useState<"plan" | "list">("plan");
  const floors = floorPlan.floors;
  const floor = floors.find((row) => row.name === selectedFloor) ?? floors[0] ?? null;
  const statuses = tableStatus.statuses;
  const legend = statuses && floor ? legendStatuses(floor.tables.map((table) => statusFor(statuses, table.name))) : [];

  function openTable(table: RestaurantTableDTO) {
    onPick(table, tableStatus.data?.find((entry) => entry.table === table.name));
  }

  if (!floorPlan.plan && floorPlan.isLoading) {
    return <RestaurantPlaceholder icon="floor-plan" title="Loading floor plan" description="Fetching floors and tables." />;
  }
  if (!floorPlan.plan) {
    return (
      <RestaurantPlaceholder icon="alert-circle-outline" title="Floor plan unavailable" description={floorPlan.error ?? undefined}>
        <Button mode="contained" onPress={() => void floorPlan.refresh()}>
          Try again
        </Button>
      </RestaurantPlaceholder>
    );
  }
  if (!floor) {
    return (
      <RestaurantPlaceholder
        icon="floor-plan"
        title="No floors yet"
        description={
          floorPlan.plan.can_edit
            ? "Lay out floors and tables in the web POS."
            : "Ask a restaurant manager to set up the floor plan."
        }
      />
    );
  }

  return (
    <View style={styles.root}>
      {prompt ? (
        <View style={[styles.prompt, { backgroundColor: palette.surface, borderBottomColor: palette.borderSubtle }]}>
          <Text style={[styles.promptText, { color: palette.onSurface }]}>{prompt}</Text>
          {onCancel ? (
            <Button compact mode="text" onPress={onCancel}>
              Done
            </Button>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.toolbar, { borderBottomColor: palette.borderSubtle }]}>
        <ScrollView contentContainerStyle={styles.chips} horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
          {floors.map((row) => {
            const active = row.name === floor.name;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={row.name}
                onPress={() => setSelectedFloor(row.name)}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: palette.primary, borderColor: palette.primary }
                    : { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? palette.onPrimary : palette.onSurface }]}>
                  {row.floor_name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <IconButton
          accessibilityLabel={view === "plan" ? "Show tables as a list" : "Show the floor plan"}
          icon={view === "plan" ? "format-list-bulleted" : "floor-plan"}
          onPress={() => setView(view === "plan" ? "list" : "plan")}
          size={20}
        />
      </View>
      <View style={styles.statusRow}>
        <View style={styles.legend}>
          {legend.map((kind) => {
            const colors = tableStatusColors(kind, appearance === "dark");
            return (
              <View key={kind} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.stroke }]}>
                  <MaterialCommunityIcons color={palette.surface} name={STATUS_ICON[kind]} size={9} />
                </View>
                <Text style={[styles.legendText, { color: palette.onSurfaceMuted }]}>{TABLE_STATUS_LABEL[kind]}</Text>
              </View>
            );
          })}
        </View>
        {tableStatus.error ? (
          <Text style={[styles.legendText, { color: palette.error }]}>Status not refreshed. Retrying.</Text>
        ) : null}
        {view === "plan" ? (
          <View style={styles.zoom}>
            <IconButton
              accessibilityLabel="Zoom out"
              disabled={zoomIndex === 0}
              icon="magnify-minus-outline"
              onPress={() => setZoomIndex((index) => Math.max(0, index - 1))}
              size={18}
            />
            <IconButton
              accessibilityLabel="Zoom in"
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              icon="magnify-plus-outline"
              onPress={() => setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))}
              size={18}
            />
          </View>
        ) : null}
      </View>
      {view === "plan" ? (
        <View style={styles.canvas}>
          <FloorCanvas
            canvas={floorPlan.plan.canvas}
            floor={floor}
            now={now}
            onTablePress={openTable}
            selected={selected}
            statuses={statuses}
            zoom={ZOOM_STEPS[zoomIndex]}
          />
        </View>
      ) : (
        <FlashList
          contentContainerStyle={styles.list}
          extraData={[statuses, selected, now]}
          ItemSeparatorComponent={Separator}
          data={[...floor.tables].sort((a, b) => a.table_label.localeCompare(b.table_label, undefined, { numeric: true }))}
          keyExtractor={(table) => table.name}
          renderItem={({ item }) => (
            <TableRow
              now={now}
              onPress={() => openTable(item)}
              selected={selected.includes(item.name)}
              status={statuses ? statusFor(statuses, item.name) : null}
              table={item}
            />
          )}
        />
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function TableRow({
  table,
  status,
  now,
  selected,
  onPress,
}: {
  table: RestaurantTableDTO;
  status: TableStatusView | null;
  now: Date;
  selected: boolean;
  onPress: () => void;
}) {
  const { appearance, palette } = useAppearance();
  const colors = status ? tableStatusColors(status.kind, appearance === "dark") : null;
  const lines = status ? tableStatusLines(status, table.seats, now) : [`${table.seats} seats`];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors?.fill ?? palette.surface, borderColor: colors?.stroke ?? palette.border }]}
    >
      <Text style={[styles.rowLabel, { color: palette.onSurface }]}>{table.table_label}</Text>
      <View style={styles.rowLines}>
        {lines.map((line, index) => (
          <Text key={index} style={[styles.legendText, { color: index ? palette.onSurfaceMuted : palette.onSurface }]}>
            {line}
          </Text>
        ))}
      </View>
      <MaterialCommunityIcons
        color={selected ? palette.primary : palette.onSurfaceMuted}
        name={selected ? "check-circle" : "chevron-right"}
        size={20}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  chip: { borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: spacing.md },
  chipText: { fontFamily: typography.fontFamily.medium, fontSize: typography.size.small },
  chipScroller: { flex: 1 },
  chips: { alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  legend: { alignItems: "center", flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  legendDot: { alignItems: "center", borderRadius: 8, height: 16, justifyContent: "center", width: 16 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 4 },
  legendText: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  list: { padding: spacing.md },
  separator: { height: spacing.xs },
  prompt: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  promptText: { flex: 1, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  root: { flex: 1 },
  row: { alignItems: "center", borderRadius: radii.md, borderWidth: 1.5, flexDirection: "row", gap: spacing.md, padding: spacing.sm },
  rowLabel: { fontFamily: typography.fontFamily.semibold, fontSize: 18, minWidth: 44 },
  rowLines: { flex: 1, gap: 2 },
  statusRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs, minHeight: 40, paddingLeft: spacing.md },
  toolbar: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  zoom: { flexDirection: "row" },
});
