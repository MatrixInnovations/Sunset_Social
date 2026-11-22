import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toastImage } from '@/assets';
import { CalendarIcon, PinIcon } from '@/components/icons';
import { GoldButton, OutlineButton, Pill, Seal } from '@/components/ui';
import { useServices } from '@/bootstrap/ServicesContext';
import { sampleLabels } from '@/domain/copy';
import { formatMoney } from '@/domain/format';
import { useSessionStore } from '@/store/session';
import { colors, fonts } from '@/theme/tokens';

export function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = typeof id === 'string' ? id : 'sunset-social';
  const services = useServices();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {event.hero === 'toast' ? (
            <Image source={toastImage} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Guests toasting at golden hour" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2a140e' }]} />
          )}
          <LinearGradient colors={['rgba(11,10,12,0.15)', 'rgba(11,10,12,0.05)', colors.ink]} style={StyleSheet.absoluteFill} />
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

        <View style={styles.body}>
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
        </View>
      </ScrollView>

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
          <GoldButton
            label={event.priceFromCents != null ? 'RESERVE YOUR PLACE' : 'TICKETS OPEN WITH THE DATE'}
            testID="reserve-your-place"
            onPress={() => {
              if (event.priceFromCents == null) return;
              void Haptics.selectionAsync();
              router.push(`/checkout/${event.id}`);
            }}
          />
        </View>
      </View>
    </View>
  );
}

function swatch(index: number): string {
  return [colors.gold, colors.rose, colors.amber, '#e6d3a3', colors.burgundy][index] ?? colors.gold;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  muted: { color: colors.ivoryDim, padding: 24, fontFamily: fonts.sans },
  hero: { height: 210 },
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
