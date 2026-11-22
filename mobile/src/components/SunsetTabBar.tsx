import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverIcon, GuestsIcon, LoungeIcon, ProfileIcon, TicketIcon } from '@/components/icons';
import { colors, fonts } from '@/theme/tokens';

const items = [
  { name: 'index', label: 'DISCOVER', Icon: DiscoverIcon },
  { name: 'tickets', label: 'TICKETS', Icon: TicketIcon },
  { name: 'guests', label: 'GUESTS', Icon: GuestsIcon },
  { name: 'lounge', label: 'LOUNGE', Icon: LoungeIcon },
  { name: 'profile', label: 'PROFILE', Icon: ProfileIcon },
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
        const color = active ? colors.goldBright : colors.ivoryFaint;
        return (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              const route = state.routes[routeIndex];
              if (!route) return;
              if (navigateToTab) {
                navigateToTab(route.key);
                return;
              }
              navigation?.navigate(route.name);
            }}
            style={styles.item}
          >
            <item.Icon color={color} />
            <Text style={[styles.label, { color }]}>{item.label}</Text>
            {active ? <View style={styles.dot} /> : <View style={styles.dotHidden} />}
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
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontFamily: fonts.sansSemi, fontSize: 9, letterSpacing: 0.8 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.goldBright },
  dotHidden: { width: 4, height: 4 },
});
