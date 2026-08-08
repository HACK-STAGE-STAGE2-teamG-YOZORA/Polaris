# Layout inventory

- src/app/layout.tsx: root document, Japanese locale, ThemeRegistry, and AuthGate.
- src/app/components/AuthGate.tsx: route-aware auth gate; anonymous users are redirected to /login, authenticated users on /login are redirected to /, and loading uses the login gradient.
- src/app/components/BottomNav.tsx: fixed bottom nav on authenticated routes; reserve bottom space in page content.
- Home and login intentionally use a centered mobile-first max-width 560px composition, not the light legacy .topbar / .content shell.
- Other screens may use the shared light CSS shell in src/app/globals.css; inspect the target route before reusing it.

## Layout invariants

Keep root auth behavior, public paths, responsive stacking, and bottom-nav safe area unchanged during visual work. Do not add a second global shell without a clear route-level requirement.
