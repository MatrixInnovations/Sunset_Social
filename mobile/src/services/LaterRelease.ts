/** Named extension points for work that is intentionally not in this release. */
export class LaterRelease {
  walletPass(): string {
    return 'Apple Wallet passes arrive in a later release.';
  }

  transfer(): string {
    return 'Ticket transfers arrive in a later release.';
  }

  promo(): string {
    return 'Invite codes arrive in a later release.';
  }

  waitlist(): string {
    return 'The waitlist opens if an evening sells out.';
  }

  lounge(): string {
    return 'The lounge opens for ticket holders closer to the evening.';
  }

  approvals(): string {
    return 'Host approvals arrive in a later release.';
  }

  directions(): string {
    return 'The address is revealed to ticket holders closer to the evening.';
  }
}
