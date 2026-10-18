// Checks that every question's reference points at real text: the quote must
// appear at the stated location in the extracted document
// (documents/extracted/<fileName>.json, written by `npm run ingest`).
//
// Usage, from app/:  npm run check-references -- <quiz.json> [...] [--extracted <folder>]
// Run validate-quiz first; this check assumes a valid quiz file.
// Exit code: 0 = all references found, 1 = problems.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { QuizQuestion, QuizSource } from '../src/quiz/types.ts'
import { parseQuizJson } from '../src/quiz/validate.ts'
import type { ExtractedDocument, Section, TableContent } from './ingest/model.ts'

/** How many paragraphs a quote may span (an intro line plus a short list split into items). */
const MAX_SPAN = 6

const repoRoot = resolve(import.meta.dirname, '..', '..')
const baseDir = process.env.INIT_CWD ?? process.cwd()

const inputs: string[] = []
let extractedDir = join(repoRoot, 'documents', 'extracted')
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--extracted') extractedDir = resolve(baseDir, args[++i] ?? '')
  else inputs.push(args[i])
}
if (inputs.length === 0) {
  console.error('Usage: npm run check-references -- <quiz.json> [...] [--extracted <folder>]')
  process.exit(2)
}

let failed = false
for (const input of inputs) {
  const file = resolve(baseDir, input)
  const label = display(file)
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    console.log(`${label}: cannot read file (${(e as Error).message})`)
    failed = true
    continue
  }
  const result = parseQuizJson(text)
  if (!result.ok) {
    console.log(`${label}: not a valid quiz file; run validate-quiz first`)
    failed = true
    continue
  }

  const problems: string[] = []
  const warnings: string[] = []
  const documents = new Map<string, ExtractedDocument>()
  for (const source of result.quiz.sources) {
    const doc = loadExtracted(source, warnings)
    if (doc) documents.set(source.id, doc)
    else problems.push(`source "${source.id}": no ${display(join(extractedDir, `${source.fileName}.json`))}; run: npm run ingest -- <the document>`)
  }

  for (const question of result.quiz.questions) {
    const doc = documents.get(question.reference.sourceId)
    if (!doc) continue
    const problem = checkQuestion(question, doc)
    if (problem) problems.push(`${question.id}: ${problem}`)
  }

  const n = result.quiz.questions.length
  console.log(
    problems.length
      ? `${label}: ${problems.length} of ${n} references have problems`
      : `${label}: all ${n} references found in the source documents`,
  )
  for (const w of warnings) console.log(`  warning: ${w}`)
  for (const p of problems) console.log(`  error: ${p}`)
  if (problems.length) failed = true
}
process.exitCode = failed ? 1 : 0

// --- Loading -----------------------------------------------------------------

function loadExtracted(source: QuizSource, warnings: string[]): ExtractedDocument | undefined {
  const path = join(extractedDir, `${source.fileName}.json`)
  if (!existsSync(path)) return undefined
  const doc = JSON.parse(readFileSync(path, 'utf8')) as ExtractedDocument
  // The document may have been edited after it was extracted.
  const original = join(extractedDir, '..', source.fileName)
  if (existsSync(original) && statSync(original).mtime > new Date(doc.extractedAt)) {
    warnings.push(`${source.fileName} changed after it was extracted; run ingest again`)
  }
  return doc
}

// --- Matching ----------------------------------------------------------------

/** Compare text the way a reader would: ignore spacing and typographic quote/dash variants. */
function normalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟«»″]/g, '"')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
}

function contains(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle))
}

function checkQuestion(question: QuizQuestion, doc: ExtractedDocument): string | undefined {
  const { location, quote } = question.reference
  const content = doc.content

  if (location.type === 'page') return undefined // no page-based reader yet
  if (location.type === 'section') {
    if (content.kind !== 'sections') return `"section" location, but ${doc.fileName} is a table (use "row")`
    return checkSection(location.headingPath, location.paragraph, quote, content.sections)
  }
  if (content.kind !== 'table') return `"row" location, but ${doc.fileName} has sections (use "section")`
  return checkRow(location.row, location.columns, quote, content)
}

