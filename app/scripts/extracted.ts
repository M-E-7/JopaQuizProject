// Shared by the scripts that compare a quiz with its extracted documents
// (check-references, quiz-coverage): loading documents/extracted/<fileName>.json
// and comparing text the way a reader would.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { QuizSource } from '../src/quiz/types.ts'
import type { ExtractedDocument } from './ingest/model.ts'

/** The extracted document for a source, or undefined if ingest hasn't been run for it. */
export function loadExtracted(source: QuizSource, extractedDir: string, warnings: string[]): ExtractedDocument | undefined {
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

/** Compare text the way a reader would: ignore spacing and typographic quote/dash variants. */
export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟«»″]/g, '"')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
}

export function contains(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle))
}
