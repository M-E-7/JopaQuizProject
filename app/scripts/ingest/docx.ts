// Reads a Word .docx into sections (heading path + numbered paragraphs).
//
// A .docx is a zip of XML files. We read:
// - word/document.xml  — the body: paragraphs, tables
// - word/styles.xml    — which paragraph styles are headings (by built-in name
//                        "heading N", which stays English in every Word language,
//                        or by outline level for custom heading styles)
// - word/numbering.xml — automatic numbering, rebuilt so headings read
//                        "2.1 Helmets" as in Word, and list items get their number
// Images, text boxes, footnotes, headers/footers and comments are not extracted.
import { DOMParser, type Element } from '@xmldom/xmldom'
import { strFromU8, unzipSync } from 'fflate'
import type { Paragraph, ReaderResult, Section } from './model.ts'

const W_NS = [
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main', // "Strict Open XML" variant
]

export function readDocx(bytes: Uint8Array): ReaderResult {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, {
      filter: (f) => f.name.startsWith('word/') || f.name === 'docProps/core.xml',
    })
  } catch {
    throw new Error('not a .docx file (old .doc files: open in Word and save as .docx)')
  }
  const document = parseXml(files['word/document.xml'])
  const body = document && childW(document, 'body')
  if (!body) throw new Error('not a Word document (word/document.xml missing)')

  const notes: string[] = []
  const styles = new Styles(parseXml(files['word/styles.xml']))
  const numbering = new Numbering(parseXml(files['word/numbering.xml']), styles)
  const skipped = { drawings: 0, textBoxes: 0, footnotes: 0, endnotes: 0 }

  let title: string | undefined
  const sections: Section[] = [{ headingPath: [], paragraphs: [] }]
  const headingStack: { level: number; text: string }[] = []

  const addParagraph = (p: Omit<Paragraph, 'n'>) => {
    const section = sections[sections.length - 1]
    section.paragraphs.push({ n: section.paragraphs.length + 1, ...p })
  }

  const readParagraph = (p: Element) => {
    const pPr = childW(p, 'pPr')
    const styleId = valOf(childW(pPr, 'pStyle')) ?? styles.defaultId
    const text = paragraphText(p, skipped)
    const num = numbering.paragraphNumbering(pPr, styleId)
    // Advance the counters even for empty paragraphs, as Word does.
    const label = num ? numbering.nextLabel(num.numId, num.ilvl) : undefined
    if (!text) return

    if (styles.isTitle(styleId)) {
      title ??= text
      return
    }
    const level = headingLevel(pPr, styleId, styles)
    if (level) {
      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) headingStack.pop()
      headingStack.push({ level, text: label ? `${label} ${text}` : text })
      sections.push({ headingPath: headingStack.map((h) => h.text), paragraphs: [] })
      return
    }
    if (num && label !== undefined) {
      addParagraph({ kind: 'list-item', label, level: num.ilvl, text })
    } else {
      addParagraph({ kind: 'text', text })
    }
  }

  const readTable = (tbl: Element) => {
    for (const tr of childrenW(tbl, 'tr')) {
      const cells = childrenW(tr, 'tc')
        .filter((tc) => !isMergedContinuation(tc))
        .map((tc) => cellText(tc, skipped))
        .filter(Boolean)
      if (cells.length) addParagraph({ kind: 'table-row', text: cells.join(' | ') })
    }
  }

  const readBlocks = (container: Element) => {
    for (const el of childrenW(container)) {
      switch (el.localName) {
        case 'p':
          readParagraph(el)
          break
        case 'tbl':
          readTable(el)
          break
        case 'sdt': {
          const content = childW(el, 'sdtContent')
          if (content) readBlocks(content)
          break
        }
        case 'customXml':
          readBlocks(el)
          break
      }
    }
  }
  readBlocks(body)

  if (sections[0].paragraphs.length === 0 && sections.length > 1) sections.shift()
  title ??= coreTitle(parseXml(files['docProps/core.xml']))

  if (sections.length === 1 && sections[0].headingPath.length === 0) {
    notes.push('No headings found (no Heading styles used), so all references will have an empty headingPath.')
  }
  const seen = new Set<string>()
  for (const s of sections) {
    const key = JSON.stringify(s.headingPath)
    if (seen.has(key) && s.headingPath.length) {
      notes.push(`Heading path ${key} occurs more than once; references to it are ambiguous.`)
    }
    seen.add(key)
  }
  if (skipped.drawings) notes.push(`${skipped.drawings} image(s)/drawing(s) not extracted.`)
  if (skipped.textBoxes) notes.push(`${skipped.textBoxes} text box(es) not extracted.`)
  if (skipped.footnotes) notes.push(`${skipped.footnotes} footnote(s) not extracted.`)
  if (skipped.endnotes) notes.push(`${skipped.endnotes} endnote(s) not extracted.`)

  return { title, notes, content: { kind: 'sections', sections } }
}

