import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

import { toastImage } from '@/assets';
import { BellIcon } from '@/components/icons';
import { GoldButton, OutlineButton, Pill, Seal, Wordmark } from '@/components/ui';
import { useServices } from '@/bootstrap/ServicesContext';
import { copy, sampleLabels } from '@/domain/copy';
import { formatMoney } from '@/domain/format';
import type { SocialEvent } from '@/domain/types';
import { useSessionStore } from '@/store/session';
import { colors, fonts } from '@/theme/tokens';

export function DiscoverScreen() {
  const services = useServices();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setVip = useSessionStore((state) => state.setVipJoined);
  const vipJoined = useSessionStore((state) => state.vipJoined);
  const events = useQuery({ queryKey: ['events'], queryFn: () => services.events.list() });
  const sunset = events.data?.find((event) => event.id === 'sunset-social');
  const tasting = events.data?.find((event) => event.id === 'tasting-room');

  return (
    <View testID="screen-discover" style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Seal />
            <Wordmark />
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/notes')} style={styles.bell}>
            <BellIcon />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.duration(480)}>
          <Text style={styles.greeting}>{copy.greeting}</Text>
          <Text style={styles.greetingSub}>{copy.greetingSub}</Text>
        </Animated.View>

        {sunset ? (
          <Pressable onPress={() => router.push(`/event/${sunset.id}`)} style={styles.hero}>
            <Image source={toastImage} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Guests toasting at golden hour" />
            <LinearGradient colors={['rgba(11,10,12,0.05)', 'rgba(11,10,12,0.2)', 'rgba(11,10,12,0.92)']} style={StyleSheet.absoluteFill} />
            <View style={styles.heroTop}>
              <View style={styles.row}>
                <Pill label="Next evening" />
                <Pill label={`From ${formatMoney(sunset.priceFromCents ?? 0)}`} />
              </View>
              <Pill label={sampleLabels.guests} tone="gold" />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.series}>EVENT I · ROOFTOP SOCIAL</Text>
              <Text style={styles.heroTitle}>
                Sunset <Text style={styles.italic}>Social</Text>
              </Text>
              <Text style={styles.heroMeta}>{copy.heroMeta}</Text>
              <View style={styles.heroFoot}>
                <View style={styles.avatarRow}>
                  {['M', 'J', 'D'].map((letter, index) => (
                    <View key={letter} style={[styles.avatar, { marginLeft: index === 0 ? 0 : -8, backgroundColor: avatarColor(index) }]}>
                      <Text style={styles.avatarLetter}>{letter}</Text>
                    </View>
                  ))}
                  <Text style={styles.going}>{sampleLabels.going}</Text>
                </View>
                <GoldButton
                  compact
                  label="RESERVE"
                  testID="discover-reserve"
                  onPress={() => router.push(`/checkout/${sunset.id}`)}
                />
              </View>
            </View>
          </Pressable>
        ) : (
          <Text style={styles.muted}>{events.error instanceof Error ? events.error.message : 'Loading the evening…'}</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.twoEvenings.toUpperCase()}</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>
        <View style={styles.pair}>
          {sunset ? <EveningCard event={sunset} onPress={() => router.push(`/event/${sunset.id}`)} /> : null}
          {tasting ? <EveningCard event={tasting} onPress={() => router.push(`/event/${tasting.id}`)} /> : null}
        </View>

        <View style={styles.vip}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vipTitle}>{copy.guestListHears}</Text>
            <Text style={styles.vipDetail}>{copy.guestListDetail}</Text>
          </View>
          <OutlineButton
            label={vipJoined ? 'ON THE LIST' : 'JOIN VIP'}
            testID="join-vip"
            onPress={() => {
              setVip(true);
              void services.guests.update(services.guests.viewer().id, { notifyOnDates: true });
              void services.notifications.syncDateDrop(true);
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function EveningCard({ event, onPress }: { event: SocialEvent; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      {event.hero === 'toast' ? (
        <Image source={toastImage} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <TastingArt />
      )}
      <LinearGradient colors={['rgba(11,10,12,0.05)', 'rgba(11,10,12,0.88)']} style={StyleSheet.absoluteFill} />
      <Text style={styles.cardSeries}>{event.hero === 'toast' ? 'EVENT I' : 'EVENT II'}</Text>
      <Text style={styles.cardTitle}>{event.name}</Text>
      <Text style={styles.cardWhen}>{event.cardDetail}</Text>
    </Pressable>
  );
}

function TastingArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 140" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6a3a28" />
          <Stop offset="0.55" stopColor="#2a140e" />
          <Stop offset="1" stopColor="#0b0a0c" />
        </SvgGradient>
      </Defs>
      <Rect width="160" height="140" fill="url(#sky)" />
      <Path d="M78 28c8 10 8 18 0 28-8-10-8-18 0-28Z" stroke={colors.gold300} strokeWidth={1.2} fill="none" />
      <Path d="M78 56v28" stroke={colors.gold300} strokeWidth={1.2} />
      <Path d="M70 86h16" stroke={colors.gold300} strokeWidth={1.2} />
      <Path d="M104 36h10l6 28h-22l6-28Z" stroke={colors.gold} strokeWidth={1.2} fill="rgba(201,169,110,0.15)" />
      <Path d="M102 70h26v8c0 10-6 16-13 16s-13-6-13-16v-8Z" stroke={colors.goldBright} strokeWidth={1.2} fill="rgba(227,193,111,0.18)" />
    </Svg>
  );
}

function avatarColor(index: number): string {
  return [colors.gold, colors.rose, colors.amber][index] ?? colors.gold;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    marginTop: 18,
    paddingHorizontal: 18,
    color: colors.ivory,
    fontFamily: fonts.serif,
    fontSize: 36,
    lineHeight: 38,
  },
  greetingSub: {
    paddingHorizontal: 18,
    color: colors.goldBright,
    fontFamily: fonts.serifItalic,
    fontSize: 26,
    lineHeight: 30,
    marginBottom: 14,
  },
  hero: { marginHorizontal: 16, height: 318, borderRadius: 26, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  row: { flexDirection: 'row', gap: 6 },
  heroBody: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  series: { color: colors.gold300, fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1.6 },
  heroTitle: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 40, lineHeight: 42 },
  italic: { fontFamily: fonts.serifItalic, color: colors.gold300 },
  heroMeta: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 12, marginTop: 4, marginBottom: 12 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.ink, fontFamily: fonts.serifItalic, fontSize: 14 },
  going: { marginLeft: 8, color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 12 },
  muted: { color: colors.ivoryDim, padding: 18, fontFamily: fonts.sans },
  section: {
    marginTop: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: { color: colors.ivory, fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 1.4 },
  seeAll: { color: colors.gold, fontFamily: fonts.sansMedium, fontSize: 12 },
  pair: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 10 },
  card: { flex: 1, height: 132, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end', padding: 10 },
  cardSeries: { color: colors.gold300, fontFamily: fonts.sansSemi, fontSize: 9, letterSpacing: 1.2 },
  cardTitle: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 20, lineHeight: 22 },
  cardWhen: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 11, marginTop: 2 },
  vip: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.inkCard,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vipTitle: { color: colors.ivory, fontFamily: fonts.serifItalic, fontSize: 18 },
  vipDetail: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 12, marginTop: 2 },
});
