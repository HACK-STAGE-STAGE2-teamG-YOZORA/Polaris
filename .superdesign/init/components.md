# Shared UI component inventory

## MUI and shared primitives

- src/app/theme-registry.tsx: global MUI ThemeProvider and CssBaseline; primary #173f6f, secondary #138879, light default surfaces, radius 10px.
- src/app/components/Constellation.tsx: shared brand mark used by Home and login.
- src/app/components/AuthGate.tsx: auth/loading wrapper; renders BottomNav only for authenticated users.
- src/app/components/BottomNav.tsx: fixed five-item authenticated navigation using MUI BottomNavigation.
- src/app/components/AxisPositionBar.tsx: axis position visualization used by Home and analysis results.
- src/app/components/home/HomeAxisRow.tsx: axis label, position statement, evidence count, source-report count, and context notes.
- src/app/components/home/HomeSessionEntry.tsx: resume/start analysis entry with yellow primary and outlined secondary actions.
- src/app/components/home/HomeEsList.tsx: saved ES list on Home.
- src/app/components/ExperienceCardForm.tsx: evidence draft and confirmation editing.
- src/app/components/SessionReportContent.tsx and SessionReportDialog.tsx: report result and evidence details.

## Rules for reuse

Reuse the existing component before creating a new primitive. New primitives should use MUI and existing theme/tokens. Do not duplicate Constellation, bottom navigation, axis visualization, or dark-theme color literals in page files.
