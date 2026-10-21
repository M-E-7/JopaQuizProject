# TODO

Tasks are grouped by phase. Work top to bottom; a later phase may depend on decisions made in an earlier one.
When a task is finished, move it to `completedTasks.md` (with the date) and remove it from here.

## Where we are

- Phase 1 is done: deployed on GitHub Pages, installed and working offline on Windows and Android, file import works on both (2026-10-18).
- Phase 2: validator, ingestion, `check-references` and the `generate-quiz` skill (with an independent blind-answer check and an append mode for existing sets) are done. First real .docx quiz made (EPSO), regenerated as practice items after the user's review (the skill now picks fact questions or practice items by document kind); waiting on the user's review and a real .csv. Next: the user puts a real .docx and .csv into `documents/` and we test the skill on them together.
- Test files from the dry run (fictional): `documents/Prirucnik zastite.docx`, `documents/Pojmovi cp1250.csv`, `documents/Pitanja.csv` (+ `documents/extracted/`) and `quizzes/test-*.json`. Handy as sample imports; delete them whenever.
- Phase 3: platform layer (`app/src/platform/`, IndexedDB via `idb`), "Import quiz from file" (with the quiz list and replace) and the question screen with answer feedback and the source reference (document, location, quote) are done — quizzes can be played (questions and options shuffled each run, running score + progress bar, end-of-quiz summary with missed questions and Start again) and deleted (with their history, after a confirmation). Finished runs are saved per set (list shows the last score + run count, the summary shows "Last time"; removed questions don't count). Study and Exam modes are done (mode choice after Start; exam = random N questions, countdown, free navigation, hand in; DB v2 stores exam settings per set), exams can mark questions and end on a review page before handing in, and "Retry missed" replays the questions whose latest answer was wrong or unanswered. Next: Flash cards (new Phase 3 task, 2026-10-21) — start by discussing with the user how they should work; then Phase 4, starting with the app update notice.
- **Waiting on the user:** trying Delete on the devices once it's deployed (first Phase 3 task), and now also Study/Exam/Retry on a phone (timer, overview grid, number fields, Mark + review page, phone Back on the review page, Retry missed). Neither blocks other work, so skip them and ask how it went now and then.

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
- [ ] Flash cards — a new way to study a quiz set's content. **How they work is not decided yet: discuss with the user first** (e.g. what goes on the front and back, how cards come from the quiz/documents, self-rating and repetition, whether progress is saved) before writing any code

## Phase 4 — Nice to have

- [ ] App update notice ("new version available" → reload); switch `registerType` to `'prompt'` in `app/vite.config.ts`
- [ ] Filter questions by topic (tags) (the number of questions per run is covered by Exam mode in Phase 3)
- [ ] Resume an interrupted Study or Exam run after the app was closed or reloaded (save the in-progress run on the device; exam clock keeps running in real time while closed)
- [ ] Statistics per quiz set over time
- [ ] Layout that works well on both phone and desktop window sizes
- [ ] Manual light/dark toggle (the app already follows the system theme via `prefers-color-scheme` in `app/src/index.css`)
