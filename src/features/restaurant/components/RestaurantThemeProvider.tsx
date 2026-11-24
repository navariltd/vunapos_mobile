import { ThemeProvider as NavigationThemeProvider } from "expo-router";
import { PropsWithChildren, useMemo } from "react";
import { ThemeProvider as PaperThemeProvider } from "react-native-paper";

import { restaurantNavigationTheme, restaurantPaperTheme } from "@/features/restaurant/restaurantTheme";
import { useAppearance } from "@/theme/AppearanceProvider";

/** Restaurant-only theming on top of the app's appearance; retail is untouched. */
export function RestaurantThemeProvider({ children }: PropsWithChildren) {
  const { appearance, palette } = useAppearance();
  const isDark = appearance === "dark";
  const navigationTheme = useMemo(() => restaurantNavigationTheme(palette, isDark), [isDark, palette]);
  const paperTheme = useMemo(() => restaurantPaperTheme(palette, isDark), [isDark, palette]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <PaperThemeProvider theme={paperTheme}>{children}</PaperThemeProvider>
    </NavigationThemeProvider>
  );
}
