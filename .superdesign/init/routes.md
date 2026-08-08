# Route map

| Route | Source | Auth | Visual anchor |
|---|---|---|---|
| / | src/app/page.tsx | Required | Protected dark Home |
| /login | src/app/(screens)/login/page.tsx | Public | Protected Google login |
| /analysis-chat | src/app/(screens)/analysis-chat/page.tsx | Required | Dark chat/analysis flow; reuse Home palette where applicable |
| /experiences | src/app/(screens)/experiences/page.tsx | Required | Evidence/card management |
| /es-revision | src/app/(screens)/es-revision/page.tsx | Required | ES extraction and revision |
| /account | src/app/(screens)/account/page.tsx | Required | Account settings |
| /system-status | src/app/(screens)/system-status/page.tsx | Public | Operational status; preserve existing diagnostic affordances |

API routes live under src/app/api/v1/; do not change them for a visual-only task.
