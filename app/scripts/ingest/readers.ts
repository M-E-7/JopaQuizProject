// One reader per source format. To support a new format, write a reader that
// returns a ReaderResult and add it to the list below.
import type { SourceType } from '../../src/quiz/types.ts'
import { readCsv } from './csv.ts'
import { readDocx } from './docx.ts'
import type { ReaderResult } from './model.ts'

export interface ReadOptions {
  /** Text encoding for formats that need one (CSV) when the file isn't UTF-8. */
  encoding?: string
}

export interface DocumentReader {
  type: SourceType
  /** Lowercase, with the dot. */
  extensions: string[]
  read(bytes: Uint8Array, options: ReadOptions): ReaderResult
}

export const readers: DocumentReader[] = [
  { type: 'docx', extensions: ['.docx'], read: readDocx },
  { type: 'csv', extensions: ['.csv'], read: readCsv },
]

export function readerFor(fileName: string): DocumentReader | undefined {
  const lower = fileName.toLowerCase()
  return readers.find((r) => r.extensions.some((ext) => lower.endsWith(ext)))
}

export const supportedExtensions = readers.flatMap((r) => r.extensions)
