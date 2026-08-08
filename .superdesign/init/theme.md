# Theme and token inventory

## Canonical token source

- Dark authenticated tokens: src/shared/ui/chat-colors.ts (CHAT_COLORS).
- MUI theme: src/app/theme-registry.tsx.
- Legacy CSS tokens and responsive rules: src/app/globals.css.

## Current visual families

1. Home/authenticated: #000000 → #061C2B → #075685, white text, translucent navy surfaces, #fff700 accent.
2. Login/loading: #000000 → #0A2036 → #2B6699, white text, centered brand lockup, white Google button.
3. Legacy light routes: #f5f3ed body, white/paper panels, navy/teal/gold tokens, Japanese system font stack.

Do not merge these families globally. Route-level source is authoritative.
