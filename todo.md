# TODO

Tasks are grouped by phase. Work top to bottom; a later phase may depend on decisions made in an earlier one.
When a task is finished, move it to `completedTasks.md` (with the date) and remove it from here.

## Where we are

- Phase 1 is done except the install/offline check below. GitHub Pages deploy works (live site confirmed 2026-10-18).
- Phase 2: validator, ingestion, `check-references` and the `generate-quiz` skill (with an independent blind-answer check and an append mode for existing sets) are done. First real .docx quiz made (EPSO), regenerated as practice items after the user's review (the skill now picks fact questions or practice items by document kind); waiting on the user's review and a real .csv. Next: the user puts a real .docx and .csv into `documents/` and we test the skill on them together.
- Test files from the dry run (fictional): `documents/Prirucnik zastite.docx`, `documents/Pojmovi cp1250.csv`, `documents/Pitanja.csv` (+ `documents/extracted/`) and `quizzes/test-*.json`. Handy as sample imports; delete them whenever.
- Phase 3: platform layer (`app/src/platform/`, IndexedDB via `idb`) and "Import quiz from file" (with the quiz list and replace) are done. Next: delete a quiz set, then the question screen. Once deployed, the user can import the EPSO quiz on their devices.
- **Waiting on the user:** offline check on Windows (installed there), install + offline check on Android (first task below). It doesn't block other work, so carry on with Phase 2 and ask how it went now and then.

## Phase 1 — Project setup

- [ ] Verify the deployed app installs and works offline on Windows (Edge) and Android (Chrome)
  - Done: Pages enabled, deploy workflow green, https://m-e-7.github.io/JopaQuizProject/ loads (2026-10-18)
  - Installed on Windows (user confirmed 2026-10-18)
  - Still to do (user): offline check on Windows; install on Android + offline check (airplane mode)
  - After the version-label commit is deployed, the footer hash on each device should match the latest commit on `main` (after two launches)

## Phase 2 — Question generation

- [ ] Test the skill on a first real .docx and a first real .csv and review question quality together
  - .docx done 2026-10-18: `quizzes/epso-verbalno-zakljucivanje.json`. First version (52 recall questions about the guide) replaced the same day by 34 practice items (passage + 4 statements, one per rule; blind check 34/34) after the user's review. **Waiting on the user** to review the practice items. Still to do: a real .csv
  - Idea from that run: when a document's rule goes against common sense, the question should say "according to the document" ("prema skripti")
  - Also check the ingestion output against the real files (so far only tested on generated documents, not ones saved by Word/Excel)
  - Adjust `.claude/skills/generate-quiz/SKILL.md` from what we learn (question count, distractor quality, tags)

## Phase 3 — Core app

- [ ] Delete a quiz set (with its score history, after a confirmation)
  - Already done with the import task: the list of imported sets (title, question count, import date) and replace on re-import of the same id
  - Test a real file pick on Windows and Android (the browser pane can't open native file dialogs), incl. that Android shows .json files from Downloads/Drive
- [ ] Question screen: question text + 4 options
  - Question text can hold several paragraphs separated by `\n\n` (practice items: a ~60–130-word passage, then the question). Render with `white-space: pre-line`, and keep the passage readable and scrollable on a phone with the options below it
- [ ] Answer feedback: mark right/wrong, highlight the correct option, show the explanation
- [ ] Show the source reference for the question (location + quoted passage / row)
- [ ] Score tracking: count of correct and wrong answers during a quiz
- [ ] End-of-quiz summary (score, percentage, list of missed questions)
- [ ] Shuffle question order and option order
- [ ] Save score history per quiz set locally: `platform.storage.addRun()` with per-question results; right/wrong/missed derived by small pure functions
  - On re-import of a set, ignore (don't show, don't count) history entries for question ids that are in the set's `removedQuestionIds` or no longer exist
- [ ] "Retry missed questions" mode (uses the saved history)

## Phase 4 — Nice to have

- [ ] App update notice ("new version available" → reload); switch `registerType` to `'prompt'` in `app/vite.config.ts`
- [ ] Choose number of questions per run / filter by topic
- [ ] Statistics per quiz set over time
- [ ] Layout that works well on both phone and desktop window sizes
- [ ] Manual light/dark toggle (the app already follows the system theme via `prefers-color-scheme` in `app/src/index.css`)
