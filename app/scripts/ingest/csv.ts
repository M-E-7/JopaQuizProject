// Reads a .csv into header + numbered rows, and guesses whether it's a fact
// table (e.g. term/definition) or ready-made questions and answers.
//
// Excel writes CSV in the system's old code page unless "CSV UTF-8" is chosen,
// and uses ";" as the separator in many European locales, so both the
// encoding and the separator are detected.
import Papa from 'papaparse'
import type { ReadOptions } from './readers.ts'
import type { ReaderResult, TableRow, TableShape } from './model.ts'

/** Used when a file isn't valid UTF-8 and no --encoding was given (Central European, covers č ć đ š ž). */
const FALLBACK_ENCODING = 'windows-1250'

export function readCsv(bytes: Uint8Array, options: ReadOptions): ReaderResult {
  const notes: string[] = []
  const { text, encoding } = decode(bytes, options.encoding, notes)

  // Papa's separator guess is thrown off by blank lines, so guess without them,
  // then parse with blank lines kept so row numbers match the spreadsheet.
  const delimiter = Papa.parse<string[]>(text, { preview: 50, skipEmptyLines: 'greedy' }).meta.delimiter
  const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false })
  const problems = parsed.errors.filter((e) => e.code !== 'UndetectableDelimiter')
  for (const error of problems.slice(0, 5)) {
    notes.push(`CSV problem near row ${(error.row ?? 0) + 1}: ${error.message}`)
  }
  if (problems.length > 5) notes.push(`…and ${problems.length - 5} more CSV problems.`)

  // Each record is one spreadsheet row, even if a quoted cell spans several lines.
  const records = parsed.data.map((cells, i) => ({ row: i + 1, cells: cells.map((c) => c.trim()) }))
  const headerCells = records[0]?.cells ?? []
  const dataRecords = records.slice(1).filter((r) => r.cells.some(Boolean))

  // Ignore trailing columns with no name and no values (e.g. from a trailing separator).
  let width = Math.max(headerCells.length, ...dataRecords.map((r) => r.cells.length))
  while (width > 0 && !headerCells[width - 1] && dataRecords.every((r) => !r.cells[width - 1])) width--
  const header = Array.from({ length: width }, (_, i) => headerCells[i] || `Column ${columnLetter(i)}`)
  const unnamed = header.filter((_, i) => !headerCells[i])
  if (unnamed.length) notes.push(`Header row has no name for ${unnamed.join(', ')}.`)
  const duplicates = header.filter((h, i) => header.indexOf(h) !== i)
  if (duplicates.length) notes.push(`Duplicate column names: ${[...new Set(duplicates)].join(', ')}.`)

  const rows: TableRow[] = dataRecords.map((r) => ({
    row: r.row,
    cells: Array.from({ length: width }, (_, i) => r.cells[i] ?? ''),
  }))
  if (rows.length === 0) notes.push('No data rows below the header.')

  return {
    notes,
    content: {
      kind: 'table',
      encoding,
      delimiter,
      header,
      rows,
      shape: detectShape(header, rows),
    },
  }
}

function decode(bytes: Uint8Array, requested: string | undefined, notes: string[]): { text: string; encoding: string } {
  // A byte-order mark settles it (TextDecoder strips the mark).
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'utf-16le' }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'utf-16be' }

  if (requested) return { text: new TextDecoder(requested).decode(bytes), encoding: requested }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }
  } catch {
    notes.push(
      `Not valid UTF-8; read as ${FALLBACK_ENCODING}. If letters look wrong, run again with --encoding <name> (e.g. windows-1252).`,
    )
    return { text: new TextDecoder(FALLBACK_ENCODING).decode(bytes), encoding: FALLBACK_ENCODING }
  }
}

function columnLetter(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

// --- Shape detection ---------------------------------------------------------

// Header names are compared lowercased and without diacritics (točan → tocan).
const QUESTION_HEADER = /^(q|question|questions|pitanje|pitanja)\b/
const OPTION_HEADER = /^((option|opcija|choice|answer|odgovor|ponudeni odgovor)\s*)?([a-f]|[1-6])[.)]?$/
const CORRECT_HEADER = /\b(correct|right|tocan|tocno|tocni|ispravan|ispravno|key|kljuc)\b/
const ANSWER_HEADER = /\b(answer|answers|odgovor|odgovori|rjesenje|solution)\b/

function detectShape(header: string[], rows: TableRow[]): TableShape {
  if (rows.length === 0 || header.length < 2) {
    return { kind: 'unknown', reason: header.length < 2 ? 'only one column' : 'no data rows' }
  }
  const names = header.map(normalize)
  const used = new Set<number>()

  const optionIdx = names.flatMap((n, i) => (OPTION_HEADER.test(n) ? [i] : []))
  const optionColumns = optionIdx.length >= 2 ? optionIdx.map((i) => header[i]) : undefined
  if (optionColumns) optionIdx.forEach((i) => used.add(i))

  let questionIdx = names.findIndex((n, i) => !used.has(i) && QUESTION_HEADER.test(n))
  let questionReason = `column "${header[questionIdx]}" is named like a question`
  if (questionIdx < 0) {
    // No telling header: look for a column whose cells are mostly questions.
    questionIdx = header.findIndex((_, i) => {
      const cells = rows.map((r) => r.cells[i]).filter(Boolean)
      return cells.length > 0 && cells.filter((c) => c.endsWith('?')).length / cells.length >= 0.6
    })
    questionReason = `most cells in column "${header[questionIdx]}" end with "?"`
  }

  if (questionIdx >= 0) {
    used.add(questionIdx)
    const rest = header.flatMap((_, i) => (used.has(i) ? [] : [i]))
    let answerIdx = [CORRECT_HEADER, ANSWER_HEADER]
      .map((re) => rest.find((i) => re.test(names[i])))
      .find((i) => i !== undefined)
    let answerReason = `correct answer in "${header[answerIdx ?? 0]}"`
    if (answerIdx === undefined && rest.length === 1) {
      answerIdx = rest[0]
      answerReason = `"${header[answerIdx]}" is the only other column, probably the answer`
    }
    const parts = [questionReason]
    if (optionColumns) parts.push(`answer options in ${optionColumns.map((c) => `"${c}"`).join(', ')}`)
    parts.push(answerIdx === undefined ? 'no answer column recognised' : answerReason)
    return {
      kind: 'qa',
      reason: parts.join('; '),
      questionColumn: header[questionIdx],
      answerColumn: answerIdx === undefined ? undefined : header[answerIdx],
      optionColumns,
    }
  }

  return {
    kind: 'facts',
    reason: `no question column found; each row is treated as facts about its "${header[0]}"`,
    keyColumn: header[0],
  }
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}
