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
   `diff -rq /tmp/incoming/rotunda-mobile . -x .git -x node_modules`
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

# Neutral voice

Rotunda describes government; it does not argue about it. That holds for every
word a reader sees — hand-written copy, model prompts, empty states, headlines.
Sourcing rules alone are not enough: a sentence can be perfectly sourced and
still be persuasion.

Never write, and never let a model write:

- **Superlatives that rank things.** "The most powerful office", "the biggest
  lever", "arguably the most consequential". Whether a governorship outranks a
  legislature is an argument, not a fact.
- **Contested causal claims.** "Zoning is the single biggest lever government
  has over housing costs" is one side of a live housing debate. State the
  mechanism — zoning decides what can be built where — and stop.
- **Characterisations of motive or position.** What a person, party or group
  wants, believes, intends, or whether a position is extreme, moderate,
  sensible or radical.
- **Predictions.** What is likely to pass, what happens next, who will win.
- **Verdicts.** Whether something is good, bad, effective, justified or worth
  supporting.
- **Framings borrowed from an argument.** "A Wyoming voter has far more Senate
  influence per person than a Californian" is arithmetically true and is also
  the standard opening of the malapportionment case. Give the fact — every
  state elects two, whatever its population — without the frame.

Describing a disagreement is fine. Joining it is not.

Where a fact genuinely varies by jurisdiction — lieutenant governors, mayors
under different charters, county boards — say that it varies. Do not pick the
most common arrangement and assert it.

`lib/officeRoles.ts` is the worked example, and `supabase/functions/define-term`
is the strictest prompt in the repo; copy its "you must never" block when adding
any new model-backed surface. `scripts/check-neutral-voice.mjs` catches the
common offenders, but it is a net, not a substitute for reading what you wrote.
