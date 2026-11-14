# Maseno Timetable — Cloudflare Worker

The Maseno University timetable generator (class, exam, group discussion, personal study/CAT and personal planner),
served at **https://miltontech.co.ke/timetable** by a Cloudflare Worker with Static Assets.

```
maseno-timetable-worker/
├── public/                  # everything served under /timetable/
│   ├── index.html           # HTML shell (no inline CSS/JS)
│   ├── favicon.ico  manifest.json
│   ├── styles/  variables.css · main.css · components.css
│   ├── js/      theme.js · config.js · commentary.js · supabase.js · exporter.js
│   │            gcal.js · planner.js · study.js · exam.js · app.js
│   └── assets/  favicon.svg · logo.svg · icon-192.png · icon-512.png · (masenologo.png)
├── src/index.js             # tiny Worker: slash redirect + legacy-link redirect
├── wrangler.jsonc
└── package.json
```

## Run & deploy

```bash
npm install
npm run dev        # http://localhost:8787/timetable/
npm run deploy     # publishes the Worker + assets and attaches the route
```

Requirements: the `miltontech.co.ke` zone is on your Cloudflare account and `wrangler login` has been run.

### How routing works
* `assets.base_path: "/timetable"` maps `./public` onto `/timetable/…`, so `/timetable/styles/main.css` is `public/styles/main.css`.
  All page references are relative (`./styles/…`, `./js/…`), so the app also works if you change the prefix.
* `run_worker_first` sends only `/timetable`, `/timetable.html` and `/timetable/index.html` through `src/index.js`, which 301-redirects to
  `/timetable/` and **keeps the query string** — old shared links like `/timetable.html?units=…` still open the right timetable.
* `assets.binding: "ASSETS"` is required for the Worker to hand other requests back to the static files.

### Before you go live
1. **Logo** — copy `masenologo.png` into `public/assets/`. (If it's missing the app falls back to `https://miltontech.co.ke/masenologo.png`.)
2. **Google OAuth** — in Google Cloud Console add `https://miltontech.co.ke` under *Authorised JavaScript origins* for the existing client ID
   (the origin is unchanged, so this may already be done).
3. **Semester settings** — edit `APP_CONFIG` in `public/js/config.js` (academic year, semester end date used for calendar recurrence, search notice).
   Set `searchNotice` to `''` to hide the “search will be back shortly” banner.

## What lives where
| File | Responsibility |
|---|---|
| `config.js` | Supabase URLs/anon keys, Google client ID, semester config, logo sources |
| `supabase.js` | unit DB fetch + 30-min cache, exam DB, command-palette search (↑/↓/Enter/Esc, Ctrl/⌘+K) |
| `exporter.js` | lazy jsPDF + autotable (ESM, CDN fallback), PDF for all modes, PNG via html2canvas |
| `gcal.js` | Google Identity token client, Calendar create/update/delete/import, holiday skipping |
| `app.js` | shared helpers, class mode + weekly grid, tab navigation, quick-action bar, bootstrap |
| `exam.js` · `study.js` · `planner.js` | exam mode · group + personal study/CAT · personal planner |
| `commentary.js` | schedule-aware comments, jokes, health tips, quotes |

## Notes
* Share links: `?units=…`, `?exam=…`, `?group=…`, `?personal=…` (unchanged format). `?mode=exam` or `#exam` opens a tab directly.
* Drafts autosave in `localStorage` (`mts_draft_*`); colours in `mts_unit_colors`; theme in `mts_theme`.
* Dark mode follows the OS; the header button overrides it.
