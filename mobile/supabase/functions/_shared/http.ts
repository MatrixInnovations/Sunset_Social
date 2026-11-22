export const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

export function requireTestKey(): string | Response {
  const secret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  if (!secret.startsWith('sk_test_')) {
    return json({ error: 'Stripe test mode only. Live keys are refused.' }, 500);
  }
  return secret;
}

export function ticketCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let body = '';
  for (const byte of bytes) {
    body += alphabet[byte % alphabet.length];
  }
  return `SS-${body}`;
}
