# TODO

Tasks are grouped by phase. Work top to bottom; a later phase may depend on decisions made in an earlier one.
When a task is finished, move it to `completedTasks.md` (with the date) and remove it from here.

## Where we are

- Phase 1 is done: deployed on GitHub Pages, installed and working offline on Windows and Android, file import works on both (2026-10-18).
- Phase 2: validator, ingestion, `check-references` and the `generate-quiz` skill (with an independent blind-answer check and an append mode for existing sets) are done. First real .docx quiz made (EPSO), regenerated as practice items after the user's review (the skill now picks fact questions or practice items by document kind); waiting on the user's review and a real .csv. Next: the user puts a real .docx and .csv into `documents/` and we test the skill on them together.
- Test files from the dry run (fictional): `documents/Prirucnik zastite.docx`, `documents/Pojmovi cp1250.csv`, `documents/Pitanja.csv` (+ `documents/extracted/`) and `quizzes/test-*.json`. Handy as sample imports; delete them whenever.
- Phase 3: platform layer (`app/src/platform/`, IndexedDB via `idb`), "Import quiz from file" (with the quiz list and replace) and the question screen with answer feedback and the source reference (document, location, quote) are done — quizzes can be played (file order, running score + progress bar, end-of-quiz summary with missed questions and Start again, nothing saved yet) and deleted (with their history, after a confirmation). Next: shuffle question and option order. Study/Exam modes are planned after score history (resuming an interrupted run is a Phase 4 follow-up).
- **Waiting on the user:** trying Delete on the devices once it's deployed (first Phase 3 task). It doesn't block other work, so skip it and ask how it went now and then.

## Phase 1 — Project setup

All done.

## Phase 2 — Question generation

- [ ] Test the skill on a first real .docx and a first real .csv and review question quality together
  - .docx done 2026-10-18: `quizzes/epso-verbalno-zakljucivanje.json`. First version (52 recall questions about the guide) replaced the same day by 34 practice items (passage + 4 statements, one per rule; blind check 34/34) after the user's review. **Waiting on the user** to review the practice items. Still to do: a real .csv
  - Idea from that run: when a document's rule goes against common sense, the question should say "according to the document" ("prema skripti")
  - Also check the ingestion output against the real files (so far only tested on generated documents, not ones saved by Word/Excel)
  - Adjust `.claude/skills/generate-quiz/SKILL.md` from what we learn (question count, distractor quality, tags)

## Phase 3 — Core app

- [ ] Try Delete on the deployed app on Windows and Android (user; checked in the browser pane only so far)
- [ ] Shuffle question order and option order
- [ ] Save score history per quiz set locally: `platform.storage.addRun()` with per-question results; right/wrong/missed derived by small pure functions
  - On re-import of a set, ignore (don't show, don't count) history entries for question ids that are in the set's `removedQuestionIds` or no longer exist
- [ ] Study and Exam modes: after tapping a quiz, the user picks **Study** or **Exam**
  - Study = today's quiz screen (all questions, one tap answers, ✓/✗ + explanation at once)
  - Exam = a random selection of N questions with a time limit; settings per quiz set, adjustable on the mode-choice screen
    - Defaults: 20 questions (all, if the set has fewer) and 20 minutes; time is set on its own, not derived from the question count
    - No feedback while answering; free navigation (Previous / Next, overview of answered / unanswered, "Hand in" — confirms if some are unanswered)
    - Visible countdown; at 0 the exam is handed in automatically, unanswered questions count as missed
    - End-of-exam summary (reuses the end-of-quiz summary): score, time used, missed questions with explanations
  - Score history saves both modes: each run records its mode; exam runs also keep time used and the settings used
  - Exam settings are stored on the device per quiz set (IndexedDB → bump `DB_VERSION` + upgrade step); kept when the set is replaced by re-import, deleted with the set
  - Closing / reloading mid-run loses the run (as today); resuming is a separate task (Phase 4)
- [ ] "Retry missed questions" mode (uses the saved history)

## Phase 4 — Nice to have

- [ ] App update notice ("new version available" → reload); switch `registerType` to `'prompt'` in `app/vite.config.ts`
- [ ] Filter questions by topic (tags) (the number of questions per run is covered by Exam mode in Phase 3)
- [ ] Resume an interrupted Study or Exam run after the app was closed or reloaded (save the in-progress run on the device; exam clock keeps running in real time while closed)
- [ ] Statistics per quiz set over time
- [ ] Layout that works well on both phone and desktop window sizes
- [ ] Manual light/dark toggle (the app already follows the system theme via `prefers-color-scheme` in `app/src/index.css`)
