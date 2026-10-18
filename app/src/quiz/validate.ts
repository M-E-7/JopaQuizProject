// Validates a quiz set against format v1: the JSON Schema plus the cross-field
// rules listed in schema/README.md. Shared by the app (file import) and the
// command-line check (scripts/validate-quiz.ts), so it must not use DOM or Node APIs.
import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import schema from '../../../schema/quiz-set.schema.json' with { type: 'json' }
import type { QuizSet } from './types.ts'

export type Severity = 'error' | 'warning'

export interface Issue {
  severity: Severity
  /** Where in the file, e.g. `questions[2].options (q0003)`; `(file)` for the whole file. */
  path: string
  message: string
}

/** On success `issues` holds warnings only. */
export type ValidationResult =
  | { ok: true; quiz: QuizSet; issues: Issue[] }
  | { ok: false; issues: Issue[] }

const SUPPORTED_FORMAT_VERSION = 1

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv, ['date-time'])
const checkSchema = ajv.compile<QuizSet>(schema)

/** Parses the text of a quiz file and validates it. */
export function parseQuizJson(text: string): ValidationResult {
  let data: unknown
  try {
    // Editors on Windows sometimes save JSON with a byte-order mark.
    data = JSON.parse(text.replace(/^﻿/, ''))
  } catch (e) {
    return fail(`not valid JSON: ${(e as Error).message}`)
  }
  return validateQuizSet(data)
}

export function validateQuizSet(data: unknown): ValidationResult {
  if (!isObject(data) || data.format !== 'jopa-quiz') {
    return fail('not a JopaQuiz quiz file ("format" must be "jopa-quiz")')
  }
  if (typeof data.formatVersion === 'number' && data.formatVersion > SUPPORTED_FORMAT_VERSION) {
    return fail(
      `made for a newer app (formatVersion ${data.formatVersion}; this version understands ${SUPPORTED_FORMAT_VERSION}). Update the app and try again.`,
    )
  }

  if (!checkSchema(data)) {
    return { ok: false, issues: schemaIssues(checkSchema.errors ?? [], data) }
  }

  const issues = crossFieldIssues(data)
  if (issues.some((i) => i.severity === 'error')) return { ok: false, issues }
  return { ok: true, quiz: data, issues }
}

function fail(message: string): ValidationResult {
  return { ok: false, issues: [{ severity: 'error', path: '(file)', message }] }
}

// --- Schema errors -----------------------------------------------------------

const LOCATION_TYPES = ['section', 'row', 'page']
const LOCATION_PATH = /^\/questions\/\d+\/reference\/location(?=\/|$)/

function schemaIssues(errors: ErrorObject[], data: unknown): Issue[] {
  const issues: Issue[] = []
  const reportedLocations = new Set<string>()

  for (const error of errors) {
    // `location` is a oneOf of three shapes, and Ajv reports the failures of
    // every shape. Keep only the errors of the shape named by `location.type`.
    const locationPath = LOCATION_PATH.exec(error.instancePath)?.[0]
    if (locationPath) {
      const location = getAtPointer(data, locationPath)
      const type = isObject(location) ? location.type : undefined
      if (typeof type === 'string' && LOCATION_TYPES.includes(type)) {
        if (!error.schemaPath.startsWith(`#/$defs/${type}Location/`)) continue
      } else {
        if (!reportedLocations.has(locationPath)) {
          reportedLocations.add(locationPath)
          issues.push(
            issue('error', locationPath, data, 'must be an object with "type": "section", "row" or "page"'),
          )
        }
        continue
      }
    }
    issues.push(issue('error', error.instancePath, data, schemaMessage(error)))
  }
  return issues
}

function schemaMessage(error: ErrorObject): string {
  const params = error.params as Record<string, unknown>
  switch (error.keyword) {
    case 'additionalProperties':
      return `unknown property "${String(params.additionalProperty)}"`
    case 'enum':
      return `must be one of: ${(params.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(', ')}`
    case 'const':
      return `must be ${JSON.stringify(params.allowedValue)}`
    default:
      return error.message ?? `fails "${error.keyword}"`
  }
}

