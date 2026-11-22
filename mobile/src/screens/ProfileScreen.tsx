import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pill, Toggle } from '@/components/ui';
import { useServices } from '@/bootstrap/ServicesContext';
import { copy, sampleLabels } from '@/domain/copy';
import { colors, fonts } from '@/theme/tokens';

export function ProfileScreen() {
  const services = useServices();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const viewer = services.guests.viewer();
  const stats = useQuery({ queryKey: ['stats', viewer.id], queryFn: () => services.guests.stats(viewer.id) });
  const profile = stats.data?.profile;
  const save = useMutation({
    mutationFn: (patch: { showPhoto?: boolean; notifyOnDates?: boolean }) => services.guests.update(viewer.id, patch),
    onSuccess: async (_data, patch) => {
      if (patch.notifyOnDates != null) {
        await services.notifications.syncDateDrop(patch.notifyOnDates);
      }
      await client.invalidateQueries({ queryKey: ['stats'] });
      await client.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  return (
    <View testID="screen-profile" style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 8), paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#3a2418', '#140e0c', colors.ink]} style={styles.hero}>
          {profile?.sample ? <Pill label={sampleLabels.profile} tone="gold" /> : null}
        </LinearGradient>
        <View style={styles.monogramWrap}>
          <View style={styles.monogram}>
            <Text style={styles.letter}>{profile?.monogram ?? 'Y'}</Text>
          </View>
        </View>
        <Text style={styles.name}>{profile?.displayName ?? 'Your Name'}</Text>
        <Text style={styles.helper}>Bio up to 160 characters · photo optional</Text>
        <View style={styles.stats}>
          <Count value={stats.data?.evenings ?? 0} label="EVENINGS" />
          <Count value={stats.data?.following ?? 0} label="FOLLOWING" />
          <Count value={stats.data?.tickets ?? 0} label="TICKETS" />
        </View>

        <View style={styles.group}>
          <Row label="Edit guest profile" onPress={() => router.push('/edit-profile')} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Show my photo on guest lists</Text>
            <Toggle testID="toggle-photo" value={profile?.showPhoto ?? false} onChange={(showPhoto) => save.mutate({ showPhoto })} />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Text me when dates drop</Text>
            <Toggle
              testID="toggle-dates"
              value={profile?.notifyOnDates ?? false}
              onChange={(notifyOnDates) => save.mutate({ notifyOnDates })}
            />
          </View>
          <Row label="Payment methods · Apple Pay" onPress={() => router.push(`/checkout/sunset-social`)} />
          <Row label={copy.contactQuestion} onPress={() => void Linking.openURL('sms:+12408936247')} />
          {viewer.doorStaff || viewer.demo ? <Row label="Door mode" onPress={() => router.push('/door')} /> : null}
          <Row label={services.mode === 'demo' ? 'Sign in' : 'Sign in with a code'} onPress={() => router.push('/auth')} />
          <Row
            label="Delete account"
            onPress={() => {
              void services.auth.deleteAccount();
            }}
          />
        </View>

        <Text style={styles.aboutKicker}>ABOUT SUNSET SOCIAL</Text>
        <Text style={styles.about}>{copy.about}</Text>
        <Text
          accessibilityLabel={`${copy.creditPrefix} ${copy.creditAndrew} ${copy.creditDoctor}`}
          style={styles.credit}
        >
          {copy.creditPrefix} <Text style={styles.gold}>{copy.creditAndrew}</Text>{' '}
          <Text style={styles.gold} onPress={() => void Linking.openURL(copy.creditUrl)}>
            {copy.creditDoctor}
          </Text>
        </Text>
        <Text style={styles.benediction}>{copy.benediction}</Text>
      </ScrollView>
    </View>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  hero: { height: 150, alignItems: 'flex-end', padding: 16 },
  monogramWrap: { alignItems: 'center', marginTop: -42 },
  monogram: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontFamily: fonts.serifItalic, fontSize: 40, color: colors.ink },
  name: { textAlign: 'center', color: colors.ivory, fontFamily: fonts.serif, fontSize: 36, marginTop: 8 },
  helper: { textAlign: 'center', color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 12 },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginVertical: 16 },
  count: { alignItems: 'center' },
  countValue: { color: colors.ivory, fontFamily: fonts.sansSemi, fontSize: 22 },
  countLabel: { color: colors.ivoryFaint, fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1 },
  group: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.inkCard,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(244,236,221,0.08)',
  },
  rowLabel: { color: colors.ivory, fontFamily: fonts.sansMedium, fontSize: 15, flex: 1, paddingRight: 8 },
  chevron: { color: colors.ivoryFaint, fontSize: 22 },
  aboutKicker: {
    textAlign: 'center',
    color: colors.gold,
    fontFamily: fonts.sansSemi,
    letterSpacing: 1.8,
    fontSize: 11,
    marginTop: 28,
  },
  about: {
    textAlign: 'center',
    color: colors.ivoryDim,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: 28,
    marginTop: 8,
  },
  credit: {
    textAlign: 'center',
    color: colors.ivoryDim,
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    marginTop: 22,
    marginHorizontal: 20,
  },
  gold: { color: colors.goldBright, fontFamily: fonts.serifItalic },
  benediction: {
    textAlign: 'center',
    color: colors.ivoryDim,
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    marginTop: 6,
  },
});
