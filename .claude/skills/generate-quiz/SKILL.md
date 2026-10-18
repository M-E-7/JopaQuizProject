---
name: generate-quiz
description: Generates a JopaQuiz quiz set (4-option multiple-choice questions as JSON in quizzes/) from source documents in documents/ (.docx, .csv). Use this whenever the user wants quiz questions, a quiz, test questions or practice questions made from a document or file, wants to turn a CSV of questions or terms into a quiz, or mentions a file in documents/ together with questions, even if they don't name the skill or the file format.
argument-hint: <file(s) in documents/> [number of questions] [quiz id]
---

# Generate a quiz from documents

The output is one quiz file, `quizzes/<quiz-id>.json`, in the format described in `schema/README.md`. People import it into the JopaQuiz app on their phone or PC and answer the questions **without the document in front of them**. After each answer the app shows the explanation and the quoted passage from the source. So every question has to make sense on its own, have exactly one defensible answer, and point to the exact place in the document that proves it.

`documents/` and `quizzes/` are private and gitignored, and the repo is public. Never commit or copy their contents anywhere else, and don't paste long stretches of a document into the chat.

## 1. Settle the inputs

- **Documents:** the files the user named, in `documents/`. If none were named, list what's there and ask. Several documents can go into one quiz set when the user asks for that; each becomes one entry in `sources`.
- **Number of questions:** if the user gave a number, use it. Otherwise cover the document: one question per distinct, testable fact (see step 3). If that comes to more than about 60, say how many it would be and ask before writing.
- **Quiz id:** a lowercase ASCII slug from the document's name or topic (`zastita-na-radu`, `safety-glossary`), unless the user gave one. If `quizzes/<id>.json` already exists, stop and ask. Score history on devices is tied to question ids, so an existing set must not be silently overwritten. Adding questions to an existing set is a separate workflow that isn't supported yet.

## 2. Extract the documents

Run from the repo root, once per document (quote paths with spaces):

```bash
npm --prefix app run ingest -- "documents/<file>"
```

This writes `documents/extracted/<file>.md` and `.json`. Read the `.md` completely, in chunks if it's long. It is your working copy of the document:

- `.docx`: each section shows `headingPath: [...]`, and every paragraph, list item or table row has a number `[pN]`, counted from 1 within its section.
- `.csv`: every row shows `[row N] Column: value | Column: value`, already in the quote format. The header line shows the columns and a **shape** guess (`qa`, `facts` or `unknown`).

Check the **Notes** at the top:
- Encoding fallback: if letters look wrong (e.g. `Znaèenje` instead of `Značenje`), run ingest again with `--encoding windows-1252` or another encoding.
- Images, footnotes or text boxes not extracted: questions can't use them. Mention this in the final report.
- No headings found: references then use `headingPath: []` plus the paragraph number. That's fine.

## 3. Choose what to ask

Go through the document section by section (or row by row) and list the facts worth knowing: rules, numbers, intervals, responsibilities, definitions, conditions, steps, reasons. Skip what nobody would want to be tested on: tables of contents, revision history, addresses, signatures, boilerplate.

- One fact gives one question. Don't write two questions where one gives away the other's answer.
- Mix: mostly **recall** (what / when / how often / who / which), plus roughly a quarter **understanding** questions where the document gives a reason or a rule that can be applied ("Why…", "In which situation…", "A worker does X; what must they do?"). An understanding question still needs its answer clearly supported by one quoted passage. Don't build it on inferences the text doesn't make.
- The question must require the document. If common sense alone picks the right option, it's not a useful question.

## 4. Write the questions

Write in the language of the document. Set `language` to its tag (`hr`, `en`, …). The question, options and explanation all use that language.

**Question:** clear and self-contained, since the player can't see the section heading. Name the context when it matters ("According to the safety manual, how often…", "U zoni B…"). Avoid negative questions ("Which is NOT…"). They are easy to misread and often have more than one defensible answer.

**Options:** exactly 4, all different, exactly one correct.
- Wrong options should be plausible: the same kind of thing as the right answer, similar length and form. The best ones come from the document itself: other zones, other intervals, other roles, other terms from the same table.
- No "all of the above", "none of the above" or joke options, and no option that is also partly true according to the document.
- Watch for give-aways. The right answer shouldn't be the only long or detailed one, the only one that repeats words from the question, or the only one that sounds like the document.
- Spread `correctIndex` across 0–3 roughly evenly, with no long runs. The app shuffles options, but a skewed file suggests carelessness.

