import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ServicesProvider } from '@/bootstrap/ServicesContext';
import { createSampleServices, type AppServices } from '@/bootstrap/createSampleServices';

export async function renderScreen(ui: ReactElement, services: AppServices = createSampleServices(), options?: RenderOptions) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
          frame: { x: 0, y: 0, width: 393, height: 852 },
        }}
      >
        <QueryClientProvider client={client}>
          <ServicesProvider services={services}>{children}</ServicesProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }
  const view = await render(ui, { wrapper: Wrapper, ...options });
  return { ...view, services, client };
}
