# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Never replace this folder wholesale with a zip

This has caused the same silent regression three times. A zip exported from a
different session is a *snapshot*, not a superset — it does not contain work
done here since that snapshot was taken. Extracting it over this folder
deletes that work, and nothing complains: the app still compiles, still runs,
and still looks right. What actually breaks is integration wiring.

Lost this way so far:

- the `lookup-representatives` edge-function fallback in `lib/queries.ts`
  (twice) — the app silently stopped resolving any ZIP that wasn't already
  seeded in the database
- the Local/State story state-filter — users were shown another state's local
  news labelled as their own
- `docs/` (real reference material) and `eas.json` (production build profile)
- the onboarding pixel-fidelity work, which was never recoverable

## If a zip must be brought in

1. Extract it somewhere else — never straight over this folder.
2. Diff it against the working tree and read every deletion:
   `diff -rq /tmp/incoming/politick-mobile . -x .git -x node_modules`
3. Copy in only the files that genuinely changed. Do not `rsync --delete`, and
   do not `cp -R` over `.git` (that corrupted HEAD and the remote once).
4. Run `npm run check:wiring` and `npx tsc --noEmit` before committing.

## Guard

`scripts/check-wiring.mjs` asserts the integrations the type-checker cannot
see. It runs automatically on pre-commit via `.githooks/pre-commit`.

Clones need the hook path set once:

    npm run setup:hooks

If the check fails, restore the wiring — deleting the check just re-arms the
bug. Add a new invariant whenever something breaks in a way `tsc` won't catch.

# Data honesty

Design mockups in specs frequently contain placeholder or stale content
(fabricated names, prefilled ZIPs, sample officials). Build the layout exactly
as specified, but feed it real data, and show an honest empty state when real
data doesn't exist. Do not ship mockup content as if it were real — the spec's
sample officials included a senator who left office in 2024 and a
representative for the wrong district.
