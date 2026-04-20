# Friends Chat (React + Supabase + Netlify)

Realtime web chat for small groups (around 20 users) with:
- Email/password signup and login
- Profile setup (display name + avatar)
- Dashboard user list that updates when new users sign up
- Group chat with realtime message delivery
- Presence status (online/offline)

## 1) Local setup

1. Install dependencies:
   - `npm install`
2. Create local env file:
   - Copy `.env.example` to `.env`
3. Fill `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Start app:
   - `npm run dev`

## 2) Supabase setup

### Create project
- Create a new Supabase project.

### Run SQL schema
- Open Supabase SQL Editor.
- Run `supabase/schema.sql`.

### Storage bucket
- Create a bucket named `avatars`.
- Set bucket to **Public** (simplest for MVP avatar URLs).

### Auth settings
- In Supabase Auth settings:
  - Enable email/password provider.
  - If you want instant signup for demos, disable email confirmation.
  - Add site URL and redirect URLs:
    - Local: `http://localhost:5173`
    - Production: your Netlify URL (example: `https://your-app.netlify.app`)

### Realtime notes
- Ensure Realtime is enabled for `profiles` and `messages` (script includes publication commands).
- If the `alter publication` command says table is already added, that is fine.

## 3) Netlify deployment

### Deploy
- Push this project to GitHub.
- In Netlify: **Add new site** -> **Import from Git** -> choose repo.

### Build configuration
- Build command: `npm run build`
- Publish directory: `dist`
- `netlify.toml` is already included with SPA redirect.

### Environment variables
Add in Netlify site settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then trigger a new deploy.

## 4) Free-tier notes (important)

- Netlify free is enough for hosting this frontend.
- Supabase free tier is usually enough for an MVP with ~20 users, but watch:
  - Database size and row count
  - Realtime usage
  - Storage and bandwidth from avatars
- Keep avatars compressed (small image sizes) to avoid storage/bandwidth spikes.
- For longer-term usage, add message pagination and optional cleanup policy.

## 5) Validation checklist

- Signup creates an auth user.
- New user completes profile and appears in dashboard user list.
- Existing connected users see new signup/profile without refresh.
- Messages appear in realtime in multiple tabs/devices.
- Profile image shows in user list and persists after reload.
- Route refresh works on Netlify (SPA redirect).
