# TODO

Tasks are grouped by phase. Work top to bottom; a later phase may depend on decisions made in an earlier one.
When a task is finished, move it to `completedTasks.md` (with the date) and remove it from here.

## Phase 0 — Decisions

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

- [ ] Create folder structure (`documents/`, `quizzes/`, `schema/`, `app/`) and a `.gitignore` covering `documents/`, `quizzes/`, `node_modules/`, `dist/`
- [ ] Scaffold a Vite React + TypeScript app in `app/`
- [ ] Add `vite-plugin-pwa`: web app manifest, app icons, offline caching
- [ ] Set Vite `base` to `/<repo-name>/` for GitHub Pages
- [ ] Add a GitHub Actions workflow that builds `app/` and deploys it to GitHub Pages
  - User: create the public GitHub repo, push, and enable Pages (source: GitHub Actions)
- [ ] Verify the deployed app installs and works offline on Windows (Edge) and Android (Chrome)
- [ ] Document dev/build/deploy commands in `CLAUDE.md`

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
- [ ] "Retry missed questions" mode (uses the saved history)

## Phase 4 — Nice to have

- [ ] App update notice ("new version available" → reload)
- [ ] Choose number of questions per run / filter by topic
- [ ] Statistics per quiz set over time
- [ ] Layout that works well on both phone and desktop window sizes
- [ ] Dark mode
