# Inquiry status colors (project standard)

Cross-project reference for quotation / inquiry workflow UI. Use these colors consistently for event cards, list tints, badges, and status indicators.

**Source of truth (CSS):** `quotation_frontend/src/app/shared/styles/inquiry-status-theme.css`

## Chat channels (important)

| Channel | UI | Who talks | Never includes |
|---------|-----|-----------|----------------|
| **Admin ↔ Customer** | Admin “Chat with customer” + Consumer Tracking chat | ADMIN and CONSUMER only | Distributor messages, send-to-distributor notices, distributor quotations |
| **Admin ↔ Distributor** | `/admin/queries/:id/distributors` | ADMIN and DISTRIBUTOR | Consumer chat content |

Filter helpers: `buildAdminCustomerChatTimelineEntries` / `buildConsumerChatTimelineEntries` in `timeline-chat.util.ts`.

## Status bands

| Band | Meaning | Example statuses / copy |
|------|---------|-------------------------|
| **Initiated** | New request created and submitted | `NEW`, “A new quotation request has been sent.” |
| **In progress** | Admin or distributors working on the request | `SENT_TO_DISTRIBUTORS`, `RESPONSES_RECEIVED`, “Checking inventory” |
| **Action required** | Waiting on the consumer | `needsClarification`, `ACTION_REQUIRED` |
| **Final** | Quotation ready for the consumer | `FINAL_SENT`, “Your final quotation is ready.” |
| **Closed** | Request closed, no further action | `CLOSED` |

## Color tokens

| Band | Background | Border | Title text | CSS class |
|------|------------|--------|------------|-----------|
| Initiated | `#EFF6FF` | `#3B82F6` | `#1D4ED8` | `inquiry-event-card--initiated` |
| In progress | `#FFFBEB` | `#F59E0B` | `#B45309` | `inquiry-event-card--in-progress` |
| Action required | `#FFF7ED` | `#EA580C` | `#C2410C` | `inquiry-event-card--action-required` |
| Final | `#ECFDF5` | `#10B981` | `#047857` | `inquiry-event-card--final` |
| Closed | `#F8FAFC` | `#94A3B8` | `#475569` | `inquiry-event-card--closed` |

## Usage rules

1. **One color per band** — do not pick random colors per inquiry; color conveys status meaning.
2. **Light background + medium border + dark title** — use the three tokens together.
3. **Reserve red** for errors, delete, and critical alerts — not for normal workflow states.
4. **Prefer CSS variables** (`--inquiry-status-*`) when styling new components instead of hard-coding hex values.

## CSS variables

```css
--inquiry-status-initiated-bg / -border / -title
--inquiry-status-in-progress-bg / -border / -title
--inquiry-status-action-required-bg / -border / -title
--inquiry-status-final-bg / -border / -title
--inquiry-status-closed-bg / -border / -title
```

## Workflow mapping (consumer)

```
NEW                         → Initiated (blue)
SENT_TO_DISTRIBUTORS        → In progress (amber)
RESPONSES_RECEIVED          → In progress (amber)
ACTION_REQUIRED             → Action required (orange)
FINAL_SENT                  → Final (green)
CLOSED                      → Closed (slate)
```
