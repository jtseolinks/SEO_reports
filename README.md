# SEO Monthly Reporting System

Internal admin system for an SEO agency to manage clients, pull Google Search Console and GA4 data, generate monthly PDF reports, and send them by email.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Prisma 7** + PostgreSQL + `@prisma/adapter-pg`
- **NextAuth v4** (credentials-based admin login)
- **Tailwind CSS v4** + shadcn/ui (`@base-ui/react`)
- **Google APIs** - Search Console, Analytics Data, Analytics Admin
- **Puppeteer** - HTML → PDF generation
- **Nodemailer** - SMTP email sending

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create PostgreSQL database

Create a local or hosted PostgreSQL database and note the connection string.

### 3. Configure environment

Edit `.env.local` (already scaffolded). Required for basic operation:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/seo_reports"
NEXTAUTH_SECRET="<random 32+ char string>"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Apply database schema

```bash
npm run db:push
# or with migration history:
npm run db:migrate
```

### 5. Seed admin user

```bash
npx prisma db seed
```

Default credentials (set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.local` before running):
- Email: `admin@example.com`
- Password: `changeme123`

### 6. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/login`.

## Environment Variables

### Required now
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | JWT signing secret (32+ chars) |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for dev) |

### Required for Google OAuth (Stage 2)
| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/auth/google/callback` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 32+ char secret for token encryption |

### Required for Email (Stage 5)
| Variable | Description |
|---|---|
| `SMTP_HOST` | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | `587` (TLS) or `465` (SSL) |
| `SMTP_USER` | SMTP username / email |
| `SMTP_PASS` | SMTP password or app password |
| `SMTP_FROM` | `Agency Name <email@domain.com>` |
| `AGENCY_NAME` | Your agency name (used in reports + emails) |
| `AGENCY_EMAIL` | Your agency email (shown in report footer) |

### Required for Cron
| Variable | Description |
|---|---|
| `CRON_SECRET` | Random secret to protect the cron endpoint |

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Run Prisma migration (creates migration files) |
| `npm run db:push` | Push schema without migration history |
| `npm run db:seed` | Seed admin user |
| `npm run db:studio` | Open Prisma Studio |

## Routes

| Route | Description |
|---|---|
| `/admin` | Dashboard |
| `/admin/clients` | Client list |
| `/admin/clients/new` | Add client |
| `/admin/clients/[id]` | Client details, properties, keywords, reports |
| `/admin/google` | Google OAuth connection |
| `/admin/reports` | All reports history |
| `/api/auth/google` | Start Google OAuth flow |
| `/api/auth/google/callback` | OAuth callback (set as redirect URI in Google Cloud) |
| `/api/reports/generate` | `POST` - generate PDF report |
| `/api/reports/send` | `POST` - send report by email |
| `/api/reports/test-email` | `POST` - send test email |
| `/api/cron/monthly` | `GET?secret=CRON_SECRET` - daily cron for auto-send |

## Cron Setup

The cron endpoint runs daily and sends reports to all active clients whose `reportSendDay` equals today's day of month.

Trigger it daily with any cron service:

```bash
# Example: every day at 8:00 AM
curl "https://your-domain.com/api/cron/monthly?secret=YOUR_CRON_SECRET"
```

On Vercel, use Vercel Cron Jobs in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/monthly?secret=YOUR_CRON_SECRET",
      "schedule": "0 8 * * *"
    }
  ]
}
```

## Google Cloud Console Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project
3. Enable APIs:
   - **Google Search Console API**
   - **Google Analytics Data API**
   - **Google Analytics Admin API**
4. Create OAuth 2.0 credentials (Web Application)
5. Add redirect URI: `http://localhost:3000/api/auth/google/callback`
6. Copy Client ID and Secret to `.env.local`
7. Go to `/admin/google` and click "Connect Google"

## Development Stages

| Stage | Status | Description |
|---|---|---|
| 1 | ✅ Done | Project scaffold, Prisma schema, admin auth, layout |
| 2 | ✅ Done | Google OAuth connection, token encryption |
| 3–6 | ✅ Done | Client CRUD, property mapping, keywords |
| 7 | ✅ Done | Live data pull via Google APIs |
| 8 | - | Client performance dashboard |
| 9 | ✅ Done | Monthly PDF generation (HTML → Puppeteer) |
| 10 | ✅ Done | Email sending via SMTP (Nodemailer) |
| 11 | ✅ Done | Monthly cron automation |
| 12 | - | Polish, empty states, error handling |
