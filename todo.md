# TODO

Tasks are grouped by phase. Work top to bottom; a later phase may depend on decisions made in an earlier one.
When a task is finished, move it to `completedTasks.md` (with the date) and remove it from here.

## Where we are

- Phase 1 is done except the install/offline check below. GitHub Pages deploy works (live site confirmed 2026-10-18).
- Phase 2: validator, ingestion, `check-references` and the `generate-quiz` skill (with an independent blind-answer check and an append mode for existing sets) are done. First real .docx quiz made (EPSO); waiting on the user's review and a real .csv. Next: the user puts a real .docx and .csv into `documents/` and we test the skill on them together.
- Test files from the dry run (fictional): `documents/Prirucnik zastite.docx`, `documents/Pojmovi cp1250.csv`, `documents/Pitanja.csv` (+ `documents/extracted/`) and `quizzes/test-*.json`. Handy as sample imports for Phase 3; delete them whenever.
- **Waiting on the user:** install the app on Windows and Android and test offline (first task below). It doesn't block other work, so carry on with Phase 2 and ask how it went now and then.

## Phase 1 — Project setup

- [ ] Verify the deployed app installs and works offline on Windows (Edge) and Android (Chrome)
  - Done: Pages enabled, deploy workflow green, https://m-e-7.github.io/JopaQuizProject/ loads (2026-10-18)
  - Still to do (user): install it on both devices, then check that it opens offline (airplane mode)
  - After the version-label commit is deployed, the footer hash on each device should match the latest commit on `main` (after two launches)

## Phase 2 — Question generation

- [ ] Test the skill on a first real .docx and a first real .csv and review question quality together
  - .docx done 2026-10-18: `quizzes/epso-verbalno-zakljucivanje.json` (52 questions, blind check 52/52). **Waiting on the user** to review the questions. Still to do: a real .csv
  - Idea from that run: when a document's rule goes against common sense, the question should say "according to the document" ("prema skripti")
  - Also check the ingestion output against the real files (so far only tested on generated documents, not ones saved by Word/Excel)
  - Adjust `.claude/skills/generate-quiz/SKILL.md` from what we learn (question count, distractor quality, tags)

## Phase 3 — Core app

- [ ] Platform interface for storage and file import (`QuizStorage` etc.) so a native wrapper can be swapped in later
- [ ] IndexedDB implementation of the storage interface; request persistent storage (`navigator.storage.persist()`)
- [ ] "Import quiz from file": `<input type="file" accept=".json">` → `parseQuizJson()` from `app/src/quiz/validate.ts` → store in IndexedDB; show errors/warnings to the user
  - Update `GUIDE.txt` section 5 (currently marked "not built yet")
  - First time Ajv is in the production bundle: check that `npm run build` output works in `app-preview`, and note the bundle size
- [ ] List imported quiz sets; delete or replace a quiz set (re-import of the same id)
- [ ] Question screen: question text + 4 options
- [ ] Answer feedback: mark right/wrong, highlight the correct option, show the explanation
- [ ] Show the source reference for the question (location + quoted passage / row)
- [ ] Score tracking: count of correct and wrong answers during a quiz
- [ ] End-of-quiz summary (score, percentage, list of missed questions)
- [ ] Shuffle question order and option order
- [ ] Save score history per quiz set locally (date, right, wrong, missed question ids)
  - Version the IndexedDB schema from the start so later app updates can migrate stored data (see "Updating the app" in `CLAUDE.md`)
  - On re-import of a set, ignore (don't show, don't count) history entries for question ids that are in the set's `removedQuestionIds` or no longer exist
- [ ] "Retry missed questions" mode (uses the saved history)

## Phase 4 — Nice to have

- [ ] App update notice ("new version available" → reload); switch `registerType` to `'prompt'` in `app/vite.config.ts`
- [ ] Choose number of questions per run / filter by topic
- [ ] Statistics per quiz set over time
- [ ] Layout that works well on both phone and desktop window sizes
- [ ] Manual light/dark toggle (the app already follows the system theme via `prefers-color-scheme` in `app/src/index.css`)
