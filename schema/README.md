# Quiz file format (v1)

A quiz set is one JSON file, validated by [`quiz-set.schema.json`](quiz-set.schema.json) (JSON Schema 2020-12).
Example: [`examples/example-quiz.json`](examples/example-quiz.json).

## Structure

```jsonc
{
  "$schema": "../quiz-set.schema.json",   // optional, for editor autocomplete
  "format": "jopa-quiz",                  // always this value
  "formatVersion": 1,
  "id": "workplace-safety-basics",        // slug; re-importing the same id replaces the set
  "title": "Workplace safety basics",
  "description": "...",                   // optional
  "language": "en",                       // BCP 47 tag; same language as the documents
  "createdAt": "2026-10-18T12:00:00Z",
  "updatedAt": "2026-10-20T09:30:00Z",    // optional, set when questions are appended
  "sources": [
    { "id": "safety-manual", "fileName": "Safety manual.docx", "type": "docx", "title": "..." }
  ],
  "questions": [
    {
      "id": "q0001",
      "question": "In which zone is wearing a helmet mandatory at all times?",
      "options": ["Zone A", "Zone B", "Zone C", "Only in the loading bay"],
      "correctIndex": 1,
      "explanation": "Zone B has overhead cranes operating, so helmets are required there.",
      "reference": {
        "sourceId": "safety-manual",
        "location": { "type": "section", "headingPath": ["2. Protective equipment", "2.1 Helmets"] },
        "quote": "Helmets must be worn at all times in Zone B, ..."
      },
      "tags": ["ppe"]                     // optional
    }
  ]
}
```

## Rules

- **Exactly 4 options**, all different, **exactly one correct** (`correctIndex` 0–3). The app shuffles the display order, so the position in the file doesn't matter to the player. The generator still varies it.
- **Every question has an `explanation`** (1–2 sentences) and a **`reference`** with a verbatim `quote`.
- **Question ids** look like `q0001`, are unique within the set, and are **never renumbered or reused**. Score history refers to them. New questions get the next free number.
- **Source ids** and **tags** are lowercase slugs (`safety-manual`, `chapter-2`).
- Unknown properties are rejected, so typos are caught.

## Reference locations

| `location.type` | Used for | Fields |
|---|---|---|
| `section` | .docx, .md, .txt | `headingPath`: headings from top level down to the section (empty if none), optional `paragraph` (1-based within the section) |
| `row` | .csv | `row`: row number as shown in a spreadsheet app (header = row 1), `columns`: header names holding the answer |
| `page` | .pdf (later) | `page`, optional `headingPath` |

For CSV rows the `quote` is written as `Column: value | Column: value`.

## Validation

```bash
npm --prefix app run validate-quiz -- quizzes/my-quiz.json   # from the repo root
npm run validate-quiz -- ../quizzes                          # from app/: every .json in a folder
```

The script ([`app/scripts/validate-quiz.ts`](../app/scripts/validate-quiz.ts)) and the app's file import share the same code ([`app/src/quiz/validate.ts`](../app/src/quiz/validate.ts)). It prints one line per file plus each problem, and exits with 1 if any file has errors. Warnings don't fail a file.

First the file is checked against the schema. JSON Schema can't express the rules below, so they're checked afterwards, once the schema check passes:

- question ids are unique; source ids are unique
- every `reference.sourceId` exists in `sources`
- every source is referenced by at least one question (warning)
- `location.type` fits the source type: `row` for csv, `page` for pdf, `section` for docx/md/txt (warning)
- options that differ only in case or spacing, e.g. `Zone B` / `zone b` (warning; exact duplicates are a schema error)

A file whose `formatVersion` is newer than the validator knows gets a single "made for a newer app" error.

## Versioning

Breaking changes bump `formatVersion`. The app rejects versions it doesn't know.
