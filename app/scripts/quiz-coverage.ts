// Shows which parts of the source documents a quiz already asks about, for
// appending questions without duplicates: every paragraph (or CSV row) of the
// extracted documents with the ids of the questions that reference it, plus the
// next free question id.
//
// Usage, from app/:  npm run quiz-coverage -- <quiz.json> [--unused] [--extracted <folder>]
// --unused lists only paragraphs/rows no question references yet.
// Exit code: 0 = printed, 1 = unreadable/invalid quiz or missing extracted document, 2 = usage error.
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { QuizQuestion } from '../src/quiz/types.ts'
import { parseQuizJson } from '../src/quiz/validate.ts'
import { loadExtracted } from './extracted.ts'

const usage = 'Usage: npm run quiz-coverage -- <quiz.json> [--unused] [--extracted <folder>]'
const SNIPPET = 90

const repoRoot = resolve(import.meta.dirname, '..', '..')
// npm runs scripts from app/; INIT_CWD is where the user ran npm.
const baseDir = process.env.INIT_CWD ?? process.cwd()

let input: string | undefined
let unusedOnly = false
let extractedDir = join(repoRoot, 'documents', 'extracted')
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--unused') unusedOnly = true
  else if (args[i] === '--extracted') extractedDir = resolve(baseDir, args[++i] ?? '')
  else if (input === undefined) input = args[i]
  else fail(usage, 2)
}
if (input === undefined) fail(usage, 2)

let text = ''
try {
  text = readFileSync(resolve(baseDir, input), 'utf8')
} catch (e) {
  fail(`${input}: cannot read file (${(e as Error).message})`, 1)
}
const result = parseQuizJson(text)
if (!result.ok) fail(`${input}: not a valid quiz file; run validate-quiz first`, 1)
const quiz = result.quiz

const ids = [...quiz.questions.map((q) => q.id), ...(quiz.removedQuestionIds ?? [])]
const highest = Math.max(...ids.map((id) => Number(id.slice(1))))
const nextId = `q${String(highest + 1).padStart(4, '0')}`
const removed = quiz.removedQuestionIds?.length ? `, ${quiz.removedQuestionIds.length} removed` : ''
const lines = [`${input}: ${quiz.questions.length} questions${removed}; next free id: ${nextId}`]

let failed = false
for (const source of quiz.sources) {
  const warnings: string[] = []
  const doc = loadExtracted(source, extractedDir, warnings)
  lines.push('', `Source "${source.id}": ${display(join(extractedDir, `${source.fileName}.md`))}`)
  if (!doc) {
    lines.push(`  not extracted; run: npm run ingest -- <the document>`)
    failed = true
    continue
  }
  for (const w of warnings) lines.push(`  warning: ${w}`)

  const questions = quiz.questions.filter((q) => q.reference.sourceId === source.id)
  const found = new Set<QuizQuestion>()
  const body: string[] = []
  let total = 0
  let unused = 0

  if (doc.content.kind === 'sections') {
    for (const section of doc.content.sections) {
      const path = JSON.stringify(section.headingPath)
      const rows: string[] = []
      for (const p of section.paragraphs) {
        const users = questions.filter((q) => {
          const loc = q.reference.location
          if (loc.type !== 'section' || JSON.stringify(loc.headingPath) !== path) return false
          // A quote over a list split into items covers one paragraph per line.
          const first = loc.paragraph ?? 0
          return p.n >= first && p.n < first + q.reference.quote.split('\n').length
        })
        users.forEach((q) => found.add(q))
        total++
        if (!users.length) unused++
        if (unusedOnly && users.length) continue
        rows.push(row(`[p${p.n}]`, users, `${p.label ? `${p.label} ` : ''}${p.text}`))
      }
      // Questions that point at the section without a paragraph number.
      const whole = questions.filter((q) => q.reference.location.type === 'section' && q.reference.location.paragraph === undefined && JSON.stringify(q.reference.location.headingPath) === path)
      whole.forEach((q) => found.add(q))
      if (whole.length) rows.unshift(row('[all]', whole, '(no paragraph number)'))
      if (rows.length) body.push(path, ...rows)
    }
  } else {
    const table = doc.content
    for (const r of table.rows) {
      const users = questions.filter((q) => q.reference.location.type === 'row' && q.reference.location.row === r.row)
      users.forEach((q) => found.add(q))
      total++
      if (!users.length) unused++
      if (unusedOnly && users.length) continue
      const cells = table.header.map((h, i) => `${h}: ${r.cells[i] ?? ''}`).join(' | ')
      body.push(row(`[row ${r.row}]`, users, cells))
    }
  }

  const unit = doc.content.kind === 'sections' ? 'paragraphs' : 'rows'
  lines.push(`  ${questions.length} questions; ${total - unused} of ${total} ${unit} used, ${unused} unused`)
  const lost = questions.filter((q) => !found.has(q))
  if (lost.length) {
    lines.push(`  location not in the document (run check-references): ${lost.map((q) => q.id).join(', ')}`)
  }
  lines.push('', ...body)
}
console.log(lines.join('\n'))
process.exitCode = failed ? 1 : 0

function row(location: string, users: QuizQuestion[], content: string): string {
  const who = users.length ? users.map((q) => q.id).join(',') : '-'
  const snippet = content.length > SNIPPET ? `${content.slice(0, SNIPPET - 1)}…` : content
  return `  ${location.padEnd(9)} ${who.padEnd(11)} ${snippet}`
}

function display(path: string): string {
  const rel = relative(baseDir, path)
  return rel && !rel.startsWith('..') ? rel : path
}

function fail(message: string, code: number): never {
  console.error(message)
  process.exit(code)
}
