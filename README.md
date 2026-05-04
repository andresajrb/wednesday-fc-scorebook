# Wednesday FC Scorebook

Mobile-first web app to track matches, goals and stats for a weekly pickup
football group. Runs entirely in the browser — no login, no backend — with
data persisted locally and exportable as JSON.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- Zustand + localforage (IndexedDB)
- date-fns, lucide-react

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run typecheck` — TypeScript check

## Data

Everything lives in IndexedDB on the device. Use **Settings → Backups** to
export or import a JSON snapshot.
