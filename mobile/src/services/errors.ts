export class CheckoutError extends Error {
  readonly name = 'CheckoutError';

  constructor(
    message: string,
    readonly code: 'quantity' | 'tier' | 'payment' | 'live_key',
  ) {
    super(message);
  }
}

export class GuestError extends Error {
  readonly name = 'GuestError';
}

export class DoorError extends Error {
  readonly name = 'DoorError';
}

export class AuthError extends Error {
  readonly name = 'AuthError';
}

export class EventMissingError extends Error {
  readonly name = 'EventMissingError';

  constructor(id: string) {
    super(`That evening is not on the calendar (${id}).`);
  }
}
