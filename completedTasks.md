# Completed tasks

Newest first.

## 2026-10-18

- Created the question-generation skill `.claude/skills/generate-quiz/SKILL.md` and `npm run check-references`
  - Skill workflow: settle inputs (never overwrite an existing set) → ingest → choose facts → write questions (rules for options, give-aways, explanations, verbatim references, tags, CSV shapes) → write `quizzes/<id>.json` → validate-quiz + check-references until clean → read as a player → report
  - Defaults (user): cover the document (ask if over ~60), mostly recall plus ~¼ understanding, Q&A CSVs keep wording and A–D options; tested by a dry run instead of formal skill-creator evals
  - `check-references`: loads `documents/extracted/<fileName>.json` per source; checks headingPath/paragraph or row/columns and that the quote is there (spacing and typographic quotes/dashes ignored; may span a list split into consecutive items); points to where a misplaced quote actually is; warns if the document changed after extraction
  - Verified: dry run on the fictional test documents: `quizzes/test-prirucnik-zastite.json` (docx, 5 questions) and `quizzes/test-pojmovi-i-pitanja.json` (two CSVs, 5 questions) pass both checks. 9 broken references (wrong paragraph/path/row/column, paraphrased quote, missing extracted file) are all reported with hints. Build + lint pass. The dry run led to two skill rules: list quotes spanning items, and including the option column for letter answers
- Document ingestion: `npm run ingest -- <files|folders> [--encoding x] [--out dir]` → `documents/extracted/<file>.md` + `.json`
  - Decisions (user): own .docx reader rather than mammoth; output files in `documents/extracted/`; mixed Croatian/English documents (CSV fallback encoding Windows-1250); test with generated files for now
  - Pluggable readers in `app/scripts/ingest/` (`readers.ts` registry, `docx.ts`, `csv.ts`, `model.ts`, `render.ts`); devDependencies fflate, @xmldom/xmldom, papaparse
  - .docx: sections with heading paths, numbered paragraphs, list items and table rows; headings by style name or outline level (works with localized style ids); Word auto-numbering rebuilt; images/text boxes/footnotes counted in notes; title from Title style
  - .csv: encoding (BOM, UTF-8, Windows-1250 fallback, `--encoding`), separator detection, spreadsheet row numbers kept across blank rows and multi-line cells, trailing empty columns dropped, shape guess qa/facts/unknown
  - Verified: tsc + lint + build pass; a generated Croatian .docx (title, text before first heading, 2-level numbered headings, numbered/lettered/bullet lists, hyperlink, merged table cell, image, footnote) extracts with correct heading paths and labels, and the same file with Croatian style ids (`Naslov1`) gives identical output; CSVs: Windows-1250 with `;` and a blank row, UTF-8 BOM with multi-line cell and trailing comma, Q&A with A–D + "Točan odgovor", Q&A detected by "?" cells, single column; broken .docx, unsupported type, unknown encoding and Word lock files handled. Not tested on files saved by real Word/Excel yet
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
