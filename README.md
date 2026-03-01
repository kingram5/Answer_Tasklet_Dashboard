# Answer Control Dashboard

Kyle's AI-powered work automation command center.

## Stack
- **Frontend:** Next.js 14 + Tailwind CSS
- **Backend:** Vercel Serverless Functions
- **Database:** Supabase (Postgres + Realtime)
- **AI:** Tasklet (Answer agent)

## Features
- 💬 Two-way chat with Answer (AI assistant)
- 📊 Overview dashboard with data widgets
- ⚡ Quick action buttons for common tasks
- 🔄 Real-time updates via Supabase Realtime

## Setup
1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in values
4. Run Supabase schema: paste `supabase/schema.sql` into Supabase SQL Editor
5. `npm run dev`

## Environment Variables

### Vercel (set in project Settings → Environment Variables)
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_URL` | Same as NEXT_PUBLIC_SUPABASE_URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service role key |
| `TASKLET_WEBHOOK_URL` | Tasklet webhook endpoint URL |
