// Extracts the text of source documents for question generation.
//
// Usage, from app/:  npm run ingest -- <file-or-folder> [...] [--encoding <name>] [--out <folder>]
// For each document writes <out>/<file name>.json (structured) and .md (readable),
// where <out> defaults to an "extracted" folder next to the document
// (documents/extracted/, gitignored). A folder argument reads every supported
// file in it. Exit code: 0 = all read, 1 = some file failed.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { readerFor, supportedExtensions } from './ingest/readers.ts'
import type { ExtractedDocument } from './ingest/model.ts'
import { renderMarkdown } from './ingest/render.ts'

const usage =
  'Usage: npm run ingest -- <file-or-folder> [...] [--encoding <name>] [--out <folder>]\n' +
  `Supported: ${supportedExtensions.join(', ')}`

// npm runs scripts from app/; INIT_CWD is where the user ran npm.
const baseDir = process.env.INIT_CWD ?? process.cwd()

const inputs: string[] = []
let encoding: string | undefined
let outDir: string | undefined
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--encoding') encoding = args[++i]
  else if (args[i] === '--out') outDir = args[++i] && resolve(baseDir, args[i])
  else inputs.push(args[i])
}
if (inputs.length === 0) {
  console.error(usage)
  process.exit(2)
}
if (encoding) {
  try {
    new TextDecoder(encoding)
  } catch {
    console.error(`Unknown encoding "${encoding}".`)
    process.exit(2)
  }
}

const files: string[] = []
for (const input of inputs) {
  const path = resolve(baseDir, input)
  let isDir = false
  try {
    isDir = statSync(path).isDirectory()
  } catch {
    // reported as unreadable below
  }
  if (!isDir) {
    files.push(path)
    continue
  }
  const found = readdirSync(path)
    // "~$name.docx" are Word's lock files for open documents.
    .filter((name) => !name.startsWith('~$') && readerFor(name))
    .map((name) => join(path, name))
  if (found.length === 0) console.log(`${input}: no ${supportedExtensions.join('/')} files`)
  files.push(...found)
}

let failed = false
for (const file of files) {
  const label = display(file)
  const reader = readerFor(file)
  if (!reader) {
    console.log(`${label}: not supported (supported: ${supportedExtensions.join(', ')})`)
    failed = true
    continue
  }

  let doc: ExtractedDocument
  try {
    const result = reader.read(readFileSync(file), { encoding })
    doc = {
      extractor: 'jopa-quiz-ingest',
      version: 1,
      fileName: basename(file),
      type: reader.type,
      ...(result.title ? { title: result.title } : {}),
      extractedAt: new Date().toISOString(),
      notes: result.notes,
      content: result.content,
    }
  } catch (e) {
    console.log(`${label}: failed — ${(e as Error).message}`)
    failed = true
    continue
  }

  const target = outDir ?? join(dirname(file), 'extracted')
  mkdirSync(target, { recursive: true })
  const base = join(target, doc.fileName)
  writeFileSync(`${base}.json`, JSON.stringify(doc, null, 2) + '\n')
  writeFileSync(`${base}.md`, renderMarkdown(doc))

  console.log(`${label} → ${display(base)}.md (+ .json): ${summary(doc)}`)
  for (const note of doc.notes) console.log(`  note: ${note}`)
}

process.exitCode = failed ? 1 : 0

function summary(doc: ExtractedDocument): string {
  const c = doc.content
  if (c.kind === 'table') {
    return `${c.rows.length} rows, ${c.header.length} columns, ${c.encoding}, shape: ${c.shape.kind}`
  }
  const paragraphs = c.sections.reduce((sum, s) => sum + s.paragraphs.length, 0)
  return `${c.sections.length} sections, ${paragraphs} paragraphs`
}

function display(path: string): string {
  const rel = relative(baseDir, path)
  return rel && !rel.startsWith('..') ? rel : path
}
