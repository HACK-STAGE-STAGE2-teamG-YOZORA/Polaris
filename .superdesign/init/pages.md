# Page dependency and visual context map

## Home /

src/app/page.tsx → use-dashboard.ts, AuthGate, Constellation, HomeAxisRow, HomeEsList, HomeSessionEntry, CHAT_COLORS, MUI Avatar, Button, Typography, Stack, Paper.

Protected composition: dark gradient, wordmark + Constellation + avatar, active/new session entry, profile summary, axis rows, strength/weakness insight cards, sparse-data warning, recent ES, system status link.

## Login /login

src/app/(screens)/login/page.tsx → Constellation, CHAT_COLORS, MUI Box, Button, SvgIcon, Typography, Suspense, useSearchParams.

Protected composition: centered wordmark + Constellation lockup, full-width white pill Google button with real Google icon, auth error message.

## Analysis chat /analysis-chat

src/app/(screens)/analysis-chat/page.tsx → chat state hook plus StartModeChoice, SessionStartForm, MessageList, MessageComposer, ExperienceDraftPanel, AxisAssessmentReview, CompletionBanner, SessionResultReveal, and shared colors/components. Preserve progressive disclosure and draft/confirmed states.

## Experiences /experiences

src/app/(screens)/experiences/page.tsx → ExperienceListItem, ExperienceCardForm, shared forms and BottomNav. Preserve evidence editing and confirmation status.

## ES revision /es-revision

src/app/(screens)/es-revision/page.tsx → EsInputForm, EsComments, EsRevisionResult, EsErrorBanner, shared upload and form patterns. Preserve extraction confirmation before final revision.

## Account and system status

- src/app/(screens)/account/page.tsx: account data and logout; preserve auth affordances.
- src/app/(screens)/system-status/page.tsx: public operational diagnostics; preserve readable status and recovery actions.
