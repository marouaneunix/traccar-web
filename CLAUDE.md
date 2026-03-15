# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development server (proxies /api/* to localhost:8082)
npm start           # or: vite --host

# Production build (output: build/)
npm run build

# Linting
npm run lint
npm run lint:fix
```

> There is no test suite — the CI pipeline only runs build and lint.

The dev server runs on port 3000. It requires a [Traccar server](https://www.traccar.org) running on port 8082 for the API backend. The vite config proxies `/api/*` to `http://localhost:8082` and `/api/socket` to `ws://localhost:8082`.

## Architecture

**Stack:** React 19, Vite 8, Material UI 7, Redux Toolkit, React Router v7, MapLibre GL 5, tss-react (CSS-in-JS).

### App Bootstrap (`src/index.jsx` → `src/App.jsx`)

`index.jsx` wraps everything in Redux Provider, BrowserRouter, LocalizationProvider, AppThemeProvider, and ServerProvider. `App.jsx` handles the auth flow and renders runtime controllers as siblings to the route outlet:
- `SocketController` — WebSocket connection to the backend
- `CachingController` — pre-fetches reference data (geofences, groups, drivers, etc.)
- `UpdateController` / `MotionController` — periodic state syncing

### Routing (`src/Navigation.jsx`)

All routes are defined here. Main sections:
- `/` — live map dashboard (`MainPage`)
- `/settings/*` — admin/config pages (devices, users, groups, commands, etc.)
- `/reports/*` — report pages (trips, events, routes, charts, etc.)
- `/replay`, `/geofences`, `/emulator`, `/position/:id`, `/event/:id`

### Redux Store (`src/store/`)

Slices: `session`, `devices`, `events`, `motion`, `geofences`, `groups`, `drivers`, `maintenances`, `calendars`, `errors`. A custom `throttleMiddleware` batches high-frequency device updates from the WebSocket.

### Map (`src/map/`)

MapLibre GL integration split into:
- `core/` — map initialization, layer management, source helpers
- `draw/` — geofence drawing tools (uses MapBox GL Draw)
- `geocoder/` — location search
- `switcher/` — base map style switcher
- `overlay/`, `legend/`, `notification/` — UI overlays

The main map view lives in `src/main/MainMap.jsx`.

### Shared Utilities (`src/common/`)

- `components/` — reusable UI components (tables, dialogs, form fields, etc.)
- `attributes/` — device attribute definitions used across settings and reports
- `theme/` — MUI theme config
- `util/` — helpers (formatting, distance/speed conversions, permissions, etc.)

### Settings & Reports pages

Settings pages (`src/settings/`) follow a consistent pattern: a list page + an edit page per entity (e.g. `DevicesPage.jsx` + `DevicePage.jsx`). Reports pages (`src/reports/`) share components from `src/reports/components/`.

### i18n

Translation files are in `src/resources/l10n/`. The app uses a custom `useTranslation` hook from `src/common/components/LocalizationProvider.jsx`.

## Code Style

- ESLint flat config (`eslint.config.js`) with `@eslint-react`, `eslint-plugin-import-x`, `react-hooks`, and `prettier`
- Prettier: single quotes, 100-char print width (`.prettierrc.json`)
- `legacy-peer-deps=true` is set in `.npmrc` — use `npm` not `pnpm` (or pass the flag manually)
