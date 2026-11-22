import type {
  CheckinEntry,
  DoorCounts,
  DoorGuest,
  GuestProfile,
  IntentRequest,
  IntentResponse,
  NewPaidOrder,
  PlacedOrder,
  ProfilePatch,
  ScanResult,
  SocialEvent,
  TicketRecord,
  TicketTier,
  VenueRevealRow,
  Viewer,
  WallGuest,
} from '@/domain/types';

export interface EventReader {
  listEvents(): Promise<SocialEvent[]>;
  getEvent(id: string): Promise<SocialEvent | null>;
  listTiers(eventId: string): Promise<TicketTier[]>;
  getTier(id: string): Promise<TicketTier | null>;
  getReveal(eventId: string): Promise<VenueRevealRow | null>;
}

export interface TicketPort {
  listForHolder(profileId: string): Promise<TicketRecord[]>;
  listSamplePreview(): Promise<TicketRecord[]>;
  findByCode(code: string): Promise<TicketRecord | null>;
  guestList(eventId: string): Promise<DoorGuest[]>;
  doorCounts(eventId: string): Promise<DoorCounts>;
  markCheckedIn(ticketId: string, staffId: string): Promise<boolean>;
  appendCheckin(entry: CheckinEntry): Promise<void>;
  /** Live scans are decided on the server. Sample mode returns null and stays local. */
  remoteScan(raw: string, eventId: string): Promise<ScanResult | null>;
}

export interface OrderPort {
  createPaid(input: NewPaidOrder): Promise<PlacedOrder>;
  waitForPayment(paymentRef: string): Promise<PlacedOrder | null>;
}

export interface PaymentGateway {
  createIntent(input: IntentRequest): Promise<IntentResponse>;
}

export interface PaymentPresenter {
  present(clientSecret: string): Promise<'completed' | 'canceled' | 'failed'>;
}

export interface GuestPort {
  getProfile(id: string): Promise<GuestProfile>;
  updateProfile(id: string, patch: ProfilePatch): Promise<GuestProfile>;
  listWall(eventId: string): Promise<WallGuest[]>;
  wave(fromId: string, toId: string, eventId: string): Promise<boolean>;
  setFollowing(profileId: string, following: boolean): Promise<number>;
  followingCount(profileId: string): Promise<number>;
  viewer(): Viewer;
  setViewer(next: Viewer): void;
}

export interface AuthGateway {
  sendPhone(phone: string): Promise<void>;
  verifyPhone(phone: string, code: string): Promise<void>;
  sendEmail(email: string): Promise<void>;
  verifyEmail(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

export interface NotificationGateway {
  register(): Promise<'registered' | 'stub'>;
}