// --- Text --------------------------------------------------------------------

type Skipped = { drawings: number; textBoxes: number; footnotes: number; endnotes: number }

/** Visible text of a paragraph, whitespace collapsed. */
function paragraphText(p: Element, skipped: Skipped): string {
  let out = ''
  const walk = (el: Element) => {
    for (const node of elementChildren(el)) {
      if (!isW(node)) {
        // mc:AlternateContent holds the same content twice; read only mc:Choice.
        if (node.localName !== 'Fallback') walk(node)
        continue
      }
      switch (node.localName) {
        case 't':
          out += node.textContent ?? ''
          break
        case 'tab':
        case 'ptab':
        case 'br':
        case 'cr':
          out += ' '
          break
        case 'noBreakHyphen':
          out += '-'
          break
        // Formatting, deleted/moved-away text, field codes: not visible text.
        case 'pPr':
        case 'rPr':
        case 'del':
        case 'moveFrom':
        case 'instrText':
        case 'delInstrText':
        case 'softHyphen':
          break
        case 'drawing':
        case 'pict':
        case 'object':
          if (containsW(node, 'txbxContent')) skipped.textBoxes++
          else skipped.drawings++
          break
        case 'footnoteReference':
          skipped.footnotes++
          break
        case 'endnoteReference':
          skipped.endnotes++
          break
        default:
          walk(node) // runs, hyperlinks, insertions, fields, content controls, ...
      }
    }
  }
  walk(p)
  return out.replace(/\s+/g, ' ').trim()
}

function cellText(tc: Element, skipped: Skipped): string {
  const parts: string[] = []
  const walk = (container: Element) => {
    for (const el of childrenW(container)) {
      if (el.localName === 'p') parts.push(paragraphText(el, skipped))
      else if (el.localName === 'tbl') {
        for (const tr of childrenW(el, 'tr')) for (const inner of childrenW(tr, 'tc')) walk(inner)
      } else if (el.localName === 'sdt') {
        const content = childW(el, 'sdtContent')
        if (content) walk(content)
      }
    }
  }
  walk(tc)
  return parts.filter(Boolean).join(' ')
}

/** Lower part of a vertically merged cell; its text is in the cell above. */
function isMergedContinuation(tc: Element): boolean {
  const vMerge = childW(childW(tc, 'tcPr'), 'vMerge')
  return !!vMerge && valOf(vMerge) !== 'restart'
}

function coreTitle(core: Element | undefined): string | undefined {
  if (!core) return undefined
  for (const el of elementChildren(core)) {
    if (el.localName === 'title') return el.textContent?.trim() || undefined
  }
  return undefined
}

// --- Headings and styles -----------------------------------------------------

interface StyleInfo {
  name: string
  basedOn?: string
  outlineLevel?: number
  numId?: string
  ilvl?: number
}

class Styles {
  readonly byId = new Map<string, StyleInfo>()
  defaultId?: string

  constructor(root: Element | undefined) {
    if (!root) return
    for (const style of childrenW(root, 'style')) {
      if (attrW(style, 'type') !== 'paragraph') continue
      const id = attrW(style, 'styleId')
      if (!id) continue
      const pPr = childW(style, 'pPr')
      const numPr = childW(pPr, 'numPr')
      const outline = valOf(childW(pPr, 'outlineLvl'))
      const ilvl = valOf(childW(numPr, 'ilvl'))
      this.byId.set(id, {
        name: valOf(childW(style, 'name')) ?? id,
        basedOn: valOf(childW(style, 'basedOn')),
        outlineLevel: outline === undefined ? undefined : Number(outline),
        numId: valOf(childW(numPr, 'numId')),
        ilvl: ilvl === undefined ? undefined : Number(ilvl),
      })
      const isDefault = attrW(style, 'default')
      if (isDefault === '1' || isDefault === 'true') this.defaultId = id
    }
  }

