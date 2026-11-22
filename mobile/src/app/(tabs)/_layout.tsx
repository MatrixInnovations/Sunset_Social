import { Tabs } from 'expo-router';

import { SunsetTabBar } from '@/components/SunsetTabBar';
import { haptic } from '@/motion/haptics';
import { dur } from '@/motion/motion';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <SunsetTabBar {...props} />}
      screenListeners={{ tabPress: () => haptic.select() }}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ink },
        animation: 'fade',
        transitionSpec: { animation: 'timing', config: { duration: dur.micro } },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
      <Tabs.Screen name="guests" options={{ title: 'Guests' }} />
      <Tabs.Screen name="lounge" options={{ title: 'Lounge' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
