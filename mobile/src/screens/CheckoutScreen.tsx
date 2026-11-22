import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toastImage } from '@/assets';
import { AppleMark } from '@/components/icons';
import { Pill } from '@/components/ui';
import { useServices } from '@/bootstrap/ServicesContext';
import type { AppServices } from '@/bootstrap/createSampleServices';
import { copy, sampleLabels } from '@/domain/copy';
import { formatMoney } from '@/domain/format';
import type { Quote, TicketTier } from '@/domain/types';
import { newCheckoutAttemptId } from '../../supabase/functions/_shared/fulfillment';
import { CheckoutError } from '@/services/errors';
import { useSessionStore } from '@/store/session';
import { colors, fonts } from '@/theme/tokens';

export function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = typeof id === 'string' ? id : 'sunset-social';
  const services = useServices();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const [quantity, setQuantity] = useState(2);
  const [note, setNote] = useState<string | null>(null);
  const attempt = useRef<{ key: string; tierId: string; quantity: number } | null>(null);
  const eventQuery = useQuery({ queryKey: ['event', eventId], queryFn: () => services.events.get(eventId) });
  const tierQuery = useQuery({ queryKey: ['tiers', eventId], queryFn: () => services.events.tiers(eventId) });
  const selected = tierQuery.data?.find((tier) => tier.purchasable) ?? null;
  const quote = selected
    ? safeQuote(services, selected, quantity)
    : null;

  const pay = useMutation({
    mutationFn: async () => {
      if (!selected) {
        throw new CheckoutError('That tier is not on sale yet.', 'tier');
      }
      const profile = await services.guests.profile(services.guests.viewer().id);
      const sameAttempt = attempt.current?.tierId === selected.id && attempt.current.quantity === quantity;
      const idempotencyKey = sameAttempt && attempt.current ? attempt.current.key : newCheckoutAttemptId();
      attempt.current = { key: idempotencyKey, tierId: selected.id, quantity };
      return services.checkout.place({
        tierId: selected.id,
        quantity,
        profileId: profile.id,
        guestName: profile.displayName,
        idempotencyKey,
      });
    },
    onSuccess: async (order) => {
      attempt.current = null;
      await client.invalidateQueries({ queryKey: ['wallet'] });
      await client.invalidateQueries({ queryKey: ['stats'] });
      const ticket = order.tickets[0];
      if (ticket) {
        useSessionStore.getState().setConfirmedTicket(ticket);
        router.push('/ticket-reveal');
        return;
      }
      router.replace('/tickets');
    },
    onError: (error: unknown) => {
      setNote(error instanceof Error ? error.message : 'Payment did not complete.');
    },
  });

  function changeQuantity(next: number) {
    if (!selected) return;
    try {
      const priced = services.checkout.quote(selected, next);
      setQuantity(priced.quantity);
      setNote(null);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Check the quantity.');
    }
  }

  return (
    <View testID="screen-checkout" style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          {services.mode === 'demo' ? <Pill label={sampleLabels.order} tone="gold" /> : <Pill label="STRIPE TEST MODE" tone="gold" />}
        </View>
        <Text style={styles.heading}>RESERVE YOUR PLACE</Text>

        {eventQuery.data ? (
          <View style={styles.eventCard}>
            <Image source={toastImage} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.series}>EVENT I · EDITION NO. 01</Text>
              <Text style={styles.eventName}>{eventQuery.data.name}</Text>
              <Text style={styles.meta}>
                {eventQuery.data.shortWhen} · {eventQuery.data.timeLabel} · Venue revealed to ticket holders
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.choose}>CHOOSE YOUR TICKETS</Text>
        {tierQuery.data?.map((tier) => {
          const active = tier.id === selected?.id;
          return (
            <View key={tier.id} style={[styles.tier, active && styles.tierOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierName}>{tier.name}</Text>
                <Text style={styles.meta}>{tier.description}</Text>
              </View>
              {tier.purchasable && tier.priceCents != null ? (
                <View style={styles.stepper}>
                  <Pressable accessibilityRole="button" testID="qty-minus" onPress={() => changeQuantity(quantity - 1)} style={styles.step}>
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text testID="qty-value" style={styles.qty}>{quantity}</Text>
                  <Pressable accessibilityRole="button" testID="qty-plus" onPress={() => changeQuantity(quantity + 1)} style={styles.step}>
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                  <Text style={styles.tierPrice}>{formatMoney(tier.priceCents)}</Text>
                </View>
              ) : (
                <Text style={styles.tbd}>TBD</Text>
              )}
            </View>
          );
        })}

        <Pressable testID="promo-row" onPress={() => setNote(services.later.promo())} style={styles.promo}>
          <Text style={styles.meta}>Add promo or invite code</Text>
          <Text style={styles.apply}>Apply</Text>
        </Pressable>
        {note ? <Text testID="checkout-note" style={styles.note}>{note}</Text> : null}

        {quote ? (
          <>
            <View style={styles.line}>
              <Text style={styles.meta}>{quote.tierName} × {quote.quantity}</Text>
              <Text style={styles.meta}>{formatMoney(quote.totalCents, 'always')}</Text>
            </View>
            <View style={styles.line}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text testID="checkout-total" style={styles.total}>{formatMoney(quote.totalCents, 'always')}</Text>
            </View>
          </>
        ) : null}
        <Text style={styles.fine}>{copy.checkoutNote}</Text>

        <Pressable
          testID="apple-pay"
          accessibilityRole="button"
          disabled={pay.isPending}
          onPress={() => pay.mutate()}
          style={styles.apple}
        >
          <AppleMark />
          <Text style={styles.appleText}>Pay</Text>
        </Pressable>
        <Text style={styles.or}>OR PAY WITH CARD</Text>
        <Pressable testID="card-pay" accessibilityRole="button" disabled={pay.isPending} onPress={() => pay.mutate()} style={styles.card}>
          <Text style={styles.meta}>{services.mode === 'demo' ? 'Card number' : 'Card details stay with Stripe'}</Text>
          <Text style={styles.visa}>{services.mode === 'demo' ? '•••• 4242   VISA' : 'PaymentSheet'}</Text>
        </Pressable>
        <Text style={styles.secure}>Secured by Stripe · Your golden ticket arrives instantly</Text>
      </ScrollView>
    </View>
  );
}

