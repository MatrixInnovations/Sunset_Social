# Sunset Social

The iOS and Android app for Sunset Social. It sits next to the website in this repo and does not change it. One Expo codebase covers both phones, plus a static web export you can open on a phone as a preview.

The first evening is **Saturday, January 23, 2027**, time TBA. The Tasting Room reads **Jan 2027** and has no day yet. The venue is never named. It is revealed only to ticket holders, and this build does not invent an address.

Andrew Lowery gave the go-ahead to build this on November 21, 2026. Payments stay in **Stripe test mode** until he says otherwise.

## Stack

- Expo SDK 58, React Native, TypeScript, Expo Router
- Supabase auth (U.S. phone or email one-time code), Postgres, and Edge Functions
- Stripe PaymentSheet on iOS and Android (Apple Pay, Google Pay, card). The publishable key must be `pk_test_`. Live keys are refused.
- TanStack Query and Zustand
- StyleSheet design tokens (Cormorant Garamond and Manrope). NativeWind was not used so the web export stays reliable.
- Reanimated for the greeting and the door result
- `expo-camera` for the host door scanner
- Push registration is a stub (`expo-notifications` is called, and no token is uploaded until an EAS project id exists)
- Sentry is a local stub. A DSN is buffered in memory and is not sent anywhere yet.

Business rules live in service classes behind interfaces: `EventService`, `TicketService`, `CheckoutService`, `GuestService`, `DoorService`, plus `AuthService`. Screens stay thin.

## Demo mode

Until Supabase and Stripe keys are present, the app runs on a local sample provider. Every sample guest, ticket, and count is labeled **SAMPLE**. The people on the guest wall are fixtures from the approved mockups, not real guests. Door counts that read 42 of 60 are the labeled sample figure from those mockups, not a live tally.

```bash
cd mobile
npm install
npx expo start
```

Press `i` or `a` for a simulator, or scan the QR code with Expo Go. On the web:

```bash
npx expo start --web
```

`EXPO_PUBLIC_DATA_PROVIDER=sample` forces demo mode even if keys are filled in. If the flag is `supabase` and the URL or anon key is missing, the app falls back to demo mode so it still opens.

## Environment

Copy the example and leave secrets out of git:

```bash
cp .env.example .env
```

| Variable | Where | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_DATA_PROVIDER` | app | `sample` or `supabase` |
| `EXPO_PUBLIC_SUPABASE_URL` | app | Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app | Public anon key only |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | app | `pk_test_` only |
| `EXPO_PUBLIC_SENTRY_DSN` | app | Optional. The stub does not upload events |
| `STRIPE_SECRET_KEY` | Supabase function secret | `sk_test_` only. The function refuses anything else |
| `STRIPE_WEBHOOK_SECRET` | Supabase function secret | Signing secret for `stripe-webhook` |

Never put the Stripe secret or the service role key in the app.

## Database

SQL lives in `supabase/migrations/20261122120000_sunset_social_mvp.sql`. It creates events, ticket tiers, guest profiles, orders, tickets, check-ins, holder-only venue reveals, the guest wall, waves, staff roles, and push tokens. Row level security is on every table. Orders and tickets are inserted by the service role (the webhook), not by the phone.

The migration seeds the two evenings and the three tiers. Golden Hour is $35 and purchasable, with a max of 8 per order. The Tasting Flight and Velvet Lounge stay TBD. Reveal rows are empty on purpose.

From a machine logged into the Sunset Social Supabase project:

```bash
supabase db push
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy check-in
supabase functions deploy delete-account
```

`create-payment-intent` reads the price from `ticket_tiers` and creates a test-mode PaymentIntent. `stripe-webhook` issues tickets once, keyed by `payment_ref`. A refund marks those tickets refunded so the door turns them away. `check-in` is the only path that admits a guest, and only for a profile with the `door` or `admin` staff role.

Phase 2 (Wallet passes, waitlist claims, promo codes, transfers, ambassador links) is not in this schema. The app exposes those as later-release messages so the screens match the mockups without pretending the features work.

## Scripts

```bash
npm test          # Jest, CI mode, coverage
npm run typecheck
npm run lint
npm run export:web
```

Coverage gate: at least 80% lines and 75% branches. The five core services are at or above 90% lines.

## Web preview

```bash
npx expo export --platform web
```

The static site is written to `dist/`. Host that folder anywhere that can serve it, and open it on a phone. Demo mode is the default, so the preview does not need keys.

## Store launch checklist

Do not run EAS builds or create store accounts from this repo. Those cost money and need Andrew.

`eas.json` has `development`, `preview`, and `production` profiles. Production expects `EXPO_PUBLIC_DATA_PROVIDER=supabase`.

Before a store submission:

- Apple Developer Program ($99/year) and Google Play Console ($25). An organization account shows the company name and needs a D-U-N-S number. A personal Play account still needs a closed test before production.
- Apple Merchant ID and the Stripe Apple Pay certificate. Bundle id `com.thesoftwaredoctor.sunsetsocial`.
- Keep Stripe in test mode until Andrew switches it. Tickets are in-person events, so the app uses Stripe (Apple Pay, Google Pay, card), not in-app purchase.
- Privacy policy URL, a 21+ age rating, and a demo login for review. Demo mode is that login.
- Account deletion is on the profile screen. In demo mode it clears nothing remote. Live mode calls the `delete-account` function.
- Phone and email codes are the sign-in. No other social login is offered, so Sign in with Apple is not required by that rule.
- Store listing and screenshots must not name the venue, a city, or a neighborhood.
- Contact line everywhere: Text (240) 893-6247.
- About footer: “Developed and Designed by Andrew The Software Doctor”, with Andrew and The Software Doctor in gold. The Software Doctor opens https://thesoftwaredoctor.com/card. “Yeshua is Lord” sits underneath.

## Project map

```
src/services        Event, ticket, checkout, guest, door, auth
src/data            Sample database and Supabase repositories
src/screens         Discover, event, checkout, wallet, guest wall, profile, door
supabase/migrations RLS schema
supabase/functions  PaymentIntent, webhook, check-in, delete account
```
