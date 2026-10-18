---
name: generate-quiz
description: Generates a JopaQuiz quiz set (4-option multiple-choice questions as JSON in quizzes/) from source documents in documents/ (.docx, .csv). Use this whenever the user wants quiz questions, a quiz, test questions or practice questions made from a document or file, wants to turn a CSV of questions or terms into a quiz, or mentions a file in documents/ together with questions, even if they don't name the skill or the file format. Also use it to add questions to an existing quiz set in quizzes/ (more questions, an updated document, or another document joining the set).
argument-hint: <file(s) in documents/> [number of questions] [quiz id]
---

# Generate a quiz from documents

The output is one quiz file, `quizzes/<quiz-id>.json`, in the format described in `schema/README.md`. People import it into the JopaQuiz app on their phone or PC and answer the questions **without the document in front of them**. After each answer the app shows the explanation and the quoted passage from the source. So every question has to make sense on its own, have exactly one defensible answer, and point to the exact place in the document that proves it.

`documents/` and `quizzes/` are private and gitignored, and the repo is public. Never commit or copy their contents anywhere else, and don't paste long stretches of a document into the chat.

## 1. Settle the inputs

- **Documents:** the files the user named, in `documents/`. If none were named, list what's there and ask. Several documents can go into one quiz set when the user asks for that; each becomes one entry in `sources`.
- **Kind of questions:** decided by what the document is for (see the start of step 3): fact questions for reference material, practice items for a document that teaches a skill. Say which you chose and why in one line before writing; ask if it's unclear.
- **Number of questions:** if the user gave a number, use it. Otherwise cover the document: one question per distinct, testable fact, or for practice items one item per rule (see step 3). If that comes to more than about 60, say how many it would be and ask before writing.
- **Quiz id:** a lowercase ASCII slug from the document's name or topic (`zastita-na-radu`, `safety-glossary`), unless the user gave one. If `quizzes/<id>.json` already exists, or the user asks for more questions in an existing set, never overwrite it: score history on devices is tied to question ids. Ask whether to add to that set (follow **"Adding questions to an existing set"** at the end instead of steps 2–8) or to make a new set under another id.

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

First decide what kind of document it is, because that decides what the questions test:

- **Reference material**: manuals, regulations, procedures, glossaries, fact tables, Q&A CSVs. The player should *know* what it says. Write **fact questions** (the rest of this step and step 4).
- **A document that teaches a skill or method for a type of task**: an exam-prep guide ("how to solve verbal-reasoning items"), a technique handbook, a set of rules for judging something. The player should be able to *do* the task, not recite the guide. Write **practice items**: new tasks of the kind the document prepares for, solved with its rules (see "Practice items" in step 4). Don't ask about the guide's wording or definitions ("What does the guide call…?") unless the user asks for that.

### Fact questions

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

**Ids:** `q0001`, `q0002`, … in order, without gaps. (When adding to an existing set, new ids continue from the next free id; see the last section.)

### Practice items (documents that teach a skill)

Each item is a small task of the kind the document prepares for, in the same shape as the real task. The facts the player reasons about come from the item itself; the document only supplies the method. Everything above still applies (language, 4 unique options, one correct, reference, tags) except where this section says otherwise.

Example: an EPSO verbal-reasoning guide → each item is a short passage plus "Koja je od sljedećih izjava točna?" and four statements, of which only one follows from the passage.

**Coverage:** one item per rule the document teaches, usually one per (sub)section that states a rule, so that every rule is the *main* point of at least one item. Rules that are only "how to read faster" techniques (skimming, keyword spotting) don't get their own item. Ask first if that's over ~60.

**Question text:** the task material, then the question.
- Separate paragraphs with `\n\n` and put the question after a blank line too: `"<paragraph 1>\n\n<paragraph 2>\n\nKoja je od sljedećih izjava točna?"`.
- Keep the material short enough for a phone: about 60–130 words, 1–2 paragraphs, with enough concrete detail (figures, dates, conditions, named bodies) for the traps to work.
- Write it yourself: original, self-contained and realistic (for EPSO, EU and public-administration topics with invented but plausible figures). Never copy real exam items. Invented details are fine, because the item, not the real world, is the source of truth.
- Mostly ask for the statement that is correct / follows from the text. A "Koja je izjava u suprotnosti s tekstom?" stem is fine now and then if the real task uses it; then exactly one option is contradicted and the other three are true or merely unsupported.

