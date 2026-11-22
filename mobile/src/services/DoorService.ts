import { parseTicketCode } from '@/domain/format';
import type { DoorCounts, DoorGuest, ScanOutcome, ScanResult, TicketRecord, Viewer } from '@/domain/types';
import { DoorError } from '@/services/errors';
import type { TicketPort } from '@/services/ports';

export class DoorService {
  constructor(
    private readonly tickets: TicketPort,
    private readonly demo: boolean,
  ) {}

  samplePreview(): ScanResult | null {
    if (!this.demo) {
      return null;
    }
    return {
      outcome: 'admitted',
      guestName: 'Sample Guest',
      tierName: 'Golden Hour',
      code: 'SAMPLE-SS01-0001',
      index: 1,
      total: 2,
      sample: true,
      paidLabel: 'Paid',
    };
  }

  async counts(eventId: string): Promise<DoorCounts> {
    return this.tickets.doorCounts(eventId);
  }

  async search(eventId: string, query: string): Promise<DoorGuest[]> {
    const rows = await this.tickets.guestList(eventId);
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return rows;
    }
    return rows.filter(
      (row) => row.name.toLowerCase().includes(needle) || row.code.toLowerCase().includes(needle),
    );
  }

  async scan(raw: string, eventId: string, staff: Viewer): Promise<ScanResult> {
    if (!staff.doorStaff && !staff.demo) {
      throw new DoorError('Door mode is for the host.');
    }
    const remote = await this.tickets.remoteScan(raw, eventId);
    if (remote) {
      return remote;
    }
    const code = parseTicketCode(raw);
    if (!code) {
      return this.toResult('unknown', null);
    }
    const ticket = await this.tickets.findByCode(code);
    let outcome = this.judge(ticket, eventId);
    if (outcome === 'admitted' && ticket) {
      const marked = await this.tickets.markCheckedIn(ticket.id, staff.id);
      if (!marked) {
        outcome = 'duplicate';
      }
    }
    await this.tickets.appendCheckin({
      ticketId: ticket?.id ?? null,
      eventId,
      staffId: staff.id,
      code,
      result: outcome,
    });
    return this.toResult(outcome, ticket);
  }

  judge(ticket: TicketRecord | null, eventId: string): ScanOutcome {
    if (!ticket) {
      return 'unknown';
    }
    if (ticket.eventId !== eventId) {
      return 'wrong_event';
    }
    if (ticket.status === 'refunded') {
      return 'refunded';
    }
    if (ticket.status === 'void' || ticket.status === 'transferred') {
      return 'void';
    }
    if (ticket.status === 'checked_in') {
      return 'duplicate';
    }
    if (ticket.status !== 'valid') {
      return 'void';
    }
    return 'admitted';
  }

  private toResult(outcome: ScanOutcome, ticket: TicketRecord | null): ScanResult {
    return {
      outcome,
      guestName: ticket?.guestName ?? null,
      tierName: ticket?.tierName ?? null,
      code: ticket?.code ?? null,
      index: ticket?.index ?? null,
      total: ticket?.total ?? null,
      sample: ticket?.sample ?? false,
      paidLabel: ticket ? (ticket.status === 'refunded' ? 'Refunded' : 'Paid') : null,
    };
  }
}
