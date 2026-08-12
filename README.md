# Wednesday FC Scorebook

Mobile-first PWA to track matches, goals and stats for a weekly pickup
football group. Runs entirely in the browser — no login, no backend — with
data persisted locally and exportable as JSON. Installable and works offline.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- Zustand + localforage (IndexedDB)
- vite-plugin-pwa (Workbox)
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

Safeguards against data loss:

- **Write lock** — the store cannot be written to disk until hydration has
  completed successfully, so an early render or a failed read can never
  overwrite good data with an empty state.
- **Automatic snapshots** — one taken at startup (before any mutation) plus a
  3-slot ring buffer rotated on every jornada close and before every import.
  Restore them from **Settings → Automatic backups**.
- **Recovery screen** — if the stored blob is unreadable, cannot be migrated,
  or comes up empty while backups exist, the app offers the raw bytes, a repair
  attempt and the snapshots instead of silently starting over.
- **Install it** — browsers evict storage from sites you rarely visit (Safari
  after ~7 days). Installing the PWA exempts it.

### Testing affordance

In dev only, `?slowHydrate=<ms>` delays the storage read so the hydration
window is observable. It is ignored in production builds.
