# Politick — Mobile (Expo / React Native)

A native companion to the [Politick web app](https://github.com/theveynapp-del/politick-app),
sharing the same Supabase backend. Built with Expo Router, TypeScript, and the same
design tokens/product principles as web — ported to React Native primitives since
there's no CSS to reuse directly.

## Run it

```bash
npm install
npm run web      # instant preview in a browser tab, no device/simulator needed
npm start        # scan the QR code with the Expo Go app on your phone
npm run ios      # requires macOS + Xcode
npm run android  # requires Android Studio / an emulator
```

`.env` already has the real Politick Supabase project credentials filled in
(same project as the web app — one backend, two clients). `.env.example` is
the template; `.env` is gitignored.

## What's built

- **Today** (`app/(tabs)/index.tsx`) — full Daily 5 screen, live Supabase data,
  domestic/world filter, ZIP-based refetch, "Go deeper" inline expand on each
  story card (never a separate mode, per the product principle)
- **My Reps** (`app/(tabs)/reps.tsx`) — grouped by Federal/State/County/Local,
  live Supabase data, jurisdiction-confidence flagging
- **Explore / Saved / You** — stub screens with working tab navigation,
  mirrors the same stub pattern as the web repo

## Shared logic (kept in sync with the web repo manually)

- `lib/types.ts` — identical to web, same data shape
- `lib/queries.ts` — identical query logic (Supabase JS client works the same
  regardless of platform)
- `lib/tokens.ts` — same color/spacing/type values as web's `tokens.json` and
  `globals.css`, but as plain JS constants since React Native has no CSS
  custom properties
- `lib/mock-data.ts` — same mock content as web, kept as an offline fallback

## Distribution

- **Expo Go**: free, instant, for your own testing — `npm start` and scan the QR code
- **TestFlight**: requires an Apple Developer account ($99/year) and an EAS
  build (`npx eas build --platform ios`) — lets you install a signed build on
  real devices or share with a few testers, no App Store review
- **App Store / Play Store**: full public listing, requires the developer
  accounts above plus platform review

## Next build priorities

Same order as the web app's Claude Code prompt: auth (Supabase magic link,
shared session logic can mostly port from web's approach, swapped for
AsyncStorage), then Saved and You against real data, then Story Detail as
its own route, then a real Explore screen.
