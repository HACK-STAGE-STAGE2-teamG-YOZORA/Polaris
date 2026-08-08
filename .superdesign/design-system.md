# Polaris design system

## Product context

Polaris is a Japanese career-support web app. It turns conversations with an AI into evidence-backed self-analysis across four axes, then reuses confirmed experiences for entry-sheet review and company recommendations. The UI should feel calm, personal, exploratory, and trustworthy rather than like a generic dashboard.

Primary journeys:

- Google login → Home
- Home → start or resume a self-analysis chat
- Chat → draft experience cards → user confirmation
- Confirmed evidence → four-axis self-analysis and review
- ES upload/input → extraction confirmation → revision report
- Account and system status are supporting surfaces

## Protected reference surfaces

The following are member-authored visual anchors. Preserve them unless the user explicitly requests a redesign of that surface:

- src/app/page.tsx (/): black/deep-navy/blue vertical gradient, centered 560px column, lowercase Georgia polaris, white Constellation at the right, profile avatar, bright-yellow primary actions, white/muted-white text, and fixed authenticated bottom navigation.
- src/app/(screens)/login/page.tsx (/login): the same brand language, centered polaris + Constellation lockup, full-width white pill Google button with the real Google icon, and error text on the dark gradient.

Do not “unify” these into the light CSS shell in src/app/globals.css; that shell belongs to other routes and is not a license to restyle Home or login.

## Tokens

### Authenticated dark surfaces

| Token | Value | Use |
|---|---|---|
| gradientTop | #000000 | Home gradient start |
| gradientMid | #061C2B | Home gradient middle |
| gradientBottom | #075685 | Home gradient end |
| navy | #0B2545 | Bottom navigation and dark controls |
| navySurface | rgba(255, 255, 255, 0.08) | Informational/card surface over dark backgrounds |
| navyBorder | rgba(255, 255, 255, 0.16) | Dark surface border |
| textOnDark | #FFFFFF | Primary text on dark |
| textOnDarkMuted | rgba(255, 255, 255, 0.68) | Secondary text on dark |
| orange | #fff700 | Primary action and selected state; preserve legacy token name |
| orangeDark | #cdd922ea | Hover/pressed accent |
| orangeMuted | rgba(240, 169, 57, 0.16) | Stale/warning surface |
| bubbleText | #231A0F | Text on yellow accent |

### Login and loading gradient

- Top: #000000
- Middle: #0A2036 at approximately 42%
- Bottom: #2B6699

### Existing light shell tokens

These remain valid for routes that already use the legacy CSS/MUI shell. Do not apply them to Home or login without explicit approval:

- Ink #17223b, muted #667085, paper #fffdf8, surface #ffffff
- Navy #173f6f, teal #138879, gold #d9a441
- Body background #f5f3ed
- Body font "Yu Gothic UI", "Hiragino Kaku Gothic ProN", system-ui, sans-serif
- MUI primary #173f6f, secondary #138879, shape radius 10px

## Typography and composition

- Body: existing Japanese UI stack from ThemeRegistry / globals.css.
- Brand wordmark: Georgia or Times-style serif, lowercase, normal weight, tight negative tracking as currently implemented.
- Dark Home/login column: max-width 560px, centered, horizontal padding around 16–24px, enough bottom padding for the fixed BottomNav.
- Login Google button: full column width, at least 64px tall, white background, rounded pill, dark Google text, real four-color Google icon.
- Authenticated primary actions: yellow filled pills with dark text; secondary actions: outlined white/dark-navy pills depending on background.
- Use generous vertical rhythm, short readable lines, and clear separation between summary, evidence, and action.

## Brand and components

- Use Constellation from src/app/components/Constellation.tsx; preserve its seven-star path geometry and white stroke treatment.
- Use MUI components through ThemeRegistry; do not add a second component library.
- Use BottomNav for authenticated global navigation; preserve fixed positioning, dark navy surface, muted labels, and yellow selected state.
- Use existing axis components for position bars and evidence metadata. INSUFFICIENT_EVIDENCE is a meaningful state, not an error to hide.
- Keep profile avatars, insight cards, stale notices, and data summaries legible over the dark gradient.

## Interaction and accessibility

- Preserve AuthGate redirects and the public paths /login and /system-status.
- Keep loading, error, empty, stale, disabled, and insufficient-evidence states in the same visual language as their parent screen.
- Maintain visible keyboard focus, semantic headings, accessible labels, and sufficient contrast on gradients.
- Keep touch targets comfortable on mobile and avoid hiding controls behind BottomNav.
- Use motion sparingly; prefer short opacity/transform transitions already present in the codebase over decorative animation.

## Change policy

Before changing a shared token or component, search all consumers and compare Home/login screenshots or rendered output. Prefer local extension over global restyling. A new page should look like a Polaris sibling, not a showcase template. A redesign proposal must name the preserved reference patterns and the exact deliberate deviations.
