import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverIcon, GuestsIcon, LoungeIcon, ProfileIcon, TicketIcon } from '@/components/icons';
import { AnimatedTabIcon } from '@/motion/AnimatedTabIcon';
import { haptic } from '@/motion/haptics';
import { colors } from '@/theme/tokens';

const items = [
  { name: 'index', label: 'Discover', Icon: DiscoverIcon },
  { name: 'tickets', label: 'Tickets', Icon: TicketIcon },
  { name: 'guests', label: 'Guests', Icon: GuestsIcon },
  { name: 'lounge', label: 'Lounge', Icon: LoungeIcon },
  { name: 'profile', label: 'Profile', Icon: ProfileIcon },
] as const;

type TabRoute = { name: string; key: string };

export function SunsetTabBar({
  state,
  navigation,
  navigateToTab,
}: {
  state: { index: number; routes: TabRoute[] };
  navigation?: { navigate: (name: string) => void };
  navigateToTab?: (routeKey: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map((item) => {
        const routeIndex = state.routes.findIndex((route) => route.name === item.name);
        const active = state.index === routeIndex;
        return (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              const route = state.routes[routeIndex];
              if (!route) return;
              haptic.select();
              if (navigateToTab) {
                navigateToTab(route.key);
                return;
              }
              navigation?.navigate(route.name);
            }}
            style={styles.item}
          >
            <AnimatedTabIcon focused={active} label={item.label} renderIcon={(tint) => <item.Icon color={tint} />} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.ink,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(201,169,110,0.25)',
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center' },
});
