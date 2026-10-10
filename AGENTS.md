# Repository Guidelines

## Project Structure & Module Organization

This repository contains the Traccar web interface, built with React, Vite, Material UI, Redux Toolkit, and MapLibre. The backend lives in a separate repository.

- `src/index.jsx` bootstraps the app; `src/Navigation.jsx` defines routes.
- `src/main/`, `src/login/`, `src/settings/`, `src/reports/`, and `src/other/` contain feature pages.
- `src/map/` contains map layers, controls, and drawing tools; `src/store/` contains Redux slices.
- `src/common/` holds shared components, utilities, attributes, and theme configuration.
- `src/resources/` contains images, audio, and translations in `l10n/`; `public/` holds static and PWA assets.
- `simple/index.html` provides a separate minimal interface. Generated production output goes to `build/`.

## Build, Test, and Development Commands

Use npm; `.npmrc` enables `legacy-peer-deps`.

- `npm ci`: install dependencies from `package-lock.json`, matching CI.
- `npm start`: start Vite on port 3000. Run a Traccar backend on `localhost:8082`; Vite proxies API and WebSocket requests there.
- `npm run build`: generate the production bundle in `build/`.
- `npm run lint`: check JavaScript, React, imports, and Prettier formatting.
- `npm run lint:fix`: apply automatic lint and formatting fixes; review the diff.
- `npm run generate-pwa-assets`: regenerate icons from `public/logo.svg`.

## Coding Style & Naming Conventions

Use ES modules, two-space indentation, semicolons, single quotes, and a 100-character print width. ESLint integrates Prettier through `eslint.config.js` and `.prettierrc.json`.

Use PascalCase for component filenames (`DevicePage.jsx`), camelCase for helpers, and `use` prefixes for hooks (`useFilter.js`). Follow existing Material UI and `tss-react` styling patterns. Add user-facing strings through the localization provider and translation resources.

## Testing Guidelines

No automated test suite, test naming convention, or coverage threshold is currently configured. CI runs build and lint; run both before submitting. Manually verify affected flows against a backend, including responsive layouts and map interactions where relevant. Describe verification steps in the pull request.

## Commit & Pull Request Guidelines

History uses concise, imperative subjects such as `Fix motion bar overflow`, with recent features using `feat:`. Keep commits focused and describe the resulting behavior.

Pull requests should explain the change, link relevant issues, and report build, lint, and manual verification results. Include screenshots for visible UI changes. Avoid unrelated formatting or generated build output.
