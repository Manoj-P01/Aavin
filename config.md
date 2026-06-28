# Aavin Dashboard – Configuration Reference

> **Namakkal District Co-operative Milk Producers' Union Ltd**  
> Dashboard for Total Solids (TS) and Milk & Cream Stock Statement reports.

---

## Environment Variables

### Development
Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### Production (Vercel)
Set the same variables in your Vercel project:
> **Vercel Dashboard → Project → Settings → Environment Variables**

---

## Variable Reference

### Supabase (Database & Auth)

| Variable | Description | Where to find |
|----------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe for browser) | Supabase Dashboard → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service key (never expose to browser) | Supabase Dashboard → Settings → API → service_role key |

### App

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Full public URL of the app | `http://localhost:3000` (dev) / Vercel URL (prod) |
| `NEXT_PUBLIC_ORG_NAME` | Organisation name shown in header | `Namakkal District Co-operative Milk Producers' Union Ltd` |
| `NEXT_PUBLIC_ORG_SHORT` | Short name for mobile header | `NKL Dairy Union` |
| `USE_LOCAL_STORAGE` | Toggle local offline JSON storage (`true`/`false`) | `true` (dev default fallback if Supabase url is empty) |

---

## Supabase Project Setup

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Wait for provisioning (~2 min)
3. Go to **SQL Editor** and run the migration:
   ```
   supabase/migrations/001_initial.sql
   ```
4. Copy the Project URL and keys from **Settings → API**
5. Paste them into `.env.local`

---

## Vercel Deployment

### First Deploy
```bash
npm i -g vercel
vercel login
vercel
```

### Subsequent Deploys
```bash
vercel --prod
```

### Connect to GitHub (recommended)
1. Push code to GitHub
2. In Vercel → New Project → Import Git Repository
3. Set all environment variables in Vercel settings
4. Vercel auto-deploys on every push to `main`

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Start production server locally
npm start
```

---

## Database Schema Overview

| Table | Description |
|-------|-------------|
| `entries` | Master record per date/shift/report_type |
| `ts_milk_rows` | TS report rows (OB, Receipts, Disposals, CB) |
| `stg_rows` | STG solid balance rows per product |
| `stock_rows` | Stock statement rows (OB, Receipts, Disposals, Physical) |
| `separation_details` | Separation details per stock entry |

---

## Print / PDF Export

Reports have a dedicated **print-optimised CSS** (`@media print`).  
To export as PDF:
1. Open any report view page
2. Click **🖨 Print / Export PDF** button
3. In browser print dialog → select **Save as PDF**

---

## Reference Links

- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Vercel Docs: https://vercel.com/docs
- Reference Portal: https://www.aavinportal.com/