  /** The style and the styles it is based on, nearest first. */
  *chain(styleId: string | undefined): Generator<StyleInfo> {
    const seen = new Set<string>()
    for (let id = styleId; id && !seen.has(id); ) {
      seen.add(id)
      const style = this.byId.get(id)
      if (!style) return
      yield style
      id = style.basedOn
    }
  }

  isTitle(styleId: string | undefined): boolean {
    const style = styleId ? this.byId.get(styleId) : undefined
    return style?.name.toLowerCase() === 'title'
  }
}

/** 1–9 for headings, undefined for body text. */
function headingLevel(pPr: Element | undefined, styleId: string | undefined, styles: Styles): number | undefined {
  const direct = valOf(childW(pPr, 'outlineLvl'))
  if (direct !== undefined) return toHeadingLevel(Number(direct))
  for (const style of styles.chain(styleId)) {
    if (style.outlineLevel !== undefined) return toHeadingLevel(style.outlineLevel)
    const match = /^heading\s*([1-9])$/i.exec(style.name)
    if (match) return Number(match[1])
  }
  return undefined
}

/** Word's outline levels are 0–8 for headings and 9 for body text. */
function toHeadingLevel(outlineLevel: number): number | undefined {
  return outlineLevel >= 0 && outlineLevel <= 8 ? outlineLevel + 1 : undefined
}

// --- Automatic numbering -----------------------------------------------------

interface LevelDef {
  start: number
  numFmt: string
  lvlText: string
  /** "Legal" numbering: show all levels as decimal. */
  isLgl: boolean
  /** Restart after this (1-based) level is used; 0 = never. Default: after any higher level. */
  restart?: number
}

class Numbering {
  private abstracts = new Map<string, { levels: LevelDef[]; styleLink?: string }>()
  private nums = new Map<string, { abstractId: string; overrides: Map<number, { start?: number; level?: LevelDef }> }>()
  /** Current counter per level, shared by all lists that use the same abstract definition (as in Word). */
  private counters = new Map<string, (number | undefined)[]>()
  private startedNums = new Set<string>()
  private styles: Styles

  constructor(root: Element | undefined, styles: Styles) {
    this.styles = styles
    if (!root) return
    for (const abs of childrenW(root, 'abstractNum')) {
      const levels: LevelDef[] = []
      for (const lvl of childrenW(abs, 'lvl')) levels[Number(attrW(lvl, 'ilvl') ?? 0)] = readLevel(lvl)
      this.abstracts.set(attrW(abs, 'abstractNumId') ?? '', {
        levels,
        styleLink: valOf(childW(abs, 'numStyleLink')),
      })
    }
    for (const num of childrenW(root, 'num')) {
      const overrides = new Map<number, { start?: number; level?: LevelDef }>()
      for (const o of childrenW(num, 'lvlOverride')) {
        const start = valOf(childW(o, 'startOverride'))
        const lvl = childW(o, 'lvl')
        overrides.set(Number(attrW(o, 'ilvl') ?? 0), {
          start: start === undefined ? undefined : Number(start),
          level: lvl ? readLevel(lvl) : undefined,
        })
      }
      this.nums.set(attrW(num, 'numId') ?? '', { abstractId: valOf(childW(num, 'abstractNumId')) ?? '', overrides })
    }
  }

  /** The list a paragraph belongs to: its own numPr, else its style's. */
  paragraphNumbering(pPr: Element | undefined, styleId: string | undefined): { numId: string; ilvl: number } | undefined {
    const numPr = childW(pPr, 'numPr')
    let numId = valOf(childW(numPr, 'numId'))
    let ilvl = valOf(childW(numPr, 'ilvl'))
    for (const style of this.styles.chain(styleId)) {
      numId ??= style.numId
      if (ilvl === undefined && style.ilvl !== undefined) ilvl = String(style.ilvl)
    }
    if (!numId || numId === '0' || !this.nums.has(numId)) return undefined
    return { numId, ilvl: Number(ilvl ?? 0) }
  }

