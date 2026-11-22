import type { ReactNode } from 'react';

import type { PaymentPresenter } from '@/services/ports';

/** Default presenter for web and tests. Native builds replace this file with presenter.native.tsx. */
export class PlatformPresenter implements PaymentPresenter {
  async present(): Promise<'failed'> {
    return 'failed';
  }
}

export function StripeRoot({ children }: { children: ReactNode; publishableKey?: string | null }): ReactNode {
  return children;
}
