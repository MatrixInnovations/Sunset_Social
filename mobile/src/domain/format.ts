import { QR_PREFIX } from '@/domain/copy';
import type { ScanOutcome } from '@/domain/types';

export function formatMoney(cents: number, digits: 'auto' | 'always' = 'auto'): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = absolute / 100;
  const showCents = digits === 'always' || absolute % 100 !== 0;
  return `${sign}$${showCents ? dollars.toFixed(2) : dollars.toFixed(0)}`;
}

const reviewTime: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

export function formatReviewTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const zone = timeZone ? { timeZone } : {};
  const generic = new Intl.DateTimeFormat('en-US', { ...reviewTime, ...zone, timeZoneName: 'shortGeneric' }).format(date);
  const label = generic.split(' ').at(-1) ?? '';
  if (/^[A-Z]{2,4}$/.test(label)) {
    return generic;
  }
  return new Intl.DateTimeFormat('en-US', { ...reviewTime, ...zone, timeZoneName: 'short' }).format(date);
}

export function formatTicketCode(code: string): string {
  const prefix = 'SAMPLE-';
  if (code.startsWith(prefix)) {
    return `SAMPLE · ${code.slice(prefix.length)}`;
  }
  return code;
}

export function qrPayload(code: string): string {
  return `${QR_PREFIX}${code}`;
}

export function parseTicketCode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith(QR_PREFIX)) {
    return trimmed.slice(QR_PREFIX.length).trim();
  }
  return trimmed;
}

export function isRedScan(outcome: ScanOutcome): boolean {
  return outcome === 'void' || outcome === 'refunded' || outcome === 'unknown' || outcome === 'wrong_event';
}

export function scanTitle(outcome: ScanOutcome, index: number | null, total: number | null): string {
  if (outcome === 'admitted') {
    const count = index && total ? ` · ${index} OF ${total}` : '';
    return `ADMITTED${count}`;
  }
  if (outcome === 'duplicate') return 'ALREADY INSIDE';
  if (outcome === 'refunded') return 'REFUNDED';
  if (outcome === 'wrong_event') return 'WRONG EVENING';
  if (outcome === 'unknown') return 'NOT A TICKET';
  return 'NOT VALID';
}
