import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { QrMark } from '@/components/QrMark';
import { Pill } from '@/components/ui';
import { useServices } from '@/bootstrap/ServicesContext';
import { copy, sampleLabels } from '@/domain/copy';
import { formatTicketCode } from '@/domain/format';
import type { TicketRecord } from '@/domain/types';
import { haptic } from '@/motion/haptics';
import { colors, fonts } from '@/theme/tokens';
import type { ReactNode } from 'react';

const tabs = ['Upcoming', 'Past', 'Waitlist'] as const;

export function WalletScreen() {
  const services = useServices();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<(typeof tabs)[number]>('Upcoming');
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const viewer = services.guests.viewer();
  const wallet = useQuery({ queryKey: ['wallet', viewer.id], queryFn: () => services.tickets.wallet(viewer.id) });
  const upcoming = wallet.data?.upcoming ?? [];
  const ticket = upcoming[index] ?? upcoming[0];

  return (
    <View testID="screen-wallet" style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 14), paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>YOUR TICKETS</Text>
        <Text style={styles.title}>
          Golden <Text style={styles.italic}>tickets</Text>
        </Text>
        <View style={styles.tabs}>
          {tabs.map((name) => (
            <Pressable
              key={name}
              onPress={() => {
                haptic.select();
                setTab(name);
              }}
              style={[styles.tab, tab === name && styles.tabOn]}
            >
              <Text style={[styles.tabText, tab === name && styles.tabTextOn]}>{name}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'Waitlist' ? <Text style={styles.empty}>{services.later.waitlist()}</Text> : null}
        {tab === 'Past' ? (
          <Text style={styles.empty}>
            {(wallet.data?.past.length ?? 0) === 0 ? 'No past evenings yet.' : `${wallet.data?.past.length} past tickets`}
          </Text>
        ) : null}
        {tab === 'Upcoming' && ticket ? (
          <>
            <View style={styles.sampleRow}>{ticket.sample ? <Pill label={sampleLabels.ticket} tone="gold" /> : null}</View>
            <GoldTicket ticket={ticket} />
            {upcoming.length > 1 ? (
              <Pressable onPress={() => setIndex((current) => (current + 1) % upcoming.length)}>
                <Text style={styles.next}>Next ticket</Text>
              </Pressable>
            ) : null}
            <View style={styles.actions}>
              <Pressable style={styles.action} onPress={() => setNote(services.later.walletPass())}>
                <Text style={styles.actionText}>Add to{'\n'}Apple Wallet</Text>
              </Pressable>
              <Pressable testID="transfer" style={styles.action} onPress={() => setNote(services.later.transfer())}>
                <Text style={styles.actionText}>TRANSFER</Text>
              </Pressable>
              <Pressable testID="directions" style={styles.action} onPress={() => setNote(services.later.directions())}>
                <Text style={styles.actionText}>DIRECTIONS</Text>
              </Pressable>
            </View>
            {note ? <Text testID="wallet-note" style={styles.note}>{note}</Text> : null}
          </>
        ) : null}
        {tab === 'Upcoming' && !ticket && !wallet.isLoading ? <Text style={styles.empty}>Your golden ticket will land here.</Text> : null}
      </ScrollView>
    </View>
  );
}

export function GoldTicket({ ticket, wrapQr }: { ticket: TicketRecord; wrapQr?: (node: ReactNode) => ReactNode }) {
  return (
    <LinearGradient colors={['#f7edd4', '#e3c16f', '#c9a96e', '#b8924e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ticket}>
      <View style={styles.notchLeft} />
      <View style={styles.notchRight} />
      <View style={styles.ticketTop}>
        <Text style={styles.ticketName}>{ticket.eventName}</Text>
        <Text style={styles.ticketNo}>
          NO. {ticket.edition} · {ticket.index} OF {ticket.total}
        </Text>
      </View>
      {ticket.date ? (
        <View style={styles.dateRow}>
          <Text style={styles.month}>{ticket.date.month}</Text>
          <Text style={styles.day}>{ticket.date.day}</Text>
          <Text style={styles.year}>{ticket.date.year}</Text>
          <View style={{ flex: 1 }} />
          <View>
            <Text style={styles.when}>{ticket.date.weekday}</Text>
            <Text style={styles.when}>{ticket.date.time}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.when}>{copy.tastingWhen}</Text>
      )}
      <View style={styles.grid}>
        <Meta label="GUEST" value={ticket.guestName} />
        <Meta label="TICKET" value={ticket.tierName} />
        <Meta label="DOORS" value={ticket.doorsLabel} />
        <Meta label="VENUE" value={ticket.venueLabel} />
      </View>
      <View style={styles.perf} />
      <View style={styles.qrWrap}>{wrapQr ? wrapQr(<QrMark code={ticket.code} />) : <QrMark code={ticket.code} />}</View>
      <Text style={styles.code}>{formatTicketCode(ticket.code)}</Text>
      <Text style={styles.hint}>Show at the door · brightness up</Text>
    </LinearGradient>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  kicker: { textAlign: 'center', color: colors.gold, fontFamily: fonts.sansSemi, letterSpacing: 2, fontSize: 11 },
  title: { textAlign: 'center', color: colors.ivory, fontFamily: fonts.serif, fontSize: 40, marginBottom: 12 },
  italic: { fontFamily: fonts.serifItalic, color: colors.goldBright },
  tabs: {
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: colors.inkCard,
    borderRadius: 999,
    padding: 4,
    marginBottom: 12,
  },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  tabOn: { backgroundColor: colors.gold },
  tabText: { color: colors.ivoryDim, fontFamily: fonts.sansMedium, fontSize: 13 },
  tabTextOn: { color: colors.ink },
  sampleRow: { alignItems: 'flex-end', marginRight: 22, marginBottom: 8 },
  ticket: { marginHorizontal: 18, borderRadius: 22, padding: 18, overflow: 'hidden' },
  notchLeft: { position: 'absolute', left: -12, top: '46%', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink },
  notchRight: { position: 'absolute', right: -12, top: '46%', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ticketName: { color: colors.ink, fontFamily: fonts.serif, fontSize: 26 },
  ticketNo: { color: colors.burgundy, fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 0.8 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8 },
  month: { color: colors.burgundy, fontFamily: fonts.sansSemi, letterSpacing: 1, marginBottom: 6 },
  day: { color: colors.burgundy, fontFamily: fonts.serif, fontSize: 52, lineHeight: 52 },
  year: { color: colors.burgundy, fontFamily: fonts.sansSemi, marginBottom: 8 },
  when: { color: colors.ink, fontFamily: fonts.sans, fontSize: 12, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  meta: { width: '50%', marginBottom: 8 },
  metaLabel: { color: 'rgba(90,20,36,0.7)', fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1 },
  metaValue: { color: colors.ink, fontFamily: fonts.sansSemi, fontSize: 14 },
  perf: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(90,20,36,0.35)', marginVertical: 8 },
  qrWrap: { alignItems: 'center' },
  code: { textAlign: 'center', marginTop: 10, color: colors.burgundy, fontFamily: fonts.sansSemi, letterSpacing: 1.4 },
  hint: { textAlign: 'center', color: 'rgba(11,10,12,0.7)', fontFamily: fonts.sans, fontSize: 12 },
  next: { textAlign: 'center', color: colors.gold, marginTop: 10, fontFamily: fonts.sansMedium },
  actions: { flexDirection: 'row', gap: 8, marginHorizontal: 18, marginTop: 14 },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  actionText: { color: colors.ivory, fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 0.6, textAlign: 'center' },
  note: { color: colors.gold300, textAlign: 'center', marginTop: 10, fontFamily: fonts.sans, paddingHorizontal: 20 },
  empty: { color: colors.ivoryDim, textAlign: 'center', marginTop: 28, fontFamily: fonts.serifItalic, fontSize: 18, paddingHorizontal: 28 },
});
