// Checks quiz JSON files against format v1 (schema/quiz-set.schema.json plus
// the cross-field rules in schema/README.md), using the same code as the app.
//
// Usage, from app/:  npm run validate-quiz -- <file-or-folder> [...]
// Paths are relative to the folder you ran npm from; a folder checks every
// .json file in it. Exit code: 0 = all valid (warnings allowed), 1 = errors.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseQuizJson } from '../src/quiz/validate.ts'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: npm run validate-quiz -- <quiz.json | folder> [...]')
  process.exit(2)
}

// npm runs scripts from app/; INIT_CWD is where the user ran npm.
const baseDir = process.env.INIT_CWD ?? process.cwd()

const files: string[] = []
for (const arg of args) {
  const path = resolve(baseDir, arg)
  try {
    if (statSync(path).isDirectory()) {
      const jsonFiles = readdirSync(path).filter((name) => name.endsWith('.json'))
      if (jsonFiles.length === 0) console.log(`${arg}: no .json files`)
      files.push(...jsonFiles.map((name) => join(path, name)))
    } else {
      files.push(path)
    }
  } catch {
    files.push(path) // reported as unreadable below
  }
}

let failed = false
for (const file of files) {
  const rel = relative(baseDir, file)
  const label = rel && !rel.startsWith('..') ? rel : file

  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    console.log(`${label}: cannot read file (${(e as Error).message})`)
    failed = true
    continue
  }

  const result = parseQuizJson(text)
  const errors = result.issues.filter((i) => i.severity === 'error').length
  const warnings = result.issues.length - errors
  const counts = [plural(errors, 'error'), plural(warnings, 'warning')].filter(Boolean).join(', ')
  const status = result.ok
    ? `OK, ${plural(result.quiz.questions.length, 'question')} from ${plural(result.quiz.sources.length, 'source')}`
    : 'INVALID'
  console.log(`${label}: ${status}${counts ? ` (${counts})` : ''}`)
  for (const issue of result.issues) {
    console.log(`  ${issue.severity}: ${issue.path}: ${issue.message}`)
  }
  if (!result.ok) failed = true
}

process.exitCode = failed ? 1 : 0

function plural(n: number, word: string): string {
  return n === 0 ? '' : `${n} ${word}${n === 1 ? '' : 's'}`
}
