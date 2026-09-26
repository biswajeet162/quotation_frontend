# Flutter Web on Vercel (with Angular)

Same Vercel project as `quotation_frontend` serves:

| Device | App | URL |
|--------|-----|-----|
| Desktop | Angular | `https://asianproc.com/` |
| Phone / tablet | Flutter Web | `https://asianproc.com/m/` |

Middleware (`middleware.js`) redirects automatically. API stays on the VPS: `https://api.asianproc.com`.

## One-time / every Flutter change

From **`quotation_frontend`** (Flutter SDK required on PATH):

```powershell
npm run sync:flutter-web
```

Or:

```powershell
.\scripts\sync-flutter-web.ps1
```

This will:

1. `flutter build web --release --base-href /m/ --dart-define=API_TARGET=prod`
2. Copy `quotation_mobile/build/web` → `public/m/`

Then commit + push the frontend (including `public/m/`) so Vercel deploys both apps.

```powershell
git add public/m middleware.js vercel.json scripts package.json
git commit -m "Deploy Flutter Web under /m for mobile visitors"
git push
```

## npm scripts

| Script | What it does |
|--------|----------------|
| `npm run sync:flutter-web` | Build Flutter Web + copy to `public/m/` |
| `npm run sync:flutter-web:copy` | Copy existing `build/web` only (no rebuild) |
| `npm run predeploy` | Same as `sync:flutter-web` (run before push) |
| `npm run build:with-mobile` | Sync Flutter Web, then `ng build` |

## Local checks

**Do not** use `/m/` for local Chrome. After a Vercel sync, `build/web` may still have
`<base href="/m/">`, which causes:

`Refused to execute script ... flutter_bootstrap.js ... MIME type ('text/html')`

Run from `quotation_mobile` project root with an explicit root base:

```powershell
cd ..\quotation_mobile
flutter run -d chrome --release --base-href=/ --dart-define=API_TARGET=prod
```

`/m/` is only for the Vercel copy inside Angular (`public/m/`).

```powershell
# After sync, Angular build includes public/m
cd ..\quotation_frontend
npm run build:with-mobile
```

On a phone (or Chrome DevTools device mode) open production and confirm redirect to `/m/`.

Desktop preview of Flutter:

`https://asianproc.com/m/?force_mobile=1`

Phone preview of Angular:

`https://asianproc.com/?force_desktop=1`

## Files involved

- `scripts/sync-flutter-web.mjs` — build + copy
- `scripts/sync-flutter-web.ps1` — Windows wrapper
- `middleware.js` — mobile ↔ desktop routing
- `vercel.json` — `/m` SPA fallback + cache headers
- `public/m/` — generated Flutter Web output (commit after sync)

## Notes

- Do **not** run the sync on Vercel’s build machine unless you install Flutter there; the intended flow is sync locally (or CI with Flutter) → commit `public/m/` → Vercel builds Angular only.
- Deep links: `/login` on mobile becomes `/m/login` when Flutter has that route.
- Email deep links stay on Angular (no `/m/`): `/accept-distributor-invite`, `/verify-email`, `/reset-password`, `/forgot-password`.
- CORS already allows `https://asianproc.com`; no VPS change required for same-origin browser calls.
