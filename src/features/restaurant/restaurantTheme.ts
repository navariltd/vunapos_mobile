import { DarkTheme, DefaultTheme, type Theme } from "expo-router";

import { createFrappeTheme } from "@/theme/frappeTheme";
import type { AppPalette } from "@/theme/tokens";

/**
 * React Navigation's theme for the restaurant tabs. Without it every tab scene
 * is painted with the library's light default (#f2f2f2), even in dark mode.
 */
export function restaurantNavigationTheme(palette: AppPalette, isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      background: palette.background,
      border: palette.border,
      card: palette.surface,
      notification: palette.notification,
      primary: palette.primary,
      text: palette.onSurface,
    },
  };
}

/**
 * The app's Paper theme with the Material 3 colours it leaves at their defaults
 * mapped onto the app palette. Otherwise tonal buttons, search bars, menus and
 * dialogs keep MD3's purple tints, which are most visible in dark mode.
 */
export function restaurantPaperTheme(palette: AppPalette, isDark: boolean) {
  const theme = createFrappeTheme(palette, isDark);
  return {
    ...theme,
    colors: {
      ...theme.colors,
      backdrop: palette.scrim,
      elevation: {
        level0: "transparent",
        level1: palette.surface,
        level2: palette.surfaceContainer,
        level3: palette.surfaceContainer,
        level4: palette.surfaceContainerHigh,
        level5: palette.surfaceContainerHigh,
      },
      inverseOnSurface: palette.surface,
      inversePrimary: palette.primary,
      inverseSurface: palette.onSurface,
      onPrimaryContainer: palette.onPrimary,
      onSecondary: palette.onPrimary,
      onSecondaryContainer: palette.onSurface,
      onTertiary: palette.onPrimary,
      onTertiaryContainer: palette.onSurface,
      secondaryContainer: palette.surfaceContainerHigh,
      surfaceDisabled: isDark ? "rgba(248, 248, 248, 0.12)" : "rgba(23, 23, 23, 0.12)",
      onSurfaceDisabled: palette.disabled,
      tertiary: palette.primary,
      tertiaryContainer: palette.surfaceContainerHigh,
    },
  };
}
