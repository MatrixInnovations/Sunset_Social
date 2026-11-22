import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { WaveIcon } from '@/components/icons';
import { Pill } from '@/components/ui';
import { useServices } from '@/bootstrap/ServicesContext';
import { sampleLabels } from '@/domain/copy';
import type { WallGuest } from '@/domain/types';
import { listItemIn } from '@/motion/entrances';
import { haptic } from '@/motion/haptics';
import { useMotionPrefs } from '@/motion/useMotionPrefs';
import { colors, fonts, tiles } from '@/theme/tokens';
import Animated from 'react-native-reanimated';

export function GuestWallScreen() {
  const services = useServices();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const viewer = services.guests.viewer();
  const wall = useQuery({
    queryKey: ['wall', 'sunset-social', viewer.id, viewer.demo, viewer.ticketEventIds.join(',')],
    queryFn: () => services.guests.wall('sunset-social', services.guests.viewer()),
  });
  const profile = useQuery({ queryKey: ['profile', viewer.id], queryFn: () => services.guests.profile(viewer.id) });
  const wave = useMutation({
    mutationFn: (person: WallGuest) => services.guests.wave(viewer.id, person.id, 'sunset-social'),
    onSuccess: () => client.invalidateQueries({ queryKey: ['wall'] }),
  });

  return (
    <View testID="screen-guests" style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {wall.data && !wall.data.locked && wall.data.sample ? (
          <View style={styles.banner}>
            <Pill label={sampleLabels.guestsBanner} tone="gold" />
          </View>
        ) : null}
        <Text style={styles.series}>SUNSET SOCIAL · EDITION NO. 01</Text>
        <Text style={styles.title}>
          The <Text style={styles.italic}>guest list</Text>
        </Text>
        <Text style={styles.lead}>See who’s coming before you arrive. Profiles are opt-in and visible only to ticket holders.</Text>

        {wall.data?.locked ? <Text style={styles.locked}>{wall.data.reason}</Text> : null}
        {wall.data && !wall.data.locked ? (
          <>
            <View style={styles.stats}>
              <Stat value={String(wall.data.going)} label="GOING" />
              <Stat value={String(wall.data.youKnow)} label="YOU KNOW" />
              <View style={styles.visible}>
                <View style={styles.you}>
                  <Text style={styles.youLetter}>{profile.data?.monogram ?? 'Y'}</Text>
                </View>
                <View>
                  <Text style={styles.visibleTitle}>{wall.data.viewerVisible ? 'Your profile is visible' : 'Your profile is hidden'}</Text>
                  <Pressable
                    onPress={() => {
                      void services.guests
                        .update(viewer.id, { showPhoto: !(profile.data?.showPhoto ?? true) })
                        .then(() => {
                          void client.invalidateQueries({ queryKey: ['profile'] });
                          void client.invalidateQueries({ queryKey: ['wall'] });
                        });
                    }}
                  >
                    <Text style={styles.edit}>{profile.data?.showPhoto ? 'Edit · Hide photo' : 'Edit · Show photo'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={styles.grid}>
              {wall.data.people.map((person, index) => (
                <GuestCard key={person.id} person={person} index={index} onWave={() => wave.mutate(person)} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function GuestCard({ person, index, onWave }: { person: WallGuest; index: number; onWave: () => void }) {
  const [from, to] = tiles[person.tile];
  const { reduceMotion } = useMotionPrefs();
  return (
    <Animated.View entering={listItemIn(index, reduceMotion)} testID={`guest-${person.id}`} style={styles.card}>
      <LinearGradient colors={[from, to]} style={styles.swatch}>
        <Text style={styles.mono}>{person.monogram}</Text>
      </LinearGradient>
      <Text style={styles.name}>{person.displayName}</Text>
      {person.bio ? <Text style={styles.bio}>{person.bio}</Text> : <View style={{ height: 8 }} />}
      <View style={styles.cardFoot}>
        <Text style={styles.tier}>GOLDEN HOUR</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic.select();
            onWave();
          }}
          style={styles.wave}
        >
          <WaveIcon />
          <Text style={styles.waveText}>Wave</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  banner: { alignItems: 'center', marginBottom: 10 },
  series: { textAlign: 'center', color: colors.gold, fontFamily: fonts.sansSemi, letterSpacing: 1.5, fontSize: 11 },
  title: { textAlign: 'center', color: colors.ivory, fontFamily: fonts.serif, fontSize: 40 },
  italic: { fontFamily: fonts.serifItalic, color: colors.goldBright },
  lead: { textAlign: 'center', color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, marginHorizontal: 28, marginBottom: 12 },
  locked: { textAlign: 'center', color: colors.ivory, fontFamily: fonts.serifItalic, fontSize: 20, margin: 24 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  stat: {
    width: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 26 },
  statLabel: { color: colors.ivoryFaint, fontFamily: fonts.sansSemi, fontSize: 9, letterSpacing: 0.8 },
  visible: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  you: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youLetter: { color: colors.ink, fontFamily: fonts.serifItalic },
  visibleTitle: { color: colors.ivory, fontFamily: fonts.sansMedium, fontSize: 12 },
  edit: { color: colors.gold, fontFamily: fonts.sans, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  card: {
    width: '47%',
    backgroundColor: colors.inkCard,
    borderRadius: 18,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(244,236,221,0.05)',
  },
  swatch: { height: 78, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: fonts.serifItalic, fontSize: 36, color: 'rgba(11,10,12,0.78)' },
  name: { color: colors.ivory, fontFamily: fonts.sansSemi, fontSize: 15, marginTop: 8, marginHorizontal: 4 },
  bio: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, marginHorizontal: 4, marginTop: 2, minHeight: 32 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginHorizontal: 4, marginBottom: 4 },
  tier: { color: colors.gold, fontFamily: fonts.sansSemi, fontSize: 9, letterSpacing: 0.6 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveText: { color: colors.goldBright, fontFamily: fonts.sansMedium, fontSize: 11 },
});
