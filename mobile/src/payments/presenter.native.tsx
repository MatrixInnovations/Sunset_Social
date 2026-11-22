import { useEffect, type ReactElement, type ReactNode } from 'react';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';

import type { PaymentPresenter } from '@/services/ports';

type SheetActions = {
  initPaymentSheet: ReturnType<typeof useStripe>['initPaymentSheet'];
  presentPaymentSheet: ReturnType<typeof useStripe>['presentPaymentSheet'];
};

let actions: SheetActions | null = null;

export function registerStripe(next: SheetActions | null): void {
  actions = next;
}

export class PlatformPresenter implements PaymentPresenter {
  async present(clientSecret: string): Promise<'completed' | 'canceled' | 'failed'> {
    if (!actions) {
      return 'failed';
    }
    const init = await actions.initPaymentSheet({
      merchantDisplayName: 'Sunset Social',
      paymentIntentClientSecret: clientSecret,
      applePay: { merchantCountryCode: 'US' },
      googlePay: { merchantCountryCode: 'US', testEnv: true, currencyCode: 'USD' },
      returnURL: 'sunsetsocial://stripe-redirect',
      allowsDelayedPaymentMethods: false,
    });
    if (init.error) {
      return 'failed';
    }
    const presented = await actions.presentPaymentSheet();
    if (presented.error) {
      return presented.error.code === 'Canceled' ? 'canceled' : 'failed';
    }
    return 'completed';
  }
}

function StripeBridge(): null {
  const stripe = useStripe();
  useEffect(() => {
    registerStripe({
      initPaymentSheet: stripe.initPaymentSheet,
      presentPaymentSheet: stripe.presentPaymentSheet,
    });
    return () => registerStripe(null);
  }, [stripe]);
  return null;
}

export function StripeRoot({
  children,
  publishableKey,
}: {
  children: ReactNode;
  publishableKey: string | null;
}): ReactElement {
  if (!publishableKey) {
    return <>{children}</>;
  }
  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.thesoftwaredoctor.sunsetsocial"
      urlScheme="sunsetsocial"
    >
      <>
        {children}
        <StripeBridge />
      </>
    </StripeProvider>
  );
}
