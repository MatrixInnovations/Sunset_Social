import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { GoldTicket } from '@/screens/WalletScreen';
import { GoldenTicketReveal, QrReveal } from '@/motion/GoldenTicketReveal';
import { useSessionStore } from '@/store/session';
import { colors, fonts } from '@/theme/tokens';

export function TicketRevealScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const ticket = useSessionStore((state) => state.confirmedTicket);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const here = `${window.location.pathname}${window.location.search}`;
    if (!here.includes('ticket-reveal')) {
      return;
    }
    const state = window.history.state;
    window.history.replaceState(state, '', '/tickets');
    window.history.pushState(state, '', here);
  }, []);

  useEffect(() => {
    const nav = navigation as unknown as {
      addListener: (
        event: 'beforeRemove',
        listener: (event: { data?: { action?: { type?: string } }; preventDefault?: () => void }) => void,
      ) => () => void;
    };
    const sub = nav.addListener('beforeRemove', (event) => {
      const type = event.data?.action?.type;
      if (type === 'REPLACE' || type === 'NAVIGATE' || type === 'JUMP_TO') {
        return;
      }
      event.preventDefault?.();
      router.replace('/tickets');
    });
    return () => {
      sub();
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, [navigation, router]);

  if (!ticket) {
    return (
      <View testID="screen-reveal" style={styles.empty}>
        <Text style={styles.sub}>Your golden ticket will land here.</Text>
      </View>
    );
  }

  return (
    <View testID="screen-reveal" style={styles.screen}>
      <GoldenTicketReveal
        ticket={<GoldTicket ticket={ticket} wrapQr={(node) => <QrReveal>{node}</QrReveal>} />}
        header={
          <View>
            <Text style={styles.kicker}>RESERVATION CONFIRMED</Text>
            <Text style={styles.title}>{"You're on the list."}</Text>
            <Text style={styles.sub}>See you at golden hour.</Text>
          </View>
        }
        onDone={() => {
          if (leaveTimer.current) {
            return;
          }
          const handle = setTimeout(() => router.replace('/tickets'), 1800);
          leaveTimer.current = handle;
          if (typeof handle === 'object' && handle && 'unref' in handle) {
            handle.unref();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  empty: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  kicker: { textAlign: 'center', color: colors.gold, fontFamily: fonts.sansSemi, letterSpacing: 1.8, fontSize: 11 },
  title: { textAlign: 'center', color: colors.ivory, fontFamily: fonts.serifItalic, fontSize: 36, marginTop: 4 },
  sub: { textAlign: 'center', color: colors.gold300, fontFamily: fonts.serifItalic, fontSize: 18, marginTop: 4 },
});