  /** Advances the list counter and returns the label Word would show, e.g. "2.1" or "•". */
  nextLabel(numId: string, ilvl: number): string | undefined {
    const num = this.nums.get(numId)
    if (!num) return undefined
    const abstractId = this.resolveAbstract(num.abstractId)
    const levels = (this.abstracts.get(abstractId)?.levels ?? []).map(
      (level, i) => num.overrides.get(i)?.level ?? level,
    )
    const lvl = levels[ilvl]
    if (!lvl) return undefined

    let counts = this.counters.get(abstractId)
    if (!counts) this.counters.set(abstractId, (counts = []))
    if (!this.startedNums.has(numId)) {
      this.startedNums.add(numId)
      for (const [i, o] of num.overrides) if (o.start !== undefined) counts[i] = o.start - 1
    }

    counts[ilvl] = counts[ilvl] === undefined ? lvl.start : counts[ilvl] + 1
    for (let deeper = ilvl + 1; deeper < 9; deeper++) {
      const restartAfter = levels[deeper]?.restart ?? deeper
      if (restartAfter !== 0 && ilvl <= restartAfter - 1) counts[deeper] = undefined
    }

    if (lvl.numFmt === 'bullet') return '•'
    const label = lvl.lvlText.replace(/%([1-9])/g, (_, d: string) => {
      const i = Number(d) - 1
      const value = counts[i] ?? levels[i]?.start ?? 1
      return formatNumber(value, lvl.isLgl ? 'decimal' : (levels[i]?.numFmt ?? 'decimal'))
    })
    return label.trim() || undefined
  }

  /** An abstract definition can point to a numbering style that holds the real one. */
  private resolveAbstract(abstractId: string): string {
    const link = this.abstracts.get(abstractId)?.styleLink
    if (!link) return abstractId
    const linkedNumId = this.styles.byId.get(link)?.numId
    const linked = linkedNumId ? this.nums.get(linkedNumId)?.abstractId : undefined
    return linked && linked !== abstractId ? linked : abstractId
  }
}

function readLevel(lvl: Element): LevelDef {
  const restart = valOf(childW(lvl, 'lvlRestart'))
  const isLgl = childW(lvl, 'isLgl')
  return {
    start: Number(valOf(childW(lvl, 'start')) ?? 1),
    numFmt: valOf(childW(lvl, 'numFmt')) ?? 'decimal',
    lvlText: valOf(childW(lvl, 'lvlText')) ?? '',
    isLgl: !!isLgl && valOf(isLgl) !== '0' && valOf(isLgl) !== 'false',
    restart: restart === undefined ? undefined : Number(restart),
  }
}

function formatNumber(n: number, format: string): string {
  switch (format) {
    case 'decimalZero':
      return n < 10 ? `0${n}` : String(n)
    case 'lowerLetter':
      return letters(n)
    case 'upperLetter':
      return letters(n).toUpperCase()
    case 'lowerRoman':
      return roman(n).toLowerCase()
    case 'upperRoman':
      return roman(n)
    case 'none':
      return ''
    default:
      return String(n)
  }
}

/** Word style: a…z, then aa…zz, aaa… */
function letters(n: number): string {
  if (n < 1) return String(n)
  const letter = String.fromCharCode(97 + ((n - 1) % 26))
  return letter.repeat(Math.floor((n - 1) / 26) + 1)
}

function roman(n: number): string {
  if (n < 1 || n > 3999) return String(n)
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  for (const [value, symbol] of table) {
    while (n >= value) {
      out += symbol
      n -= value
    }
  }
  return out
}

// --- XML helpers -------------------------------------------------------------

function parseXml(data: Uint8Array | undefined): Element | undefined {
  if (!data) return undefined
  return new DOMParser().parseFromString(strFromU8(data), 'text/xml').documentElement ?? undefined
}

function* elementChildren(el: Element): Generator<Element> {
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === n.ELEMENT_NODE) yield n as Element
  }
}

function isW(el: Element, localName?: string): boolean {
  return W_NS.includes(el.namespaceURI ?? '') && (localName === undefined || el.localName === localName)
}

function childrenW(el: Element | undefined, localName?: string): Element[] {
  if (!el) return []
  return [...elementChildren(el)].filter((c) => isW(c, localName))
}

function childW(el: Element | undefined, localName: string): Element | undefined {
  return childrenW(el, localName)[0]
}

function containsW(el: Element, localName: string): boolean {
  return W_NS.some((ns) => el.getElementsByTagNameNS(ns, localName).length > 0)
}

/** A w:-namespaced attribute, e.g. w:val. */
function attrW(el: Element | undefined, name: string): string | undefined {
  if (!el) return undefined
  for (const ns of W_NS) {
    if (el.hasAttributeNS(ns, name)) return el.getAttributeNS(ns, name) ?? undefined
  }
  return undefined
}

function valOf(el: Element | undefined): string | undefined {
  return attrW(el, 'val')
}
