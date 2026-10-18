# TODO

Tasks are grouped by phase. Work top to bottom; a later phase may depend on decisions made in an earlier one.
When a task is finished, move it to `completedTasks.md` (with the date) and remove it from here.

## Phase 0 — Decisions

- [ ] **Choose the tech stack** (JS/TS family; must run on Windows and Android, personal use, no store publishing)
  - Compare candidates: PWA (installable web app), Capacitor (web app → Android APK; PWA or Electron for Windows), Tauri 2 (Windows + Android), React Native (+ React Native Windows)
  - Criteria: one codebase for both platforms, runtime file picker for importing quiz JSON, reliable local storage for score history, easy APK sideloading, dev tooling on Windows, how easy it is for Claude to build/test
  - Record the decision and reasoning in `CLAUDE.md`
- [ ] **Define the question file format** (JSON)
  - Quiz-set metadata: id, title, source document (file name + type), language, created date, format version
  - Question fields: id, question text, 4 options, index of the correct option, short explanation
  - `sourceReference` that works across document types:
    - `location.type`: `"section" | "row" | "page"`
    - docx → heading path (e.g. `["Chapter 2", "Safety"]`) + verbatim quote
    - csv → row number, column name(s), cell text
    - page → page number + quote (for PDFs later)
  - Optional fields: tags/topic, difficulty
  - Write a JSON Schema file and one hand-written example quiz (one docx-style and one csv-style reference)

## Phase 1 — Project setup

- [ ] Create folder structure (e.g. `documents/` for source docs, `quizzes/` for generated JSON, `schema/`, `app/` for the application)
- [ ] Scaffold the app with the chosen stack
- [ ] Verify a "hello world" build runs on Windows
- [ ] Verify a "hello world" build installs and runs on Android (sideloaded APK)
- [ ] Document build/run commands for both platforms in `CLAUDE.md`

## Phase 2 — Question generation

- [ ] Write a validation script that checks quiz JSON against the schema (exactly 4 options, exactly one correct, unique ids, reference present)
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

- [ ] "Import quiz from file": file picker → validate against the schema → store locally
- [ ] List imported quiz sets; delete or replace a quiz set (re-import of the same id)
- [ ] Question screen: question text + 4 options
- [ ] Answer feedback: mark right/wrong, highlight the correct option, show the explanation
- [ ] Show the source reference for the question (location + quoted passage / row)
- [ ] Score tracking: count of correct and wrong answers during a quiz
- [ ] End-of-quiz summary (score, percentage, list of missed questions)
- [ ] Shuffle question order and option order
- [ ] Save score history per quiz set locally (date, right, wrong, missed question ids)
- [ ] "Retry missed questions" mode (uses the saved history)

## Phase 4 — Nice to have

- [ ] Choose number of questions per run / filter by topic
- [ ] Statistics per quiz set over time
- [ ] Layout that works well on both phone and desktop window sizes
- [ ] Dark mode
