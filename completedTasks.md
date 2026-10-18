# Completed tasks

Newest first.

## 2026-10-18

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
