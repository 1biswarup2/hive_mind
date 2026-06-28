# Jamoora — Internal Ticket Board

Deploy-ready internal problem marketplace / ticket board for your organization.

## Quick deploy (tomorrow-ready)

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — **required**:

- `JWT_SECRET` — run `openssl rand -hex 32` and paste the result
- `SEED_DEMO_DATA=false` for client production (no demo passwords)

### 2. Start the stack

```bash
docker compose up -d --build
```

Open **http://your-server** (port 80 by default, or set `APP_PORT`).

### 3. First-time setup (client company)

1. Go to **Sign in → New org**
2. Create the organization (company name + domain)
3. First user becomes **admin**
4. Share the login URL; employees use **Join org** with the company domain

No demo data is seeded unless `SEED_DEMO_DATA=true`.

## What's included

- Ticket board (Kanban), request lifecycle, solutions & reviews
- Credits, rewards, leaderboard, dashboard analytics
- Multi-tenant orgs, RBAC (admin / manager / reviewer / employee)
- Audit logs, notifications, file attachments (if `EMERGENT_LLM_KEY` is set)

## Production checklist

| Item | Default in `.env.example` |
|------|---------------------------|
| Demo seed off | `SEED_DEMO_DATA=false` |
| Secure cookies behind HTTPS | Set `COOKIE_SECURE=true` |
| JWT secret | Must change from placeholder |
| Same-origin API | nginx proxies `/api` → backend |
| Health check | `GET /api/health` (includes DB ping) |
| Rate limiting | 30 auth attempts / minute / IP |

## HTTPS (recommended)

Put Caddy, nginx, or your cloud load balancer in front of port 80 with TLS.
Then set in `.env`:

```
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
```

## Optional: demo mode for internal testing

```
SEED_DEMO_DATA=true
REQUIRE_EMAIL_VERIFICATION=false   # no SMTP needed to claim/redeem/create tickets
MAIL_ENABLED=false
REACT_APP_SHOW_DEMO_HINTS=true   # rebuild web image
```

Rebuild: `docker compose up -d --build`

Demo logins: `admin@acme.com` / `Admin@123` (see `auth_testing.md`). Demo users are pre-verified — no org email or SMTP required for testing.

## File uploads

Without `EMERGENT_LLM_KEY`, uploads return 503 — all other features work.
Set the key in `.env` if the client needs attachments.

## Email notifications (new ticket → all org members)

When anyone posts a new request/ticket, every member in that org gets an email (department-scoped if visibility is set to department).

Add to `.env`:

```
MAIL_ENABLED=true
APP_URL=http://your-server:8090          # link in the email body

SMTP_HOST=smtp.gmail.com                 # or your company SMTP
SMTP_PORT=587
SMTP_USER=notifications@yourcompany.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=Jamoora <notifications@yourcompany.com>
SMTP_USE_TLS=true
```

Works with Gmail (App Password), SendGrid SMTP, Amazon SES SMTP, or any corporate mail server.

If `MAIL_ENABLED=false` or SMTP is not configured, tickets still work — emails are skipped silently.

Check delivery: `docker compose logs -f backend` after creating a ticket.

## Email verification (new signups)

All new org admins and employees must verify their email before they can claim tickets, redeem rewards, or post new tickets. They can still log in and browse the board until verified.

Uses the same SMTP settings as ticket notifications. Set `APP_URL` to the public URL users reach in the browser — verification links are `{APP_URL}/verify-email?token=...`.

Add to `.env`:

```
REQUIRE_EMAIL_VERIFICATION=true          # set false to skip guards (local dev without SMTP)
VERIFICATION_TOKEN_TTL_HOURS=24
```

With `MAIL_ENABLED=true`, a verification email is sent on register. Users can click **Resend email** in the in-app banner if it did not arrive.

For local testing without SMTP: set `REQUIRE_EMAIL_VERIFICATION=false` and use demo users, or read the token hash from MongoDB and call `POST /api/auth/verify-email` with the raw token.

## Commands

```bash
docker compose logs -f backend    # API logs
docker compose logs -f web        # nginx / frontend
docker compose down             # stop
docker compose down -v          # stop + wipe database (careful)
```

## Local development (without Docker)

**Backend:**
```bash
cd backend
cp ../.env.example .env   # set MONGO_URL to local Mongo
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env
npm install --legacy-peer-deps
npm start
```

Set `ENVIRONMENT=development` in backend `.env` for permissive CORS during dev.

## Architecture

```
Browser → nginx (web) → /api/* → FastAPI (backend) → MongoDB
                      → /*     → React static build
```

Single origin in production — auth cookies work without cross-origin issues.