function checkSection(
  headingPath: string[],
  paragraph: number | undefined,
  quote: string,
  sections: Section[],
): string | undefined {
  const samePath = sections.filter((s) => JSON.stringify(s.headingPath) === JSON.stringify(headingPath))
  const at = (s: Section, n: number) => `${JSON.stringify(s.headingPath)} [p${n}]`

  if (samePath.length === 0) {
    return `no section with headingPath ${JSON.stringify(headingPath)}${hintSections(quote, sections)}`
  }
  const candidates = samePath.flatMap((s) =>
    s.paragraphs.filter((p) => paragraph === undefined || p.n === paragraph).map((p) => ({ s, p })),
  )
  if (paragraph !== undefined && candidates.length === 0) {
    return `section ${JSON.stringify(headingPath)} has no paragraph ${paragraph}${hintSections(quote, sections)}`
  }
  if (candidates.some(({ s, p }) => quoteStartsAt(s, p.n, quote))) return undefined
  const where = paragraph === undefined ? `section ${JSON.stringify(headingPath)}` : at(samePath[0], paragraph)
  return `quote not found in ${where}${hintSections(quote, sections)}`
}

/**
 * The quote is in paragraph n, or starts there and runs on into the next few
 * paragraphs (written with line breaks between them, list labels optional).
 */
function quoteStartsAt(section: Section, n: number, quote: string): boolean {
  const from = section.paragraphs.findIndex((p) => p.n === n)
  if (from < 0) return false
  const joined = (start: number, withLabels: boolean) =>
    section.paragraphs
      .slice(start, from + MAX_SPAN)
      .map((p) => (withLabels && p.label ? `${p.label} ${p.text}` : p.text))
      .join(' ')
  return [true, false].some(
    (labels) => contains(joined(from, labels), quote) && !contains(joined(from + 1, labels), quote),
  )
}

/** Where the quote does occur, to make fixing easy. */
function hintSections(quote: string, sections: Section[]): string {
  const hits = sections.flatMap((s) =>
    s.paragraphs.filter((p) => quoteStartsAt(s, p.n, quote)).map((p) => `${JSON.stringify(s.headingPath)} [p${p.n}]`),
  )
  if (hits.length) return `; it is at ${hits.slice(0, 3).join(', ')}`
  return '; the quote does not appear anywhere in the document (it must be copied verbatim, in one piece)'
}

function checkRow(row: number, columns: string[], quote: string, table: TableContent): string | undefined {
  const unknown = columns.filter((c) => !table.header.includes(c))
  if (unknown.length) {
    return `unknown column(s) ${unknown.map((c) => `"${c}"`).join(', ')} (columns: ${table.header.map((c) => `"${c}"`).join(', ')})`
  }
  const record = table.rows.find((r) => r.row === row)
  if (!record) return `there is no data row ${row}${hintRows(quote, table)}`

  // Quote format: "Column: value | Column: value"; every part must match that row.
  for (const part of quote.split(' | ')) {
    const column = table.header.find((h) => part.startsWith(`${h}: `))
    if (!column) return `quote part "${part}" doesn't start with a column name ("Column: value")`
    const value = part.slice(column.length + 2)
    if (!contains(record.cells[table.header.indexOf(column)], value)) {
      return `row ${row} has no "${value}" in column "${column}"${hintRows(quote, table)}`
    }
    if (!columns.includes(column)) return `quote uses column "${column}", which isn't listed in location.columns`
  }
  return undefined
}

function hintRows(quote: string, table: TableContent): string {
  const firstValue = quote.split(' | ')[0]?.replace(/^[^:]*: /, '') ?? ''
  const hits = table.rows.filter((r) => r.cells.some((c) => firstValue && contains(c, firstValue))).map((r) => r.row)
  return hits.length ? `; "${firstValue}" is in row ${hits.slice(0, 5).join(', ')}` : ''
}

function display(path: string): string {
  const rel = relative(baseDir, path)
  return rel && !rel.startsWith('..') ? rel : path
}
