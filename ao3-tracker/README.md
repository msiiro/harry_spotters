# Fic Shelf — AO3 Reading Tracker

A full-stack Next.js app for tracking fanfiction you read with friends. Paste an AO3 link and it auto-imports title, author, fandom, characters, word count, tags, stats, and more. Then add your own rating, tags, notes, and reading status.

## Stack

- **Frontend + API**: Next.js 15 (App Router) on Vercel
- **Database**: Supabase (Postgres)
- **Scraping**: Cheerio (server-side, via Next.js API route)

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd ao3-tracker
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL editor, paste and run the contents of `schema.sql`
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

### 3. Set up environment variables

```bash
cp .env.local.example .env.local
# Fill in your Supabase URL and anon key
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Vercel

### Option A: Vercel CLI

```bash
npm i -g vercel
vercel
```

### Option B: GitHub + Vercel Dashboard

1. Push this project to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

---

## Features

### Auto-scraped from AO3
- Title, author
- Fandoms, characters, relationships
- Rating (G/T/M/E), warnings, additional tags
- Word count, chapter count, completion status
- Summary
- Published/updated dates
- Kudos, hits, bookmarks

### Your personal fields
- **Reading status**: Want to Read / Reading / Finished / Dropped
- **Your rating**: 1–5 stars
- **Your tags**: custom comma-separated tags
- **Date read**
- **Recommended by**: track which friend suggested it
- **Notes**: free-form thoughts

### Library view
- Filter by reading status
- Search by title
- Stats: total tracked, finished, total words read

---

## AO3 Scraping Notes

AO3 blocks some automated requests. The scraper:
- Fetches from the canonical work URL (not chapter URL)
- Passes `?view_adult=true` to bypass the adult content gate
- Sets a browser-like User-Agent

**Works that require login** (locked fics) cannot be scraped. For those, you can add a "manual entry" mode by extending the API — or just fill in the fields manually after fetching fails.

---

## Extending

### Add authentication (for true multi-user)
Enable Row Level Security in Supabase and add Supabase Auth:
```bash
npm install @supabase/auth-helpers-nextjs
```

### Add a reading group / friend system
Add a `groups` table and foreign key `group_id` on `books`, then filter by group.

### Manual entry fallback
If scraping fails, show a manual form instead of just an error.
