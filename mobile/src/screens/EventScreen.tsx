import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

import { toastImage } from '@/assets';
import { CalendarIcon, PinIcon } from '@/components/icons';
import { OutlineButton, Pill, Seal } from '@/components/ui';
import { useServices } from '@/bootstrap/ServicesContext';
import { sampleLabels } from '@/domain/copy';
import { formatMoney } from '@/domain/format';
import { blockIn } from '@/motion/entrances';
import { HERO_ART } from '@/motion/heroFraming';
import { ParallaxHero, useHeroScroll } from '@/motion/ParallaxHero';
import { ShimmerReserveButton } from '@/motion/ShimmerReserveButton';
import { useMotionPrefs } from '@/motion/useMotionPrefs';
import { useSessionStore } from '@/store/session';
import { colors, fonts } from '@/theme/tokens';

export function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = typeof id === 'string' ? id : 'sunset-social';
  const services = useServices();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const heroW = Math.max(320, Math.min(windowWidth, 440));
  const { scrollY, onScroll } = useHeroScroll();
  const { reduceMotion } = useMotionPrefs();
  const saved = useSessionStore((state) => state.savedIds.includes(eventId));
  const toggleSaved = useSessionStore((state) => state.toggleSaved);
  const eventQuery = useQuery({ queryKey: ['event', eventId], queryFn: () => services.events.get(eventId) });
  const revealQuery = useQuery({
    queryKey: ['reveal', eventId, services.guests.viewer().ticketEventIds.join(',')],
    queryFn: () => services.events.reveal(eventId, services.guests.viewer()),
  });
  const event = eventQuery.data;
  const following = useQuery({
    queryKey: ['stats', services.guests.viewer().id],
    queryFn: () => services.guests.stats(services.guests.viewer().id),
  });

  if (!event) {
    return (
      <View testID="screen-event" style={styles.screen}>
        <Text style={styles.muted}>{eventQuery.error instanceof Error ? eventQuery.error.message : 'Loading…'}</Text>
      </View>
    );
  }

  const location = services.events.locationCopy(event);
  const reveal = revealQuery.data;
  const venueDetail = reveal?.unlocked && reveal.address ? reveal.address : location.detail;
  const venueTitle = reveal?.unlocked && reveal.venueName ? reveal.venueName : location.title;

  return (
    <View testID="screen-event" style={styles.screen}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        {event.hero === 'toast' ? (
          <ParallaxHero source={toastImage} art={HERO_ART.sunsetToast} scrollY={scrollY} width={heroW}>
            <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View style={[styles.floatRow, { top: Math.max(insets.top, 12) }]}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.round}>
              <Text style={styles.roundText}>‹</Text>
            </Pressable>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={() => toggleSaved(event.id)} style={styles.round}>
                <Text style={styles.roundText}>{saved ? '♥' : '♡'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void Share.share({ message: services.events.shareMessage(event) })}
                style={styles.round}
              >
                <Text style={styles.roundText}>↑</Text>
              </Pressable>
            </View>
            </View>
            </View>
          </ParallaxHero>
        ) : (
          <View style={styles.tastingHero}>
            <TastingArt />
            <View style={[styles.floatRow, { top: Math.max(insets.top, 12) }]}>
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.round}>
                <Text style={styles.roundText}>‹</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Animated.View entering={blockIn(0, reduceMotion)} style={styles.body}>
          <Text style={styles.series}>
            {event.seriesLabel} · {event.editionLabel}
          </Text>
          <Text style={styles.title}>
            {event.italicTail ? event.name.replace(event.italicTail, '') : event.name}
            {event.italicTail ? <Text style={styles.italic}>{event.italicTail}</Text> : null}
          </Text>
          <Text style={styles.tagline}>{event.tagline}</Text>

          <Pressable
            style={styles.card}
            onPress={() => {
              const url = services.events.calendarUrl(event);
              if (url) {
                void Linking.openURL(url);
              }
            }}
          >
            <CalendarIcon />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{event.longWhen ?? event.shortWhen}</Text>
              <Text style={styles.cardSub}>
                {event.hasDate ? `${event.timeLabel} · Add to calendar` : 'Date still open'}
              </Text>
            </View>
          </Pressable>

          <View style={styles.card}>
            <PinIcon />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{venueTitle}</Text>
              <Text style={styles.cardSub}>{venueDetail}</Text>
            </View>
          </View>

          <View style={styles.who}>
            <View style={styles.whoHead}>
              <Text style={styles.whoTitle}>Who’s going</Text>
              <Pill label={sampleLabels.avatars} tone="gold" />
            </View>
            <View style={styles.avatarRow}>
              {['M', 'J', 'D', 'K', 'T'].map((letter, index) => (
                <View key={letter} style={[styles.avatar, { marginLeft: index === 0 ? 0 : -8, backgroundColor: swatch(index) }]}>
                  <Text style={styles.avatarLetter}>{letter}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.cardSub}>Guest profiles appear here as places are reserved</Text>
          </View>

          <View style={styles.host}>
            <Seal size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.hostEyebrow}>HOSTED BY</Text>
              <Text style={styles.hostName}>{event.hostName}</Text>
              <Text style={styles.cardSub}>{event.hostLine}</Text>
            </View>
            <OutlineButton
              label={following.data && following.data.following > 0 ? 'FOLLOWING' : 'FOLLOW'}
              onPress={() => {
                const next = !(following.data && following.data.following > 0);
                void services.guests.setFollowing(services.guests.viewer().id, next).then(() => following.refetch());
              }}
            />
          </View>
        </Animated.View>
      </Animated.ScrollView>

      <View style={[styles.sticky, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {event.priceFromCents != null ? (
          <View>
            <Text style={styles.from}>FROM</Text>
            <Text style={styles.price}>{formatMoney(event.priceFromCents)}</Text>
            <Text style={styles.paid}>Paid in advance</Text>
          </View>
        ) : (
          <Text style={styles.paid}>Date still open</Text>
        )}
        <View style={{ flex: 1 }}>
          <ShimmerReserveButton
            label={event.priceFromCents != null ? 'Reserve your place' : 'Tickets open with the date'}
            testID="reserve-your-place"
            disabled={event.priceFromCents == null}
            shimmer={event.priceFromCents != null}
            onPress={() => router.push(`/checkout/${event.id}`)}
          />
        </View>
      </View>
    </View>
  );
}

function TastingArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 220" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id="event-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6a3a28" />
          <Stop offset="0.55" stopColor="#2a140e" />
          <Stop offset="1" stopColor="#0b0a0c" />
        </SvgGradient>
      </Defs>
      <Rect width="160" height="220" fill="url(#event-sky)" />
      <Path d="M48 70h16l8 46H40l8-46Z" stroke={colors.gold} strokeWidth={1.4} fill="rgba(201,169,110,0.16)" />
      <Path d="M46 122h28v12c0 16-6 24-14 24s-14-8-14-24v-12Z" stroke={colors.goldBright} strokeWidth={1.4} fill="rgba(227,193,111,0.2)" />
      <Path d="M96 64c10 14 10 26 0 40-10-14-10-26 0-40Z" stroke={colors.gold300} strokeWidth={1.4} fill="none" />
      <Path d="M96 104v36" stroke={colors.gold300} strokeWidth={1.4} />
      <Path d="M84 146h24" stroke={colors.gold300} strokeWidth={1.4} />
    </Svg>
  );
}

