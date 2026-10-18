# TODO

Tasks are grouped by phase. Work top to bottom; a later phase may depend on decisions made in an earlier one.
When a task is finished, move it to `completedTasks.md` (with the date) and remove it from here.

## Where we are

- Phases 0 and 1 are done except the two tasks below. All work so far is committed (latest: deploy workflow).
- **Waiting on the user:** enable GitHub Pages and confirm the first deploy and the installs (first task below). The user was given a step-by-step guide; ask how it went before starting other work.

## Phase 1 — Project setup

- [ ] Verify the deployed app installs and works offline on Windows (Edge) and Android (Chrome)
  - User first: repo `M-E-7/JopaQuizProject` → Settings → Pages → Source: "GitHub Actions", then push and wait for the "Deploy to GitHub Pages" run to go green
  - Then: open https://m-e-7.github.io/JopaQuizProject/, install it, and check that it opens offline (airplane mode)
  - If the run fails, get the error lines from the Actions log and fix it
- [ ] Show an app version label (small, muted, e.g. footer: `v0.1.0 · 2026-10-18 · d94b146`)
  - Purpose: see which version each device is running, to confirm an update has arrived
  - Inject at build time via Vite `define` (e.g. `__APP_VERSION__`, `__BUILD_DATE__`, `__COMMIT__`): version from `app/package.json`, short commit hash from `GITHUB_SHA` in CI or `git rev-parse --short HEAD` locally (fallback `dev`)
  - Declare the globals' types in a `.d.ts` so `tsc` passes
  - Agree with the user on a versioning rule (e.g. bump `version` in `app/package.json` for every user-visible change) and record it in `CLAUDE.md`

## Phase 2 — Question generation

- [ ] Write a validation script: JSON Schema check against `schema/quiz-set.schema.json` plus the cross-field rules listed in `schema/README.md` (unique question/source ids, every `sourceId` exists, unused sources warned)
- [ ] Document ingestion (pluggable, one reader per format so new formats can be added later)
  - .docx → headings + paragraphs, keeping the heading path for references
  - .csv → header + rows, keeping row numbers for references
  - Detect CSV shape: fact table (e.g. term/definition) vs. ready-made Q&A rows
- [ ] Create the Claude skill for generating questions (`.claude/skills/generate-quiz/`)
  - Input: a document in `documents/`; output: a quiz JSON file in `quizzes/`
  - Questions written in the same language as the source document
  - Rules: one unambiguous correct answer, plausible distractors, correct option position varied, every question tied to a referenced passage/row, no questions answerable without the document
  - Q&A CSVs: convert existing questions and write the distractors; fact-table CSVs: build questions from the rows
  - Runs the validation script on its output
- [ ] Test the skill on a first real .docx and a first real .csv and review question quality together
- [ ] Support appending new questions to an existing quiz set without duplicates

## Phase 3 — Core app

- [ ] Platform interface for storage and file import (`QuizStorage` etc.) so a native wrapper can be swapped in later
- [ ] IndexedDB implementation of the storage interface; request persistent storage (`navigator.storage.persist()`)
- [ ] "Import quiz from file": `<input type="file" accept=".json">` → validate against the schema → store in IndexedDB
- [ ] List imported quiz sets; delete or replace a quiz set (re-import of the same id)
- [ ] Question screen: question text + 4 options
- [ ] Answer feedback: mark right/wrong, highlight the correct option, show the explanation
- [ ] Show the source reference for the question (location + quoted passage / row)
- [ ] Score tracking: count of correct and wrong answers during a quiz
- [ ] End-of-quiz summary (score, percentage, list of missed questions)
- [ ] Shuffle question order and option order
- [ ] Save score history per quiz set locally (date, right, wrong, missed question ids)
  - Version the IndexedDB schema from the start so later app updates can migrate stored data (see "Updating the app" in `CLAUDE.md`)
- [ ] "Retry missed questions" mode (uses the saved history)

## Phase 4 — Nice to have

- [ ] App update notice ("new version available" → reload); switch `registerType` to `'prompt'` in `app/vite.config.ts`
- [ ] Choose number of questions per run / filter by topic
- [ ] Statistics per quiz set over time
- [ ] Layout that works well on both phone and desktop window sizes
- [ ] Manual light/dark toggle (the app already follows the system theme via `prefers-color-scheme` in `app/src/index.css`)
