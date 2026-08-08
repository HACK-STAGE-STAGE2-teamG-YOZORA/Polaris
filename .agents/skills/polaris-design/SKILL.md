---
name: polaris-design
description: "Design or implement Polaris frontend UI while preserving the established Home and Google login visual language. Use for any new page, feature, component, redesign, visual review, or design-system change in this repository."
---

# Polaris design skill

Use this skill as the visual and interaction contract for Polaris. Treat the current Home page and Google login page as authored product surfaces and the repository as the source of truth.

## Non-negotiable guardrails

1. Read .superdesign/design-system.md and the relevant files under .superdesign/init/ before changing UI.
2. Inspect the actual render branch of the target route and trace its local UI imports. Do not infer a layout from a component name.
3. Treat src/app/page.tsx and src/app/(screens)/login/page.tsx as protected reference implementations. Do not change their structure, spacing, palette, logo treatment, Constellation treatment, Google button, or responsive behavior unless the user explicitly asks to change that screen.
4. When adding or changing another screen, reuse the established Polaris visual language. Do not introduce a competing theme, new font family, purple/neon gradient, glassmorphism, generic hero layout, or a new component library.
5. Prefer the existing MUI + Emotion setup and CHAT_COLORS, existing shared components, and existing CSS tokens. Extend a token or component only when the current system cannot express the requirement.
6. Keep product behavior and data contracts unchanged during visual work. Preserve route guards, auth redirects, loading/error/empty states, and semantic status labels.
7. Never remove or weaken user evidence, review, confirmation, stale-data, or insufficient-evidence states to make a screen look cleaner.

## Required workflow

### 1. Establish the visual baseline

- Read .superdesign/design-system.md.
- Read the six .superdesign/init/ files relevant to the task; when unsure, read all six.
- Read the target route's real render path and all UI-touching imports.
- Check Home and login as reference anchors before proposing new visual patterns.
- Identify whether the target is an existing rendered screen or a new screen in the existing codebase.

### 2. Route the design task

- Existing screen: reproduce the current screen first when using a design canvas. Describe structure and content from source code, not aesthetic guesses. Only then explore variations.
- New screen: do not fabricate a current reproduction. Use the closest existing Polaris screen as the style anchor and reuse its shell, components, tokens, interaction patterns, and responsive rules.
- Small visual fix: implement directly when the change is unambiguous, then compare the affected route at desktop and narrow mobile widths.

If the Superdesign CLI is available and the user asks for canvas exploration, run the on-demand preflight first:

    npx --yes @superdesign/cli@latest

For an existing rendered target, create one faithful baseline draft before variations. Use branch mode for distinct alternatives, pass .superdesign/design-system.md and the smallest faithful set of source context, and append the fidelity constraint: use only the fonts, colors, spacing, and component styles defined in the design system. Do not create extra variants without user approval. Never implement a canvas variation before the user approves it, unless the user explicitly asks to skip design and implement.

### 3. Implement consistently

- Reuse ThemeRegistry, MUI components, CHAT_COLORS, Constellation, and existing route components where applicable.
- Keep the two dark gradient families distinct: login/loading uses the login gradient, while authenticated Home uses the Home gradient. Do not flatten them into the light legacy CSS shell.
- Preserve the mobile-first centered column behavior of Home and login, including the fixed bottom navigation on authenticated screens.
- Use real brand marks and icons from the repository. Do not replace the Polaris wordmark or Constellation with stock logos or icon libraries.
- Keep interactive controls keyboard accessible, focus-visible, and readable against both dark gradients and light surfaces.

### 4. Verify before handoff

- Review git diff and confirm no protected screen changed unintentionally.
- Check the target route at a narrow mobile viewport and a desktop viewport.
- Verify loading, error, empty, stale, disabled, and authenticated/anonymous states when the change touches them.
- Run the smallest relevant typecheck/build or UI test. For shared visual primitives, run npm.cmd run typecheck; for broader changes also run npm.cmd run build.
- Report which reference screens were preserved and any deliberate visual deviation.

## Polaris visual rules

- Brand: lowercase polaris in Georgia/Times-style serif with generous tracking; pair with the existing white Constellation line-and-star mark.
- Authenticated shell: black → deep navy → blue vertical gradient from CHAT_COLORS.gradientTop, gradientMid, and gradientBottom; white primary text; muted white secondary text.
- Login/loading shell: use the existing black → #0A2036 → #2B6699 vertical gradient and centered composition.
- Accent: the current bright yellow CHAT_COLORS.orange is intentional even though its legacy name says orange. Use it for primary calls to action, selected navigation, and progress emphasis; preserve contrast with CHAT_COLORS.bubbleText.
- Surfaces: use translucent navy surfaces and borders on dark screens; use existing light MUI/CSS surfaces only where the route already does so. Avoid arbitrary opacity layers.
- Typography: use the existing Yu Gothic UI / Hiragino / system body stack. Use Georgia for the product wordmark and established editorial headings only.
- Shape: favor rounded, pill-shaped actions and moderate rounded panels. Do not add excessive cards, floating controls, or decorative shadows.
- Layout: preserve the Home/login max-width rhythm (560px centered column), safe bottom padding for the fixed BottomNav, and the existing responsive stacking behavior.
- Data visualization: keep axis positions, evidence counts, statements, and insufficient-evidence messaging visible; use the existing axis components rather than inventing a new chart language.

## Files to consult first

- src/app/page.tsx — protected Home composition and responsive layout.
- src/app/(screens)/login/page.tsx — protected Google login composition and auth error presentation.
- src/shared/ui/chat-colors.ts — dark theme tokens and semantic accents.
- src/app/components/Constellation.tsx — shared brand mark.
- src/app/components/BottomNav.tsx — authenticated navigation contract.
- src/app/components/AuthGate.tsx — loading/auth route behavior.
- src/app/theme-registry.tsx and src/app/globals.css — MUI and legacy shared tokens.
- docs/product-scope.md and docs/screen-api-map.md — product meaning and screen behavior.

For detailed route inventory and dependency context, read .superdesign/init/. For reusable token and component decisions, read .superdesign/design-system.md.
