import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GoldTicket } from '@/screens/WalletScreen';
import { GoldenTicketReveal, QrReveal } from '@/motion/GoldenTicketReveal';
import { useSessionStore } from '@/store/session';
import { colors, fonts } from '@/theme/tokens';

export function TicketRevealScreen() {
  const router = useRouter();
  const ticket = useSessionStore((state) => state.confirmedTicket);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

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
  screen: { flex: 1, backgroundColor: 'transparent' },
  empty: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  kicker: { textAlign: 'center', color: colors.gold, fontFamily: fonts.sansSemi, letterSpacing: 1.8, fontSize: 11 },
  title: { textAlign: 'center', color: colors.ivory, fontFamily: fonts.serifItalic, fontSize: 36, marginTop: 4 },
  sub: { textAlign: 'center', color: colors.gold300, fontFamily: fonts.serifItalic, fontSize: 18, marginTop: 4 },
});