**Options:** exactly one statement follows from the material according to the document's rules. Each wrong statement fails through **one identifiable trap the document teaches**: contradicted, or unsupported because of e.g. outside knowledge that is true in real life, a plausible "could be true", one added absolute or ranking word ("svi", "isključivo", "glavni"), a correct first half with an invented second half, a number applied to the wrong group, percent vs. percentage points, a goal or plan presented as a result, cause read into sequence or correlation, "may" turned into "must", a past fact put in the present, a generalised single case, a forgotten condition, a unit or order-of-magnitude slip.
- Use the item's main rule in at least one wrong option (or in what makes the right one right), and spread the other traps across the set so each appears several times.
- Vary what the correct statement looks like: a paraphrase, a small calculation (840 of 1,200 → "fewer than three quarters"), a weaker claim ("at least some"), a hedged claim, or a double statement where both halves hold. Don't let "the cautious one", "the longest one" or "the one using the text's own words" always be right; wrong options should echo the text's wording too.
- No wrong option may be defensible under the document's rules. If a strict reader could argue for it, change it.

**Explanation:** may be up to about three short sentences: why the correct statement follows, then the trap in each wrong statement in a few words ("Izjava o troškovima: nedostatak informacija; izjava s 'isključivo': restriktivnija od teksta; …"). **Never refer to options by letter** (A–D): the app shuffles them. Name a statement by its content.

**Reference:** the document's rule the item mainly tests: its `headingPath`, `paragraph` and a verbatim quote of the rule sentence (a "PRAVILO" box, the rule paragraph, or the matching row of a rules table). After answering, the player sees which rule decided the item. `check-references` and `quiz-coverage --unused` work as for fact questions, so the coverage tool shows which rules have no item yet.

**Tags:** one per rule area of the document (e.g. `brojevi`, `kolicine`, `uzrocnost`), used consistently across the set.

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

Then read the whole quiz once more: does each quote really prove the answer, and is any question answerable by guessing or common sense? Fix what you find, then run both checks again. Whether exactly one option is defensibly right is tested in step 7 by someone who doesn't know the answers, so you don't need to judge that yourself.

## 7. Independent check

You wrote the questions and know the intended answers, so your own review tends to confirm them. Have a fresh agent answer the quiz **blind** from the document instead, then compare its answers with yours.

Spawn a `general-purpose` agent (Agent tool, no model override, wait for its result) with the prompt below. Fill in the quiz path. For more than about 40 questions, split the set into ranges by section (`--ids q0001-q0030`, `--ids q0031-q0060`, …) and run one agent per range in parallel.

