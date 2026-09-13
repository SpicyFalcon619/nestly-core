# Nestly

A web platform for finding, verifying, and living in shared student and bachelor housing near UIU — plus a marketplace for buying and selling second-hand household items within the same community.

Nestly connects three kinds of user — **Renters**, **Landlords**, and **Administrators** — around two related problems: finding a place to live with every cost itemized up front, and knowing who you're actually renting from or living with before you commit.

## Features

- **Property listings** with a mandatory itemized cost breakdown (rent, electricity, gas, water, internet, maintenance, caretaker fees) instead of a single headline figure
- **Search & discovery** with filters, a map view, and a saved watchlist
- **Flatmate compatibility matching** — an 8-dimension score (sleep schedule, diet, cleanliness, noise tolerance, guest policy, and more) shown before anyone moves in
- **Landlord verification** — document submission reviewed by an administrator, resulting in a verified badge on their listings
- **Seeking board** — post what you're looking for and let landlords or other renters respond
- **Multi-dimensional reviews** — separate scores for accuracy, cleanliness, safety, value, and landlord responsiveness
- **Complaint & moderation system** with admin resolution
- **Mess bill manager** — split monthly utility bills automatically and track who's paid
- **Rent history tracking**
- **Nestly Exchange** — a marketplace for second-hand furniture, appliances, and electronics with an offer/counter-offer flow
- **Real-time messaging** between renters, landlords, and marketplace counterparties
- **Public profiles**, notifications, and an admin dashboard with analytics

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Supabase](https://supabase.com) — PostgreSQL, Auth, Realtime, and Storage
- Server Actions instead of a separate API layer
- [Zod](https://zod.dev) for validation
- [Leaflet](https://leafletjs.com) for the map view, [Chart.js](https://www.chartjs.org) for admin analytics

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file in the project root:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

   The service role key is used server-side only, for admin actions — never expose it to the client or commit it.

3. Apply the SQL migrations in `supabase/migrations/` to your Supabase project, in order (via the SQL Editor or the Supabase CLI).

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/              routes (App Router) — one folder per page/feature
app/actions/      Server Actions (mutations)
components/       shared UI components
lib/supabase/     Supabase client setup (browser + server)
supabase/migrations/  SQL schema migrations, applied in order
types/            shared TypeScript types
```

## Deployment

Deployed on [Vercel](https://vercel.com). Pushes to `main` deploy to production; other branches get their own preview deployment.
