import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Searchbar, Text } from "react-native-paper";

import { searchCustomers } from "@/features/restaurant/api/restaurantApi";
import { restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";
import { Sheet } from "@/features/restaurant/components/Sheet";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";
import type { RestaurantCustomerDTO } from "@/features/restaurant/types";
import { useAppearance } from "@/theme/AppearanceProvider";
import { radii, spacing, typography } from "@/theme/tokens";

/** Find a customer by name, phone or ID (limited to the profile's customer groups). */
export function CustomerPickerSheet({
  onPick,
  onClose,
}: {
  onPick: (customer: RestaurantCustomerDTO) => void;
  onClose: () => void;
}) {
  const { palette } = useAppearance();
  const { connection, posProfile } = useRestaurant();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ rows: RestaurantCustomerDTO[]; loading: boolean; error: string | null }>({
    rows: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, loading: true }));
      searchCustomers(connection, { pos_profile: posProfile, query: query.trim() || undefined, limit: 30 })
        .then((rows) => active && setState({ rows, loading: false, error: null }))
        .catch((caught) => active && setState({ rows: [], loading: false, error: restaurantErrorMessage(caught, "Search failed.") }));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [connection, posProfile, query]);

  return (
    <Sheet onClose={onClose} title="Choose customer" visible>
      <Searchbar autoFocus onChangeText={setQuery} placeholder="Name, phone or ID" style={{ backgroundColor: palette.surface }} value={query} />
      {state.loading ? <ActivityIndicator style={styles.loading} /> : null}
      {state.error ? <Text style={{ color: palette.error }}>{state.error}</Text> : null}
      {!state.loading && !state.error && !state.rows.length ? (
        <Text style={{ color: palette.onSurfaceMuted }}>No customers match.</Text>
      ) : null}
      {state.rows.map((row) => (
        <Pressable
          accessibilityRole="button"
          key={row.customer}
          onPress={() => onPick(row)}
          style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={styles.text}>
            <Text style={[styles.name, { color: palette.onSurface }]}>{row.customer_name}</Text>
            <Text style={[styles.meta, { color: palette.onSurfaceMuted }]}>
              {[row.mobile_no, row.customer !== row.customer_name ? row.customer : null].filter(Boolean).join(" · ") || row.customer_group}
            </Text>
          </View>
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  loading: { padding: spacing.md },
  meta: { fontFamily: typography.fontFamily.regular, fontSize: typography.size.small },
  name: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
  row: { borderRadius: radii.md, borderWidth: 1, padding: spacing.sm },
  text: { gap: 2 },
});