function swatch(index: number): string {
  return [colors.gold, colors.rose, colors.amber, '#e6d3a3', colors.burgundy][index] ?? colors.gold;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  muted: { color: colors.ivoryDim, padding: 24, fontFamily: fonts.sans },
  tastingHero: { height: 240, backgroundColor: '#2a140e' },
  floatRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: 8 },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(11,10,12,0.55)',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundText: { color: colors.ivory, fontSize: 18 },
  body: { paddingHorizontal: 18, marginTop: 16, gap: 12 },
  series: { color: colors.gold, fontFamily: fonts.sansSemi, letterSpacing: 1.6, fontSize: 11 },
  title: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 44, lineHeight: 46 },
  italic: { fontFamily: fonts.serifItalic, color: colors.goldBright },
  tagline: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.inkCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  cardTitle: { color: colors.ivory, fontFamily: fonts.sansSemi, fontSize: 15 },
  cardSub: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 12, marginTop: 2 },
  who: { gap: 8, marginTop: 4 },
  whoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  whoTitle: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 22 },
  avatarRow: { flexDirection: 'row' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.ink, fontFamily: fonts.serifItalic, fontSize: 16 },
  host: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.inkCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  hostEyebrow: { color: colors.gold, fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1.4 },
  hostName: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 22 },
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(11,10,12,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  from: { color: colors.gold, fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1.2 },
  price: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 28, lineHeight: 30 },
  paid: { color: colors.ivoryFaint, fontFamily: fonts.sans, fontSize: 11 },
});
