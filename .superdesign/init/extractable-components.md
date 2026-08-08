# Reusable component candidates

The following existing components are suitable anchors for new UI. Prefer direct reuse in the codebase; extract to a Superdesign canvas component only when a canvas workflow needs it.

| Component | Source | Why it is reusable |
|---|---|---|
| Constellation | src/app/components/Constellation.tsx | Shared brand mark on public/authenticated entry points |
| BottomNav | src/app/components/BottomNav.tsx | Global authenticated navigation |
| HomeAxisRow | src/app/components/home/HomeAxisRow.tsx | Consistent four-axis evidence presentation |
| HomeSessionEntry | src/app/components/home/HomeSessionEntry.tsx | Start/resume analysis CTA pattern |
| ExperienceCardForm | src/app/components/ExperienceCardForm.tsx | Evidence draft/confirmation editing |
| AxisPositionBar | src/app/components/AxisPositionBar.tsx | Axis position visualization |
| SessionReportDialog | src/app/components/SessionReportDialog.tsx | Detailed report/evidence modal |

Basic MUI buttons, fields, cards, and typography are simple primitives; do not turn them into bespoke canvas components unless a specific design workflow requires it.