// --- Cross-field rules (schema/README.md) ------------------------------------

/** Which location type fits which kind of source document. */
const EXPECTED_LOCATION: Partial<Record<string, string>> = {
  docx: 'section',
  md: 'section',
  txt: 'section',
  csv: 'row',
  pdf: 'page',
}

function crossFieldIssues(quiz: QuizSet): Issue[] {
  const issues: Issue[] = []

  const sourceIndex = new Map<string, number>()
  quiz.sources.forEach((source, i) => {
    const first = sourceIndex.get(source.id)
    if (first === undefined) sourceIndex.set(source.id, i)
    else {
      issues.push(
        issue('error', `/sources/${i}/id`, quiz, `duplicate source id "${source.id}" (also sources[${first}])`),
      )
    }
  })

  const questionIndex = new Map<string, number>()
  const usedSources = new Set<string>()
  quiz.questions.forEach((question, i) => {
    const first = questionIndex.get(question.id)
    if (first === undefined) questionIndex.set(question.id, i)
    else {
      issues.push(
        issue('error', `/questions/${i}/id`, quiz, `duplicate question id "${question.id}" (also questions[${first}])`),
      )
    }

    const { sourceId, location } = question.reference
    usedSources.add(sourceId)
    const sourcePos = sourceIndex.get(sourceId)
    if (sourcePos === undefined) {
      const known = [...sourceIndex.keys()].map((id) => `"${id}"`).join(', ')
      issues.push(
        issue('error', `/questions/${i}/reference/sourceId`, quiz, `unknown source "${sourceId}" (sources: ${known})`),
      )
    } else {
      const sourceType = quiz.sources[sourcePos].type
      const expected = EXPECTED_LOCATION[sourceType]
      if (expected && location.type !== expected) {
        issues.push(
          issue(
            'warning',
            `/questions/${i}/reference/location/type`,
            quiz,
            `"${location.type}" location for a ${sourceType} source (expected "${expected}")`,
          ),
        )
      }
    }

    // The schema only rejects exact duplicates; catch "Zone B" vs "zone b ".
    const normalized = question.options.map((o) => o.trim().replace(/\s+/g, ' ').toLowerCase())
    normalized.forEach((option, j) => {
      const k = normalized.indexOf(option)
      if (k < j) {
        issues.push(
          issue('warning', `/questions/${i}/options`, quiz, `options ${k} and ${j} differ only in case or spacing`),
        )
      }
    })
  })

  quiz.sources.forEach((source, i) => {
    if (!usedSources.has(source.id)) {
      issues.push(issue('warning', `/sources/${i}`, quiz, 'not referenced by any question'))
    }
  })

  return issues
}

// --- Helpers -----------------------------------------------------------------

function issue(severity: Severity, pointer: string, data: unknown, message: string): Issue {
  return { severity, path: describePointer(pointer, data), message }
}

/** `/questions/2/options` → `questions[2].options (q0003)` */
function describePointer(pointer: string, data: unknown): string {
  const segments = splitPointer(pointer)
  if (segments.length === 0) return '(file)'

  let path = ''
  for (const segment of segments) {
    path += /^\d+$/.test(segment) ? `[${segment}]` : path ? `.${segment}` : segment
  }

  // Name the question or source by its id, which is what people search for.
  if ((segments[0] === 'questions' || segments[0] === 'sources') && segments.length > 1) {
    const item = getAtPointer(data, `/${segments[0]}/${segments[1]}`)
    if (isObject(item) && typeof item.id === 'string' && item.id) path += ` (${item.id})`
  }
  return path
}

function splitPointer(pointer: string): string[] {
  if (!pointer) return []
  return pointer
    .slice(1)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
}

function getAtPointer(data: unknown, pointer: string): unknown {
  let current = data
  for (const segment of splitPointer(pointer)) {
    if (!isObject(current) && !Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
