// What ingestion extracts from a source document. Written as
// documents/extracted/<file>.json (plus a readable .md, see render.ts), and
// read by Claude when generating questions. Locations match the quiz format's
// reference.location (schema/README.md), so they can be copied as they are.
import type { SourceType } from '../../src/quiz/types.ts'

export interface ExtractedDocument {
  extractor: 'jopa-quiz-ingest'
  version: 1
  fileName: string
  type: SourceType
  title?: string
  extractedAt: string
  /** Things the reader skipped or guessed, e.g. images, encoding fallback. */
  notes: string[]
  content: SectionsContent | TableContent
}

/** What a reader returns; the common fields are filled in by ingest.ts. */
export interface ReaderResult {
  title?: string
  notes: string[]
  content: SectionsContent | TableContent
}

// --- Documents with headings (.docx; later .md, .txt) -----------------------

export interface SectionsContent {
  kind: 'sections'
  sections: Section[]
}

export interface Section {
  /** Headings from the top level down, as shown in the document. Empty before the first heading. */
  headingPath: string[]
  paragraphs: Paragraph[]
}

export interface Paragraph {
  /** 1-based within the section: reference.location.paragraph. */
  n: number
  kind: 'text' | 'list-item' | 'table-row'
  /** List number or bullet as the document shows it, e.g. "3." or "•". */
  label?: string
  /** List nesting level, 0 = top. */
  level?: number
  /** Whitespace collapsed to single spaces. Table rows: non-empty cells joined with " | ". */
  text: string
}

// --- Tables (.csv) -----------------------------------------------------------

export interface TableContent {
  kind: 'table'
  encoding: string
  delimiter: string
  /** Column names (header = spreadsheet row 1). */
  header: string[]
  /** Data rows only; empty rows are left out but keep their numbering. */
  rows: TableRow[]
  shape: TableShape
}

export interface TableRow {
  /** Row number as a spreadsheet app shows it: reference.location.row. */
  row: number
  /** One value per header column. */
  cells: string[]
}

/** A guess at what the table holds; the question generator makes the final call. */
export interface TableShape {
  kind: 'qa' | 'facts' | 'unknown'
  reason: string
  questionColumn?: string
  answerColumn?: string
  /** Ready-made answer options, e.g. columns A–D. */
  optionColumns?: string[]
  /** For fact tables: the column that names each row's subject (e.g. "Term"). */
  keyColumn?: string
}
