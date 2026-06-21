# HiveMind — Product Requirements & Progress

## Problem Statement
Build "HiveMind" — an internal organizational problem marketplace & contribution economy platform (Jira/ClickUp-grade) where employees post problems (intros, hiring, research, vendor discovery, market intel, mentorship, etc.), other employees claim and solve them, submit proof-of-work with file attachments, and earn credits redeemable for rewards. Includes reputation, leaderboards, badges, kanban board, dashboards, multi-tenant orgs, RBAC, audit logs, and notifications.

## Stack
- Backend: FastAPI + Motor (MongoDB)
- Frontend: React 19 + Tailwind + shadcn/ui + Recharts + react-router-dom
- Auth: JWT (httpOnly cookies, samesite=none/secure)
- Storage: Emergent Object Storage (init via EMERGENT_LLM_KEY)

## User Personas
- **Admin** — manages org, users, categories, credit value, audits.
- **Manager** — monitors team, sees audits, manages high-value rewards.
- **Reviewer** — approves/rejects/requests changes on submitted solutions.
- **Employee** — creates/claims requests, earns credits, redeems rewards.

## Core Requirements (Static)
- Multi-tenant orgs with isolation by `org_id`
- Request lifecycle: open → claimed → in_progress → submitted → under_review → completed | rejected
- Credit system, transactions ledger, reward marketplace
- Reputation engine + badges (Bronze→Diamond)
- Leaderboards (global / department, all-time / monthly / quarterly)
- Kanban board view + dashboard analytics
- RBAC, audit logs, in-app notifications
- File upload (proof of work) via object storage

## What's Implemented (Phase 1 — Feb 2026)
- ✅ Org signup (multi-tenant) + employee register + email/password login + JWT cookies + logout
- ✅ Org settings: categories CRUD, credit valuation, departments
- ✅ User management: list, role change (admin), profile update
- ✅ Requests: create / list (with filters: status, category, department, search, creator, claimer) / get / patch / claim / unclaim / status transitions
- ✅ Solutions: submit with text + links + file attachments, review (approve/reject/request_changes) with credit payout
- ✅ Credits & transactions ledger; reputation re-computation; badge auto-awarding (problem_solver, connector, top_contributor)
- ✅ Reward marketplace: 8 seeded rewards + redemption with balance check + redemption history
- ✅ Leaderboards: global + department scope; all-time / monthly (30d) / quarterly (90d)
- ✅ Dashboard analytics: KPI cards, 14-day activity line chart, top categories bar chart, org pulse
- ✅ Notifications: in-app bell + read/read-all
- ✅ Audit logs (admin/manager)
- ✅ File upload + secure download via object storage
- ✅ Beautiful, distinctive UI — Bricolage Grotesque + IBM Plex Sans, sharp blue accents, glass nav, grid background, status pills, tier badges
- ✅ Seed data: 1 org (Acme Corp) + 5 users + 6 requests (3 completed, 3 open) + transactions/badges
- ✅ Tested end-to-end via testing_agent_v3 (all backend + frontend flows green; iteration_2 verified regressions fixed)

## Prioritised Backlog
### P0 (next sprint)
- Admin queue for redemption fulfillment (mark redemptions as shipped/completed)
- Email notifications (SendGrid/Resend) on request claimed/approved/rejected
- Bulk user invites (CSV upload) for org onboarding

### P1
- AI-powered features (expertise discovery, bounty suggestion, similar requests) using Claude Sonnet via Emergent Universal Key
- SSO: Google OAuth + Microsoft Entra
- Webhooks (Slack/MS Teams) for notifications
- Saved searches + email digests

### P2
- Knowledge graph view of skills × people × domains
- Collaborator tagging on solutions (multi-contributor payouts)
- Quarterly reputation reset / season-based leagues
- Mobile responsive deep-dive

## Seed Test Credentials
See `/app/memory/test_credentials.md`.

## Known Limitations
- Object storage uses sync `requests` library inside async routes — non-blocking but should migrate to httpx for high concurrency.
- Recharts ResponsiveContainer emits a width/height(-1) warning on first paint (cosmetic).
- CORS uses regex `.*` with credentials — fine for preview, tighten in production.
