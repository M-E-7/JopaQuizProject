// TypeScript view of the quiz file format v1.
// Source of truth: schema/quiz-set.schema.json (spec: schema/README.md).
// Keep the two in sync when the format changes.

export type SourceType = 'docx' | 'csv' | 'pdf' | 'md' | 'txt' | 'other'

export interface QuizSource {
  id: string
  fileName: string
  type: SourceType
  title?: string
}

export interface SectionLocation {
  type: 'section'
  headingPath: string[]
  paragraph?: number
}

export interface RowLocation {
  type: 'row'
  row: number
  columns: string[]
}

export interface PageLocation {
  type: 'page'
  page: number
  headingPath?: string[]
}

export type QuizLocation = SectionLocation | RowLocation | PageLocation

export interface QuizReference {
  sourceId: string
  location: QuizLocation
  quote: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  reference: QuizReference
  tags?: string[]
}

export interface QuizSet {
  $schema?: string
  format: 'jopa-quiz'
  formatVersion: 1
  id: string
  title: string
  description?: string
  language: string
  createdAt: string
  updatedAt?: string
  sources: QuizSource[]
  questions: QuizQuestion[]
}
