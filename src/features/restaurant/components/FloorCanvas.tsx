import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import {
  statusFor,
  tableAccessibleName,
  tableStatusBadge,
  tableStatusLines,
  type TableStatusView,
} from "@/features/restaurant/logic/tableStatus";
import { STATUS_ICON, tableStatusColors } from "@/features/restaurant/theme";
import type { FloorElementDTO, RestaurantFloorDTO, RestaurantTableDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { typography } from "@/theme/tokens";

type FloorCanvasProps = {
  floor: RestaurantFloorDTO;
  canvas: { width: number; height: number };
  /** Null until the first status response: tables stay neutral rather than "Free". */
  statuses: Map<string, TableStatusView> | null;
  now: Date;
  zoom: number;
  selected?: string[];
  onTablePress: (table: RestaurantTableDTO) => void;
};

/** The floor layout scaled to the screen width; zooming in makes it scroll both ways. */
export function FloorCanvas({ floor, canvas, statuses, now, zoom, selected = [], onTablePress }: FloorCanvasProps) {
  const { palette } = useAppearance();
  const [viewportWidth, setViewportWidth] = useState(0);
  const scale = viewportWidth ? (viewportWidth * zoom) / canvas.width : 0;
  const width = canvas.width * scale;
  const height = canvas.height * scale;

  return (
    <View onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)} style={styles.viewport}>
      {scale ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={zoom > 1}>
          <ScrollView horizontal scrollEnabled={zoom > 1} showsHorizontalScrollIndicator={zoom > 1}>
            <View
              accessibilityLabel={`${floor.floor_name} floor plan`}
              style={{
                backgroundColor: floor.background_color || palette.surfaceContainer,
                borderColor: palette.borderSubtle,
                borderRadius: 8,
                borderWidth: 1,
                height,
                width,
              }}
            >
              {floor.elements.map((element, index) => (
                <FloorElement element={element} key={element.name ?? `element-${index}`} scale={scale} />
              ))}
              {floor.tables.map((table) => (
                <TableShape
                  key={table.name}
                  now={now}
                  onPress={() => onTablePress(table)}
                  scale={scale}
                  selected={selected.includes(table.name)}
                  status={statuses ? statusFor(statuses, table.name) : null}
                  table={table}
                />
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      ) : null}
    </View>
  );
}

function box(item: { x: number; y: number; width: number; height: number }, scale: number) {
  return { left: item.x * scale, top: item.y * scale, width: item.width * scale, height: item.height * scale };
}

// Average glyph width of Inter relative to its font size, for a quick fit estimate.
const GLYPH_RATIO = 0.56;

/** How many leading status lines fit under the label without truncation; the rest become a badge. */
export function fittingLines(
  lines: string[],
  frame: { width: number; height: number },
  labelSize: number,
  lineSize: number,
) {
  const byHeight = Math.floor((frame.height - labelSize - 6) / (lineSize + 3));
  let shown = 0;
  while (
    shown < lines.length &&
    shown < byHeight &&
    lines[shown].length * lineSize * GLYPH_RATIO <= frame.width - 8
  ) {
    shown += 1;
  }
  return shown;
}

function FloorElement({ element, scale }: { element: FloorElementDTO; scale: number }) {
  const { palette } = useAppearance();
  const fallback: Record<string, string> = {
    Wall: palette.onSurfaceMuted,
    Door: palette.border,
    Window: "#9cc7e8",
    "Bar Counter": "#8d6e63",
    Plant: "#5aa469",
    Label: "transparent",
  };
  const isLabel = element.element_type === "Label";
  return (
    <View
      pointerEvents="none"
      style={[
        styles.absolute,
        box(element, scale),
        {
          backgroundColor: isLabel ? "transparent" : element.color || fallback[element.element_type],
          borderRadius: element.element_type === "Plant" ? 999 : 2,
          transform: [{ rotate: `${element.rotation || 0}deg` }],
        },
      ]}
    >
      {element.label ? (
        <Text numberOfLines={1} style={[styles.elementLabel, { color: isLabel ? palette.onSurfaceMuted : "#fff" }]}>
          {element.label}
        </Text>
      ) : null}
    </View>
  );
}

function TableShape({
  table,
  status,
  scale,
  now,
  selected,
  onPress,
}: {
  table: RestaurantTableDTO;
  status: TableStatusView | null;
  scale: number;
  now: Date;
  selected: boolean;
  onPress: () => void;
}) {
  const { appearance, palette } = useAppearance();
  const frame = box(table, scale);
  const colors = status ? tableStatusColors(status.kind, appearance === "dark") : null;
  const round = table.shape === "Round" || table.shape === "Oval";
  const short = Math.min(frame.width, frame.height);
  const labelSize = Math.max(10, Math.min(18, short * 0.32));
  const lineSize = Math.max(9, Math.min(12, short * 0.16));
  const lines = status ? tableStatusLines(status, table.seats, now) : [`${table.seats} seats`];
  const shown = fittingLines(lines, frame, labelSize, lineSize);
  // The badge stands in for the status word only when that word does not fit,
  // so status never rests on colour alone and the badge never covers text.
  const badge = status && shown === 0 ? tableStatusBadge(status, lines, shown) : null;
  const label = status
    ? tableAccessibleName(table.table_label, table.seats, status, now)
    : `Table ${table.table_label}, ${table.seats} seats`;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.absolute, frame, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors?.fill ?? palette.surface,
            borderColor: selected ? palette.primary : colors?.stroke ?? palette.border,
            borderRadius: round ? Math.max(frame.width, frame.height) : Math.min(8, short / 4),
            borderStyle: colors?.dashed && !selected ? "dashed" : "solid",
            borderWidth: selected ? 3.5 : 2,
            transform: [{ rotate: `${table.rotation || 0}deg` }],
          },
        ]}
      />
      {/* Text stays upright whatever the table's rotation. */}
      <View pointerEvents="none" style={styles.tableText}>
        <Text numberOfLines={1} style={[styles.tableLabel, { color: palette.onSurface, fontSize: labelSize }]}>
          {table.table_label}
        </Text>
        {lines.slice(0, shown).map((line, index) => (
          <Text
            key={index}
            numberOfLines={1}
            style={{
              color: index === 0 && status ? palette.onSurface : palette.onSurfaceMuted,
              fontFamily: index === 0 && status ? typography.fontFamily.semibold : typography.fontFamily.regular,
              fontSize: lineSize,
            }}
          >
            {line}
          </Text>
        ))}
      </View>
      {badge && colors ? (
        <View style={[styles.badge, { backgroundColor: colors.stroke, borderColor: palette.surface }]}>
          <MaterialCommunityIcons color={palette.surface} name={STATUS_ICON[badge]} size={10} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  absolute: { position: "absolute" },
  badge: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1.5,
    bottom: -7,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: -7,
    width: 18,
  },
  elementLabel: { fontFamily: typography.fontFamily.medium, fontSize: 10, padding: 2, textAlign: "center" },
  scrollContent: { flexGrow: 1 },
  tableLabel: { fontFamily: typography.fontFamily.semibold },
  tableText: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0, alignItems: "center", justifyContent: "center", padding: 2 },
  viewport: { flex: 1 },
});
