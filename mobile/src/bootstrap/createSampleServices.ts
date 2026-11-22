import { SampleDatabase } from '@/data/sampleDatabase';
import {
  DemoAuthGateway,
  DemoPaymentGateway,
  IdlePresenter,
  SampleEventRepository,
  SampleGuestRepository,
  SampleOrderRepository,
  SampleTicketRepository,
} from '@/data/sampleRepositories';
import type { Viewer } from '@/domain/types';
import { SentryReporter } from '@/observability/SentryReporter';
import { AuthService } from '@/services/AuthService';
import { CheckoutService } from '@/services/CheckoutService';
import { DoorService } from '@/services/DoorService';
import { EventService } from '@/services/EventService';
import { GuestService } from '@/services/GuestService';
import { LaterRelease } from '@/services/LaterRelease';
import { NotificationService } from '@/services/NotificationService';
import type { NotificationGateway } from '@/services/ports';
import { TicketService } from '@/services/TicketService';

export type AppServices = {
  mode: 'demo' | 'live';
  events: EventService;
  tickets: TicketService;
  checkout: CheckoutService;
  guests: GuestService;
  door: DoorService;
  auth: AuthService;
  notifications: NotificationService;
  later: LaterRelease;
  sentry: SentryReporter;
  refreshViewer: () => Promise<Viewer>;
};

export function createSampleServices(
  db: SampleDatabase = new SampleDatabase(),
  options?: { sentryDsn?: string | null; notifications?: NotificationGateway },
): AppServices {
  const events = new SampleEventRepository(db);
  const tickets = new SampleTicketRepository(db);
  const guests = new SampleGuestRepository(db);
  const guestService = new GuestService(guests, tickets);
  return {
    mode: 'demo',
    events: new EventService(events),
    tickets: new TicketService(tickets),
    checkout: new CheckoutService(events, new SampleOrderRepository(db), new DemoPaymentGateway(), new IdlePresenter(), 'demo', null),
    guests: guestService,
    door: new DoorService(tickets, true),
    auth: new AuthService(new DemoAuthGateway(), 'demo'),
    notifications: new NotificationService(options?.notifications ? 'live' : 'demo', options?.notifications ?? { async register() { return 'stub'; } }),
    later: new LaterRelease(),
    sentry: new SentryReporter(options?.sentryDsn ?? null),
    refreshViewer: async () => guestService.viewer(),
  };
}