**Explanation:** 1–2 sentences on why the answer is right, adding context from the document if useful. Don't just repeat the correct option.

**Reference:** copy it from the extracted `.md`. Never write it from memory:
- `.docx`: `{"type": "section", "headingPath": [...exactly as shown...], "paragraph": N}`. The quote is a **verbatim, contiguous** piece of that one paragraph: the shortest passage that proves the answer, usually one sentence, at most two or three. Don't paraphrase or shorten with "…". For table rows, quote the cells as shown (`Prah | svaki mjesec`). For a single list item, quote its text without the label (`3.`).
  - When the proof is a short list split into items (an intro line plus items), the quote may run over those consecutive paragraphs. Set `paragraph` to the first one, copy each one in order with its label, and put `\n` between them: `"Provjeriti oštećenja:\na) šavove\nb) prste"`. Keep this for genuine lists, not for stitching together distant sentences.
- `.csv`: `{"type": "row", "row": N, "columns": [...]}`. The quote is the `Column: value` parts for exactly those columns, copied from that row's line and joined with ` | `. Normally that's the column the question is about plus the column holding the answer. When the answer column holds only a letter (`Točan odgovor: A`), also include the option column it points to, so the quote shows the actual answer.

**Tags:** 1–2 lowercase ASCII slugs per question for the topic, usually from the top-level section (`zastitna-oprema`, `pozar`). Use the same tags consistently across the set, because the app will later filter by topic.

**Ids:** `q0001`, `q0002`, … in order, without gaps.

### CSV files

- **Shape `qa`** (the file already has questions): make one quiz question per row.
  - Keep the user's wording and fix only obvious typos.
  - If the file has answer options (e.g. columns A–D), use them as they are and map the correct letter or text to `correctIndex`.
  - If it only has the answer, write three wrong options, preferably from other rows' answers.
  - Rows that can't become a sound 4-option question (an ambiguous answer, a yes/no question) should be skipped and listed in the report, not forced.
- **Shape `facts`** (e.g. term → definition): build questions from the rows. Ask either direction ("What does X mean?" or "Which term means …?"), but not both directions for the same row. The other rows are the best source of wrong options.
- **Shape `unknown`**: look at the content, decide how to treat it, and say what you decided in the report.

## 5. Write the file

Write `quizzes/<id>.json` (UTF-8) with:

```json
{
  "format": "jopa-quiz",
  "formatVersion": 1,
  "id": "<id>",
  "title": "<short title in the document's language>",
  "description": "<optional: one sentence on what it covers>",
  "language": "<hr|en|…>",
  "createdAt": "<now, UTC, e.g. 2026-10-18T14:00:00Z>",
  "sources": [
    { "id": "<slug>", "fileName": "<exact file name in documents/>", "type": "docx|csv", "title": "<document title, if any>" }
  ],
  "questions": [ … ]
}
```

`schema/examples/example-quiz.json` shows complete questions of both kinds. `fileName` must match the file in `documents/` exactly, because the reference check uses it to find the extracted text.

## 6. Check and fix

Run both checks from the repo root and fix every error. Repeat until both are clean:

```bash
npm --prefix app run validate-quiz -- quizzes/<id>.json
npm --prefix app run check-references -- quizzes/<id>.json
```

- `validate-quiz` checks the format: 4 unique options, ids, required fields, sources. Read its warnings too. Options that differ only in case, or a location type that doesn't fit the source, are almost always mistakes.
- `check-references` confirms every quote appears verbatim at its stated location. When a quote exists elsewhere it says where (`it is at [...] [p3]`). Then decide whether the location or the quote is wrong. Don't just accept the suggestion if it means the reference no longer supports the answer.

Then read the whole quiz once more as a player who hasn't seen the document:
- Is exactly one option defensibly right?
- Could any wrong option also be true according to the document?
- Is any question answerable by guessing or common sense?
- Does each quote really prove the answer?

Fix what you find, then run both checks again.

## 7. Report

Tell the user, briefly:
- the file written (`quizzes/<id>.json`), the number of questions, and the split between recall and understanding
- what was covered, and what was skipped and why: sections with nothing testable, rows that didn't fit, images or footnotes the ingestion couldn't read
- 2–3 sample questions with their correct answers, so they can judge quality at a glance
- that the file stays on this PC (gitignored); to use it, copy it to the device and import it in the app
