import { copy } from '@/domain/copy';
import type { SocialEvent, TicketRecord, TicketStatus, TicketTier } from '@/domain/types';

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' ? value : null;
}

export function mapEventRow(row: Record<string, unknown>): SocialEvent {
  const hasDate = nullableText(row, 'long_date_label') != null;
  return {
    id: text(row, 'id'),
    edition: text(row, 'edition'),
    seriesLabel: text(row, 'series_label'),
    editionLabel: text(row, 'edition_label'),
    name: text(row, 'name'),
    italicTail: nullableText(row, 'italic_tail'),
    tagline: text(row, 'tagline'),
    shortWhen: text(row, 'date_label'),
    longWhen: nullableText(row, 'long_date_label'),
    timeLabel: text(row, 'time_label'),
    hasDate,
    priceFromCents: numberOrNull(row, 'price_from_cents'),
    hero: text(row, 'hero') === 'tasting' ? 'tasting' : 'toast',
    status: text(row, 'status') === 'announced' ? 'announced' : 'on_sale',
    ageNote: nullableText(row, 'age_note'),
    venuePublicLabel: text(row, 'venue_public_label') || copy.venuePublic,
    cardDetail: text(row, 'card_detail'),
    capacity: numberOrNull(row, 'capacity'),
    hostName: text(row, 'host_name') || copy.hostName,
    hostLine: text(row, 'host_line') || copy.hostLine,
  };
}

export function mapTierRow(row: Record<string, unknown>): TicketTier {
  return {
    id: text(row, 'id'),
    eventId: text(row, 'event_id'),
    name: text(row, 'name'),
    description: text(row, 'description'),
    priceCents: numberOrNull(row, 'price_cents'),
    maxPerOrder: typeof row.max_per_order === 'number' ? row.max_per_order : 8,
    purchasable: row.purchasable === true,
    sort: typeof row.sort === 'number' ? row.sort : 0,
  };
}

export function mapTicketRow(row: Record<string, unknown>): TicketRecord {
  const status = text(row, 'status') as TicketStatus;
  const month = nullableText(row, 'date_month');
  return {
    id: text(row, 'id'),
    orderId: text(row, 'order_id'),
    eventId: text(row, 'event_id'),
    eventName: text(row, 'event_name') || 'Sunset Social',
    edition: text(row, 'edition') || '01',
    tierId: text(row, 'tier_id'),
    tierName: text(row, 'tier_name'),
    holderId: text(row, 'holder_profile_id'),
    guestName: text(row, 'guest_name'),
    code: text(row, 'code'),
    status: status || 'valid',
    index: typeof row.ticket_index === 'number' ? row.ticket_index : 1,
    total: typeof row.ticket_count === 'number' ? row.ticket_count : 1,
    sample: row.sample === true,
    eventTiming: text(row, 'event_timing') === 'past' ? 'past' : 'upcoming',
    doorsLabel: text(row, 'doors_label') || copy.doors,
    venueLabel: copy.venueHolders,
    date: month
      ? {
          month,
          day: text(row, 'date_day'),
          year: text(row, 'date_year'),
          weekday: text(row, 'date_weekday'),
          time: text(row, 'date_time') || copy.timeTba,
        }
      : null,
  };
}
