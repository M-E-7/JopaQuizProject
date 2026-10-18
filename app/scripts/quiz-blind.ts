// Prints a quiz's questions and options without the answers, for the
// independent check in the generate-quiz skill: a fresh agent answers the
// questions from the extracted document, and its picks are compared with the
// keys afterwards. Leaves out correctIndex, explanation, reference and tags.
//
// Usage, from app/:  npm run quiz-blind -- <quiz.json> [--ids q0001-q0040,q0045]
// --ids limits the output to some questions (ranges and single ids, comma-separated).
// Exit code: 0 = printed, 1 = unreadable or invalid quiz, 2 = usage error.
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { parseQuizJson } from '../src/quiz/validate.ts'

const usage = 'Usage: npm run quiz-blind -- <quiz.json> [--ids q0001-q0040,q0045]'

// npm runs scripts from app/; INIT_CWD is where the user ran npm.
const baseDir = process.env.INIT_CWD ?? process.cwd()

let input: string | undefined
let idFilter: ((id: string) => boolean) | undefined
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ids') idFilter = parseIds(args[++i] ?? '')
  else if (input === undefined) input = args[i]
  else fail(usage, 2)
}
if (input === undefined) fail(usage, 2)

const file = resolve(baseDir, input)
let text = ''
try {
  text = readFileSync(file, 'utf8')
} catch (e) {
  fail(`${input}: cannot read file (${(e as Error).message})`, 1)
}
const result = parseQuizJson(text)
if (!result.ok) fail(`${input}: not a valid quiz file; run validate-quiz first`, 1)

const quiz = result.quiz
const questions = quiz.questions.filter((q) => !idFilter || idFilter(q.id))
if (questions.length === 0) fail(`${input}: no questions match --ids`, 1)

const multiSource = quiz.sources.length > 1
const lines = [`# ${quiz.title} (${questions.length} of ${quiz.questions.length} questions)`, '', 'Sources:']
for (const source of quiz.sources) {
  const extracted = relative(baseDir, resolve(import.meta.dirname, '..', '..', 'documents', 'extracted', `${source.fileName}.md`))
  lines.push(`- ${multiSource ? `${source.id}: ` : ''}${extracted}`)
}
for (const q of questions) {
  lines.push('', `${q.id}${multiSource ? ` [${q.reference.sourceId}]` : ''}: ${q.question}`)
  q.options.forEach((option, i) => lines.push(`  ${'ABCD'[i]}) ${option}`))
}
console.log(lines.join('\n'))

/** "q0001-q0040,q0045" → a test for question ids (compared by their number). */
function parseIds(spec: string): (id: string) => boolean {
  const ranges: [number, number][] = []
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [from, to = from] = part.split('-').map(idNumber)
    if (Number.isNaN(from) || Number.isNaN(to)) fail(`--ids: cannot read "${part}"\n${usage}`, 2)
    ranges.push([from, to])
  }
  if (ranges.length === 0) fail(`--ids needs a value\n${usage}`, 2)
  return (id) => ranges.some(([from, to]) => idNumber(id) >= from && idNumber(id) <= to)
}

function idNumber(id: string): number {
  const match = /^q(\d+)$/.exec(id.trim())
  return match ? Number(match[1]) : NaN
}

function fail(message: string, code: number): never {
  console.error(message)
  process.exit(code)
}
