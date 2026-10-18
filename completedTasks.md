# Completed tasks

Newest first.

## 2026-10-18

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