function safeQuote(services: AppServices, tier: TicketTier, quantity: number): Quote | null {
  try {
    return services.checkout.quote(tier, quantity);
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  top: { paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.ivory, fontSize: 28, lineHeight: 30 },
  heading: {
    textAlign: 'center',
    color: colors.ivoryDim,
    fontFamily: fonts.sansSemi,
    letterSpacing: 2,
    fontSize: 12,
    marginBottom: 16,
  },
  eventCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.inkCard,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  series: { color: colors.gold, fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1.2 },
  eventName: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 24 },
  meta: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 12, lineHeight: 17 },
  choose: {
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: 16,
    color: colors.gold,
    fontFamily: fonts.sansSemi,
    letterSpacing: 1.6,
    fontSize: 11,
  },
  tier: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierOn: { borderColor: colors.gold },
  tierName: { color: colors.ivory, fontFamily: fonts.sansSemi, fontSize: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.ivory, fontSize: 16 },
  qty: { color: colors.ivory, fontFamily: fonts.sansSemi, width: 14, textAlign: 'center' },
  tierPrice: { color: colors.goldBright, fontFamily: fonts.serif, fontSize: 22, marginLeft: 4 },
  tbd: { color: colors.ivoryFaint, fontFamily: fonts.sansSemi, fontSize: 12 },
  promo: {
    marginHorizontal: 16,
    marginTop: 6,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  apply: { color: colors.gold, fontFamily: fonts.sansSemi },
  note: { color: colors.gold300, fontFamily: fonts.sans, marginHorizontal: 16, marginBottom: 8 },
  line: { marginHorizontal: 16, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: colors.ivory, fontFamily: fonts.sansSemi, fontSize: 16 },
  total: { color: colors.goldBright, fontFamily: fonts.serif, fontSize: 32 },
  fine: { color: colors.ivoryFaint, fontFamily: fonts.sans, fontSize: 11, marginHorizontal: 16, marginTop: 6, lineHeight: 16 },
  apple: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.black,
    borderRadius: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  appleText: { color: colors.white, fontFamily: fonts.sansSemi, fontSize: 18 },
  or: { textAlign: 'center', color: colors.ivoryFaint, fontFamily: fonts.sansSemi, letterSpacing: 1.4, fontSize: 11, marginVertical: 12 },
  card: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visa: { color: colors.ivory, fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1 },
  secure: { textAlign: 'center', color: colors.ivoryFaint, fontFamily: fonts.sans, fontSize: 11, marginTop: 12 },
});
