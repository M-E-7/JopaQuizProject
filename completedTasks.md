# Completed tasks

Newest first.

## 2026-10-18

- Wrote the quiz validator (shared module + command line), user's choice of architecture
  - `app/src/quiz/validate.ts`: `parseQuizJson()` / `validateQuizSet()` — Ajv 2020 (+ `ajv-formats` for `date-time`) against `schema/quiz-set.schema.json`, then cross-field rules: unique question/source ids, `sourceId` exists, unused sources (warning), location type vs. source type (warning), options differing only in case/spacing (warning). Friendly errors for non-quiz files, newer `formatVersion`, invalid JSON, BOM tolerated; `location` oneOf errors reduced to the shape named by `type`
  - `app/src/quiz/types.ts`: TypeScript types for format v1
  - `app/scripts/validate-quiz.ts` + `npm run validate-quiz -- <files|folders>`: run directly by Node 24 type stripping, exit 1 on errors; `tsconfig.scripts.json` added; Vite `server.fs.allow` extended to `../schema`; deploy workflow now also triggers on schema changes
  - Verified: build + lint pass; example quiz OK; 18 broken variants (wrong option count, duplicates, unknown/unused source, bad location, typo property, bad date, newer version, not a quiz, broken JSON, BOM, missing file) each give the expected error/warning; in the dev server the same module validates in the browser, and `documents/` stays blocked (403). Not yet checked: Ajv inside the production bundle (the app doesn't import the validator until Phase 3)
- Added the app version label: small muted footer `2026-10-18 · a5a8217` (UTC build date · short commit hash)
  - Injected via Vite `define` in `app/vite.config.ts` (`__BUILD_DATE__`, `__COMMIT__`): `GITHUB_SHA` in CI, `git rev-parse --short HEAD` locally, `dev` fallback; types in `app/src/build-info.d.ts`
  - Versioning rule (user's choice): no manual version number; `version` in `app/package.json` stays unused
  - Verified: build + lint pass; in the preview build the footer shows today's date and the HEAD hash, readable in light and dark
- Confirmed the GitHub Pages deploy: Pages enabled by the user, https://m-e-7.github.io/JopaQuizProject/ serves the app- Added GitHub Actions deploy workflow `.github/workflows/deploy.yml` and documented deploying in `CLAUDE.md`
  - Push to `main` touching `app/**` (or manual run) → `npm ci`, lint, build → GitHub Pages
  - Uses the current official action majors: checkout v7, setup-node v7 (Node 24, npm cache), configure-pages v6, upload-pages-artifact v5, deploy-pages v5
  - Verified locally: YAML parses, the same `npm ci` → lint → build steps pass from a clean install. The workflow itself has not run on GitHub yet.
- Set Vite `base` to `/JopaQuizProject/` for GitHub Pages (repo `M-E-7/JopaQuizProject` → https://m-e-7.github.io/JopaQuizProject/)
  - Verified: all asset/icon/manifest URLs, manifest `start_url`/`scope` and service-worker scope use the prefix; app loads and works offline under `/JopaQuizProject/` in the preview build
- Added PWA support with `vite-plugin-pwa` 2
  - Web manifest (name, theme/background colour, standalone display, 64/192/512 + maskable icons)
  - Workbox service worker precaching the whole app shell (13 entries), `autoUpdate` registration
  - App icon `public/favicon.svg` + generated PNG/ICO/Apple/maskable icons via `@vite-pwa/assets-generator` (`npm run generate-pwa-assets`)
  - `index.html`: theme-color, description, favicon and apple-touch-icon links; `app-preview` launch config added
  - Verified: build + lint pass, 0 vulnerabilities; service worker activates and controls the page; with the server stopped the app still loads from cache
- Scaffolded the app in `app/` (create-vite 9, `react-ts` template: Vite 8, React 19, TypeScript 6, oxlint)
  - Package renamed to `jopa-quiz`; Vite demo content, assets and the duplicate `app/.gitignore` removed
  - Placeholder "JopaQuiz" page with light/dark theme tokens and a simple "?" favicon
  - Added `.claude/launch.json` (`app-dev` on port 5173); dev/build commands documented in `CLAUDE.md`
  - Verified: `npm run build` and `npm run lint` pass, 0 vulnerabilities, page renders in the dev server with no console errors
- Created folder structure and `.gitignore`
  - `documents/` and `quizzes/` with READMEs; all other content in them is gitignored (verified with `git check-ignore`)
  - `.gitignore` also covers `node_modules/`, `dist/`, `dev-dist/`, `.env*`, `*.local`, logs, `.claude/settings.local.json`, OS clutter
  - `app/` is left to the scaffold task (Vite creates it)
- Defined the quiz file format v1: `schema/quiz-set.schema.json`, `schema/README.md`, `schema/examples/example-quiz.json`
  - Multiple source documents per set, required explanation, optional tags, `section` / `row` / `page` reference locations
  - Example validated against the schema (strict mode) and 9 invalid variants confirmed rejected
- Chose tech stack: PWA (React + TypeScript + Vite) on GitHub Pages (public repo); documents/quizzes kept out of git
  - Why: no hosting cost, nothing to sideload, automatic updates on every device, easy to share with other people via a link; only Node needed to build
- Resolved initial design questions (reference display, delivery, scores, language, source formats)
- Created project planning files: `todo.md`, `CLAUDE.md`, `completedTasks.md`
