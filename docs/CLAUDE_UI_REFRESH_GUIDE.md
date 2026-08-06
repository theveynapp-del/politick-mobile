# Politick - Claude Code UI Refresh Guide

> **Visual source of truth:** `public/politick-approved-mockups.png`

## Non-negotiable direction

Reproduce the approved mockup rather than redesigning it. Politick is a calm civic utility: editorial, neutral, plain-language and useful. No red-vs-blue identity, flags, stars, Capitol decoration, gavels, eagles, glossy gradients, glassmorphism or cable-news urgency.

## Brand tokens

```css
:root {
  --color-ink: #101418;
  --color-paper: #F7F6F2;
  --color-surface: #FFFFFF;
  --color-slate: #5D6670;
  --color-line: #DDE1E5;
  --color-teal: #167D79;
  --color-teal-strong: #0D5F5B;
  --color-teal-soft: #DCEFED;
  --color-gold: #D9A441;
  --color-sand: #EEE9DE;
  --color-coral: #B84E3C;

  --radius-card: 16px;
  --radius-sheet: 24px;
  --radius-button: 12px;
  --radius-pill: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  --mobile-gutter: 20px;
  --motion-fast: 150ms;
  --motion-standard: 200ms;
}
```

## Typography

- Inter across UI and wordmark foundation.
- Display 32/38 700; H1 26/32 700; H2 20/26 650; H3 16/22 650.
- Body 16/24; compact 14/20; label 12/16 650; micro 11/14 500.
- Sentence case, except tiny category labels.

## Global shell

- Reference viewport: 390 x 844.
- Mobile gutter: 20 px.
- White cards on Paper, 16 px radius, 1 px Line border.
- Fixed five-item bottom nav: Today, Explore, Representatives, Saved, Profile.
- 44 px minimum touch targets.

## Routes

| Route | Screen |
|---|---|
| `/onboarding/welcome` | Welcome |
| `/onboarding/location` | ZIP code |
| `/onboarding/representatives` | Representative confirmation |
| `/onboarding/notifications` | Notifications |
| `/today` | Daily 5 |
| `/stories/[slug]` | Everyday story |
| `/stories/[slug]?depth=deep` | Go Deeper |
| `/stories/[slug]/sources` | Sources and timeline |
| `/representatives/[id]` | Representative profile |
| `/explore` | Explore |
| `/saved` | Saved |
| `/profile` | Profile and settings |

## Screen specifications

### Onboarding
1. Welcome: progress label, two-line title, short copy, muted civic illustration, primary button and sign-in link.
2. ZIP: title, supporting copy, 56 px ZIP input, lock/privacy note, primary continue.
3. Representatives: Local/State/Federal segmented control, representative rows, confirmation and edit ZIP actions.
4. Notifications: selectable Daily Briefing and Breaking Updates cards. Daily Briefing selected by default.

### Today / Daily 5
- Lowercase wordmark, greeting, date, Daily 5 title and visible completion.
- Filters: All, Local, State, Federal, World.
- Story cards: category/read time, headline, concise summary, documentary thumbnail, bookmark.
- Daily 5 is finite; extra stories belong under a distinct section.

### Story detail
- Shared header with back, save, share and overflow.
- Depth tabs: Everyday and Go Deeper.
- Everyday order: What happened, Why it matters, Who is involved, What happens next, Your connection, What is uncertain, Sources.
- Go Deeper: status, sponsor, committee, estimate, next step, topic chips, source documents.

### Sources
- Tabs: Overview, Sources, Timeline; Signal Gold active underline.
- Rows include source icon, title, domain, source type and external-link affordance.
- Show primary, official, nonpartisan analysis, reporting and clearly labeled opinion.

### Representative profile
- Official photo, name, office and district without party-color framing.
- Contact Office button and Call, Email, Website, Directions actions.
- Tabs: Overview, Votes, Activity, About.
- Explain office authority before activity.

### Explore / Profile
- Explore: search, topic chips, muted map, world story cards.
- Profile: Deep Teal identity header and grouped white settings cards.

## Core component names

`AppHeader`, `ProgressDots`, `PrimaryButton`, `SecondaryButton`, `ZipInput`, `PrivacyNote`, `SegmentedControl`, `RepresentativeRow`, `NotificationChoiceCard`, `DailyProgress`, `TopicChip`, `StoryCard`, `StoryDepthTabs`, `StorySection`, `SourceRow`, `SourceTabs`, `RepresentativeHero`, `ContactAction`, `ProfileTabBar`, `SearchField`, `SettingsRow`, `BottomNav`.

## Claude kickoff prompt

```text
Read this UI guide and inspect `public/politick-approved-mockups.png` before changing code. Treat the mockup image as the visual source of truth. Refresh the Politick UI to match it exactly; do not redesign, rebrand or substitute a generic political-news aesthetic.

Build the token layer and shared components first, then implement every route at a 390 x 844 viewport. Use the approved Paper, White, Civic Ink, Civic Teal, Deep Teal, Slate, Signal Gold and Warm Sand palette. Use Inter, 20 px mobile gutters, 16 px cards, restrained 1 px borders and minimal shadows. Keep the lowercase politick wordmark and one gold signal dot.

Implement onboarding, Today / Daily 5, Everyday story detail, Go Deeper, Sources, representative profile, Explore, Saved and Profile. Preserve the exact hierarchy, spacing, card composition and bottom navigation shown in the reference. Do not add flags, stars, Capitol imagery, red-versus-blue framing, glossy gradients, glassmorphism or breaking-news visual urgency.

Use demo fixtures for content and keep components ready for real APIs. After each page, compare it against the reference at 390 x 844 and correct spacing, type, color, radius and alignment differences before moving on. Finish by running the acceptance checklist in this document and report any intentional deviations.
```
