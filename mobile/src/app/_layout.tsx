import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createAppServices } from '@/bootstrap/createAppServices';
import { ServicesProvider } from '@/bootstrap/ServicesContext';
import { readPublishableKey } from '@/lib/env';
import { StripeRoot } from '@/payments/presenter';
import { stackScreen } from '@/motion/motion';
import { colors } from '@/theme/tokens';

import '../global.css';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});

const services = createAppServices();

export default function RootLayout() {
  const [fontsReady] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const [release, setRelease] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRelease(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontsReady || release) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsReady, release]);

  if (!fontsReady && !release) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ServicesProvider services={services}>
          <StripeRoot publishableKey={safeKey()}>
            <StatusBar style="light" />
            <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center' }}>
              <View style={{ flex: 1, width: '100%', maxWidth: 440, backgroundColor: colors.ink }}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.ink },
                    animation: 'default',
                  }}
                >
                  <Stack.Screen name="event/[id]" options={stackScreen.default} />
                  <Stack.Screen name="checkout/[id]" options={stackScreen.checkout} />
                  <Stack.Screen
                    name="ticket-reveal"
                    options={{ ...stackScreen.ticketReveal, contentStyle: { backgroundColor: colors.ink } }}
                  />
                </Stack>
              </View>
            </View>
          </StripeRoot>
        </ServicesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function safeKey(): string | null {
  try {
    return readPublishableKey();
  } catch {
    return null;
  }
}