> You are checking a multiple-choice quiz made from a document. Get the questions by running, from the repo root: `npm --prefix app run quiz-blind -- quizzes/<id>.json [--ids <range>]`. It also lists the extracted document(s) to read (`documents/extracted/*.md`). Read the document(s) completely. **Do not open anything in `quizzes/`**: the answers are there and this check only works if you don't know them.
>
> Answer every question using only the document, not general knowledge. For each question, reply with one line:
> `<id> | <letter> | <location of the proof: headingPath + [pN], or row N> | ok`
> Replace `ok` with `ambiguous: <letters> - <why>` when more than one option is defensible according to the document, or with `not answerable - <why>` when the document doesn't settle it (then give your best letter anyway). Also note when a question is unclear without the document's context (e.g. it doesn't say which zone or document it means). Don't fix or rewrite anything; just report.

For **practice items**, use this prompt instead (same `--ids` splitting):

> You are checking practice items made from a guide that teaches a method. Get the items by running, from the repo root: `npm --prefix app run quiz-blind -- quizzes/<id>.json [--ids <range>]`. It also lists the extracted guide (`documents/extracted/*.md`). Read the guide completely: it gives the rules for judging the options. **Do not open anything in `quizzes/`**: the answers are there and this check only works if you don't know them.
>
> Each item contains its own text (passage, case, data). That text is the only source of facts; apply the guide's rules to it strictly, and don't use general knowledge. For each item, reply with one line:
> `<id> | <letter> | <the guide's rule that decides it: headingPath + [pN]> | ok`
> Replace `ok` with `ambiguous: <letters> - <why>` when more than one option is defensible under the guide's rules, or with `not answerable - <why>` when no option clearly follows (then give your best letter anyway). Also flag an item whose text is unclear or where a wrong option can be ruled out only by outside knowledge. Don't fix or rewrite anything; just report.

Then compare its letters with `correctIndex` (A = 0 … D = 3). Every question where the letter differs or the flag isn't `ok` needs a look: re-read the passage and decide what is wrong.
- The key is wrong: fix `correctIndex` (and the explanation/reference if they point at the wrong thing).
- A wrong option is also defensible: replace it with one that is clearly wrong according to the document.
- The question lacks context or is vague: sharpen it.
- The agent misread and the question is fine: keep it, but note why you disagree.
- It can't be made sound: drop it and renumber the ids so they stay gapless. This is safe only for questions written in this run, which no device has seen yet. Never renumber questions that were already in the file.

After changes, run `validate-quiz` and `check-references` again until clean. If you changed questions substantially, run a fresh agent on just those (`--ids q0004,q0017`).

## 8. Report

Tell the user, briefly:
- the kind of document and questions (fact questions or practice items), the file written (`quizzes/<id>.json`) and the number of questions; for fact questions the split between recall and understanding, for practice items which rules are covered
- what was covered, and what was skipped and why: sections with nothing testable, rows that didn't fit, images or footnotes the ingestion couldn't read
- the independent check: how many answers agreed (`38/40 agreed`), and every question you fixed or dropped because of it, with one line on why
- 2–3 sample questions with their correct answers, so they can judge quality at a glance
- that the file stays on this PC (gitignored); to use it, copy it to the device and import it in the app

## Adding questions to an existing set

Use this when the set already exists: the document got new material, a second document should join the set, or the user wants more questions. Devices keep score history per question id, so existing ids never change, are never reused, and existing questions stay where they are in the file.

1. **Settle the inputs.** Which set (`quizzes/<id>.json`), which documents (the same one updated, or a new one), and how many questions or which parts. Without a number, cover what isn't covered yet (ask first if that's over ~60).
2. **Back up the set.** Copy it to `quizzes/backup/<id>-<YYYYMMDD-HHMM>.json` (create the folder if needed; it's gitignored like the rest of `quizzes/`).
3. **Extract again.** Run `ingest` (step 2) for every document involved, also the unchanged ones if they were edited since the last extraction (`check-references` warns about that). A new document gets a new entry in `sources`.
4. **Repair existing questions.** Run `check-references`. Every error means the document changed under an existing question:
   - The quote is now elsewhere (it says `it is at …`): update `location`, keep everything else.
   - The fact changed (a new number, a renamed role): fix the question, options, explanation and quote **in place, under the same id**.
   - The fact is gone: delete the question and add its id to `removedQuestionIds` (create the array if needed). The app then ignores its score history, and the id is never reused.
   Keep a list of what you changed and why; it goes into the report.
5. **Find what's not covered yet.**
   ```bash
   npm --prefix app run quiz-coverage -- quizzes/<id>.json --unused
   ```
   It lists every paragraph or row no question references, and the **next free id** (one more than the highest id ever used, including removed ones). Also read the existing questions (`npm --prefix app run quiz-blind -- quizzes/<id>.json`): a fact can already be asked from another place, e.g. a summary table repeating a rule. Skip facts that are already asked, even with other wording.
6. **Write the new questions** with steps 3–4, appended at the end of `questions`, ids counting up from the next free id. Reuse the set's existing tags where they fit. Keep `createdAt`; set `updatedAt` to now (UTC).
7. **Check.** Run step 6 on the whole file (`validate-quiz` also warns about two questions with the same text). Then run the step 7 independent check on the new and changed questions only: `--ids <first new id>-<last new id>,<changed ids>`.
8. **Report** as in step 8, but split into: questions added (id range), existing questions fixed or removed (one line each, with why), and the independent check result for those. Remind the user that the updated file has to be imported again on each device; importing the same set id replaces the set and keeps its score history.
