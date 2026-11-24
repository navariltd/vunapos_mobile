import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";

import { AppLaunchScreen } from "@/components/splash/AppLaunchScreen";
import { LaunchReadyRoute } from "@/components/splash/LaunchReadiness";
import { useAppSession } from "@/features/auth/AppSessionProvider";
import { RestaurantChrome } from "@/features/restaurant/components/RestaurantChrome";
import { RestaurantTabBar } from "@/features/restaurant/components/RestaurantTabBar";
import { RestaurantThemeProvider } from "@/features/restaurant/components/RestaurantThemeProvider";
import {
  RestaurantProvider,
  useOptionalRestaurant,
} from "@/features/restaurant/context/RestaurantContext";
import { RESTAURANT_TABS, visibleRestaurantTabs } from "@/features/restaurant/navigation";
import { RestaurantShiftGate } from "@/features/restaurant/screens/RestaurantShiftGate";
import { useRootPosBootstrapSnapshot } from "@/sync/PosBootstrapSnapshot";
import { useAppearance } from "@/theme/AppearanceProvider";

export default function RestaurantLayout() {
  return (
    <RestaurantThemeProvider>
      <RestaurantProvider>
        <RestaurantShell />
      </RestaurantProvider>
    </RestaurantThemeProvider>
  );
}

function RestaurantShell() {
  const { authState } = useAppSession();
  const snapshot = useRootPosBootstrapSnapshot();
  const restaurant = useOptionalRestaurant();
  const { palette } = useAppearance();

  if (authState !== "signedIn") return <Redirect href="/(auth)/sign-in" />;
  if (!restaurant) {
    if (!snapshot?.data && snapshot?.isLoading) {
      return <AppLaunchScreen message="Preparing your workspace…" />;
    }
    // The profile is not (or no longer) in Restaurant mode: let the root route decide.
    return <Redirect href="/" />;
  }

  // Every selling user works inside their own POS shift; kitchen-only staff do not.
  if (restaurant.needsShift && !restaurant.shiftReady) {
    return (
      <LaunchReadyRoute>
        <RestaurantChrome showProfileButton={false}>
          <RestaurantShiftGate />
        </RestaurantChrome>
      </LaunchReadyRoute>
    );
  }

  const visible = visibleRestaurantTabs(restaurant.kitchenOnly);
  return (
    <LaunchReadyRoute>
      <RestaurantChrome>
        <Tabs
          initialRouteName={restaurant.kitchenOnly ? "kitchen" : "sell"}
          screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.background } }}
          tabBar={(props) => <RestaurantTabBar {...props} visible={visible} />}
        >
          {RESTAURANT_TABS.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{ href: visible.includes(tab.name) ? undefined : null, title: tab.label }}
            />
          ))}
          {/* Reached from More, not shown in the tab bar. */}
          <Tabs.Screen name="close-shift" options={{ href: null, title: "Close shift" }} />
        </Tabs>
      </RestaurantChrome>
    </LaunchReadyRoute>
  );
}
