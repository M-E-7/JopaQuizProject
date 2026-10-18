// Renders an extracted document as Markdown for reading while writing
// questions. Every passage carries the location a question's reference needs:
// `headingPath` + [pN] paragraph numbers, or [row N] for tables. Table rows are
// written in the quote format "Column: value | Column: value".
import type { ExtractedDocument, Paragraph, SectionsContent, TableContent } from './model.ts'

export function renderMarkdown(doc: ExtractedDocument): string {
  const lines: string[] = [`# ${doc.fileName}`, '']
  const facts = [`type: ${doc.type}`]
  if (doc.title) facts.push(`title: ${doc.title}`)
  facts.push(`extracted: ${doc.extractedAt}`)
  lines.push(facts.join(' · '), '')
  if (doc.notes.length) {
    lines.push('Notes:', ...doc.notes.map((n) => `- ${n}`), '')
  }
  if (doc.content.kind === 'sections') renderSections(doc.content, lines)
  else renderTable(doc.content, lines)
  return lines.join('\n')
}

function renderSections(content: SectionsContent, lines: string[]): void {
  for (const section of content.sections) {
    const depth = section.headingPath.length
    const heading = depth ? section.headingPath[depth - 1] : '(before the first heading)'
    lines.push(`${'#'.repeat(Math.min(depth + 1, 6))} ${heading}`, '')
    lines.push(`headingPath: ${JSON.stringify(section.headingPath)}`, '')
    for (const p of section.paragraphs) lines.push(renderParagraph(p))
    if (section.paragraphs.length) lines.push('')
  }
}

function renderParagraph(p: Paragraph): string {
  switch (p.kind) {
    case 'list-item':
      return `[p${p.n}] ${'  '.repeat(p.level ?? 0)}${p.label} ${p.text}`
    case 'table-row':
      return `[p${p.n}] (table row) ${p.text}`
    default:
      return `[p${p.n}] ${p.text}`
  }
}

function renderTable(content: TableContent, lines: string[]): void {
  lines.push(
    `encoding: ${content.encoding} · delimiter: ${JSON.stringify(content.delimiter)} · ${content.rows.length} data rows`,
    `columns: ${content.header.map((h) => JSON.stringify(h)).join(', ')}`,
    `shape: ${content.shape.kind} (${content.shape.reason})`,
    '',
  )
  for (const row of content.rows) {
    const cells = row.cells.flatMap((value, i) => (value ? [`${content.header[i]}: ${value}`] : []))
    lines.push(`[row ${row.row}] ${cells.join(' | ').replace(/\s*\n\s*/g, ' ')}`)
  }
  lines.push('')
}
