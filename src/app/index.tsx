import { Redirect } from 'expo-router';

import { AppLaunchScreen } from '@/components/splash/AppLaunchScreen';
import { useAppSession } from '@/features/auth/AppSessionProvider';
import { restaurantHomeHref } from '@/features/restaurant/navigation';
import { isRestaurantMode, readRestaurantBootstrap } from '@/features/restaurant/context/RestaurantContext';
import { useRootPosBootstrapSnapshot } from '@/sync/PosBootstrapSnapshot';

export default function Index() {
  const { authState } = useAppSession();
  const snapshot = useRootPosBootstrapSnapshot();

  if (authState === 'needsCompanyUrl') {
    return <Redirect href="/(auth)/company-url" />;
  }
  if (authState !== 'signedIn') {
    return <Redirect href="/(auth)/sign-in" />;
  }
  // The POS Profile decides the interface. Wait for the first snapshot so a
  // restaurant user never lands in the retail workspace first.
  if (!snapshot?.data && snapshot?.isLoading && !snapshot.error) {
    return <AppLaunchScreen message="Preparing your workspace…" />;
  }
  if (isRestaurantMode(snapshot?.data)) {
    return <Redirect href={restaurantHomeHref(readRestaurantBootstrap(snapshot?.data))} />;
  }
  return <Redirect href="/(app)" />;
}
