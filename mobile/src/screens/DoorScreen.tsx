import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DoorViewfinder } from '@/components/DoorViewfinder';
import { Pill } from '@/components/ui';
import { useServices } from '@/bootstrap/ServicesContext';
import { sampleLabels } from '@/domain/copy';
import { formatTicketCode, isRedScan, scanTitle } from '@/domain/format';
import type { ScanResult } from '@/domain/types';
import { useSessionStore } from '@/store/session';
import { colors, fonts } from '@/theme/tokens';

const modes = ['Scan', 'Guest list', 'Review', 'Approve', 'Manual'] as const;

export function DoorScreen() {
  const services = useServices();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const viewer = services.guests.viewer();
  const lastDoor = useSessionStore((state) => state.lastDoor);
  const setLastDoor = useSessionStore((state) => state.setLastDoor);
  const [mode, setMode] = useState<(typeof modes)[number]>('Scan');
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState('');
  const counts = useQuery({ queryKey: ['door-counts'], queryFn: () => services.door.counts('sunset-social') });
  const guests = useQuery({
    queryKey: ['door-guests', query],
    queryFn: () => services.door.search('sunset-social', query),
    enabled: mode === 'Guest list',
  });
  const reviews = useQuery({
    queryKey: ['door-reviews'],
    queryFn: () => services.door.reviews(viewer),
    enabled: mode === 'Review',
  });
  const preview = lastDoor ?? services.door.samplePreview();
  const scan = useMutation({
    mutationFn: (code: string) => services.door.scan(code, 'sunset-social', viewer),
    onSuccess: async (result) => {
      setLastDoor(result);
      await client.invalidateQueries({ queryKey: ['door-counts'] });
      await client.invalidateQueries({ queryKey: ['door-guests'] });
    },
  });

  const ratio = counts.data && counts.data.capacity > 0 ? Math.min(1, counts.data.admitted / counts.data.capacity) : 0;

  return (
    <View testID="screen-door" style={styles.screen}>
      <View style={{ paddingTop: Math.max(insets.top, 10), flex: 1 }}>
        <Text style={styles.modeLabel}>DOOR MODE · HOST</Text>
        <View style={styles.countRow}>
          <View>
            <Text testID="door-admitted" style={styles.count}>{counts.data?.admitted ?? '—'}</Text>
            <Text style={styles.countSub}>OF {counts.data?.capacity ?? '—'} IN</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${ratio * 100}%` }]} />
          </View>
          <View>
            <Text style={styles.count}>{counts.data?.pending ?? 0}</Text>
            <Text style={styles.countSub}>PENDING</Text>
          </View>
        </View>
        {counts.data?.sample ? (
          <View style={styles.sample}>
            <Pill label={sampleLabels.counts} tone="gold" />
          </View>
        ) : null}

        {mode === 'Scan' ? (
          <View style={styles.finder}>
            <DoorViewfinder
              live={live}
              onCode={(code) => {
                scan.mutate(code);
              }}
            />
            <View style={styles.frame} pointerEvents="none" />
            {preview ? <ResultCard result={preview} /> : null}
          </View>
        ) : null}

        {mode === 'Guest list' ? (
          <ScrollView style={styles.panel}>
            <TextInput
              testID="door-search"
              value={query}
              onChangeText={setQuery}
              placeholder="Search the sample guest list"
              placeholderTextColor={colors.ivoryFaint}
              style={styles.input}
            />
            {guests.data?.map((guest) => (
              <View key={guest.id} style={styles.guestRow}>
                <View>
                  <Text style={styles.guestName}>{guest.name}</Text>
                  <Text style={styles.guestMeta}>
                    {guest.tierName} · {formatTicketCode(guest.code)} · {guest.status}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {mode === 'Review' ? (
          <ScrollView style={styles.panel}>
            <Text style={styles.panelTitle}>Needs review</Text>
            {reviews.data?.length ? null : <Text style={styles.guestMeta}>No orders need review.</Text>}
            {reviews.data?.map((order) => (
              <View key={order.id} testID="review-order" style={styles.guestRow}>
                {order.sample ? <Pill label="SAMPLE" tone="gold" /> : null}
                <Text style={styles.guestName}>{order.id}</Text>
                <Text style={styles.guestMeta}>{order.eventName}</Text>
                <Text style={styles.guestMeta}>{order.status}</Text>
                <Text style={styles.guestMeta}>{order.reviewNote || 'No note'}</Text>
                <Text style={styles.guestMeta}>{order.createdAt.replace('T', ' ').slice(0, 16)}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {mode === 'Approve' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{services.later.approvals()}</Text>
            <Text style={styles.guestMeta}>Sample queue count: {counts.data?.pending ?? 0}</Text>
          </View>
        ) : null}

        {mode === 'Manual' ? (
          <View style={styles.panel}>
            <TextInput
              testID="manual-code"
              value={manual}
              onChangeText={setManual}
              autoCapitalize="characters"
              placeholder="SAMPLE-SS01-0099"
              placeholderTextColor={colors.ivoryFaint}
              style={styles.input}
            />
            <Pressable testID="manual-check" style={styles.manual} onPress={() => scan.mutate(manual)}>
              <Text style={styles.manualText}>Check in</Text>
            </Pressable>
            {preview && mode === 'Manual' ? <ResultCard result={preview} /> : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {modes.map((item) => (
          <Pressable
            key={item}
            testID={`door-${item.toLowerCase().replace(' ', '-')}`}
            onPress={() => {
              setMode(item);
              if (item === 'Scan') {
                setLive(true);
                if (services.mode === 'demo') {
                  scan.mutate('SUNSETSOCIAL:TICKET:SAMPLE-SS01-0001');
                }
              }
            }}
            style={[styles.dockItem, mode === item && styles.dockOn]}
          >
            <Text style={[styles.dockText, mode === item && styles.dockTextOn]}>
              {item}
              {item === 'Approve' && (counts.data?.pending ?? 0) > 0 ? `  ${counts.data?.pending}` : ''}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ResultCard({ result }: { result: ScanResult }) {
  const denied = isRedScan(result.outcome) || result.outcome === 'duplicate';
  return (
    <Animated.View testID="door-result" entering={FadeInUp.duration(320)} style={[styles.result, denied ? styles.denied : styles.admitted]}>
      <Text style={styles.resultKicker}>{scanTitle(result.outcome, result.index, result.total)}</Text>
      <Text style={styles.resultName}>{result.guestName ?? 'Unknown code'}</Text>
      <Text style={styles.resultMeta}>
        {[result.tierName, result.code ? formatTicketCode(result.code) : null, result.paidLabel].filter(Boolean).join(' · ')}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  modeLabel: { textAlign: 'center', color: colors.gold300, fontFamily: fonts.sansSemi, letterSpacing: 1.8, fontSize: 12 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 8 },
  count: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 32, lineHeight: 34 },
  countSub: { color: colors.ivoryFaint, fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 0.8 },
  barTrack: { flex: 1, height: 6, borderRadius: 99, backgroundColor: '#2a241c', overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.gold },
  sample: { alignItems: 'center', marginVertical: 8 },
  finder: { flex: 1, marginHorizontal: 16, marginBottom: 8 },
  frame: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '16%',
    bottom: '28%',
    borderWidth: 2,
    borderColor: colors.goldBright,
    borderRadius: 18,
  },
  result: { position: 'absolute', left: 12, right: 12, bottom: 16, borderRadius: 18, padding: 14, borderWidth: 1 },
  admitted: { backgroundColor: colors.admitted, borderColor: colors.admittedEdge },
  denied: { backgroundColor: colors.denied, borderColor: colors.deniedEdge },
  resultKicker: { color: colors.gold300, fontFamily: fonts.sansSemi, letterSpacing: 1.2, fontSize: 11 },
  resultName: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 28 },
  resultMeta: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 12 },
  panel: { flex: 1, paddingHorizontal: 16 },
  panelTitle: { color: colors.ivory, fontFamily: fonts.serifItalic, fontSize: 22, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    color: colors.ivory,
    fontFamily: fonts.sans,
    padding: 12,
    marginTop: 8,
  },
  guestRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  guestName: { color: colors.ivory, fontFamily: fonts.sansSemi, fontSize: 16 },
  guestMeta: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 12, marginTop: 2 },
  manual: {
    marginTop: 10,
    backgroundColor: colors.goldBright,
    borderRadius: 999,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualText: { color: colors.ink, fontFamily: fonts.sansSemi, letterSpacing: 1 },
  dock: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: colors.ink,
  },
  dockItem: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dockOn: { backgroundColor: colors.goldBright },
  dockText: { color: colors.ivoryDim, fontFamily: fonts.sansSemi, fontSize: 12 },
  dockTextOn: { color: colors.ink },
});
