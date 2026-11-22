import { createContext, useContext, type ReactNode } from 'react';

import type { AppServices } from '@/bootstrap/createSampleServices';

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ children, services }: { children: ReactNode; services: AppServices }): ReactNode {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error('Services are not available on this screen.');
  }
  return services;
}
