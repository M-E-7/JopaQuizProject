// Platform interface: everything the app needs from the device (storage, file
// picking). UI code uses these through `platform` (./index.ts) and never calls
// IndexedDB or file APIs directly, so a native wrapper (Tauri / Capacitor) can
// provide its own implementation later.
import type { QuizSet } from '../quiz/types.ts'

/** An imported quiz set as stored on the device. */
export interface StoredQuizSet {
  quiz: QuizSet
  /** ISO date-time of the (latest) import. */
  importedAt: string
  /** Name of the imported file, if known. */
  fileName?: string
}

/** What the quiz list needs, without loading every question. */
export interface QuizSetSummary {
  id: string
  title: string
  description?: string
  language: string
  questionCount: number
  /** Current question ids, to count score history against. */
  questionIds: string[]
  importedAt: string
  updatedAt?: string
}

/** One answered question in a run. A question that wasn't answered is just absent. */
export interface QuestionResult {
  questionId: string
  correct: boolean
}

/** `retry` asks the set's still-missed questions, Study-style. */
export type QuizMode = 'study' | 'exam' | 'retry'

/** Exam settings of a quiz set, kept on the device (and on replace) until the set is deleted. */
export interface ExamSettings {
  questionCount: number
  timeLimitMinutes: number
}

/** What an exam run used and how it ended. */
export interface ExamRunInfo extends ExamSettings {
  timeUsedSeconds: number
  /** Handed in automatically because the time ran out. */
  timedOut: boolean
}

/**
 * One finished quiz run. Right/wrong/missed are derived from `results`, so
 * results for removed questions can be left out when the set is re-imported.
 */
export interface QuizRun {
  id: number
  quizId: string
  /** Missing on runs saved before Exam mode existed: those are Study runs. */
  mode?: QuizMode
  /** ISO date-time. */
  finishedAt: string
  /**
   * The questions asked, in order. Missing on runs saved before Exam mode: a
   * Study run answers every question, so its results are its questions.
   */
  questionIds?: string[]
  /** Answered questions only. */
  results: QuestionResult[]
  /** Exam runs only. */
  exam?: ExamRunInfo
}

export interface QuizStorage {
  /** All stored sets, sorted by title. */
  listQuizSets(): Promise<QuizSetSummary[]>
  getQuizSet(id: string): Promise<StoredQuizSet | undefined>
  /** Adds the set, or replaces the stored set with the same `quiz.id`. Its history is kept. */
  saveQuizSet(set: StoredQuizSet): Promise<void>
  /** Deletes the set, its run history and its exam settings. */
  deleteQuizSet(id: string): Promise<void>
  /** Stores a finished run and returns its id. */
  addRun(run: Omit<QuizRun, 'id'>): Promise<number>
  /** Runs of one set, oldest first. */
  listRuns(quizId: string): Promise<QuizRun[]>
  /** The set's saved exam settings, or undefined if none were saved yet. */
  getExamSettings(quizId: string): Promise<ExamSettings | undefined>
  saveExamSettings(quizId: string, settings: ExamSettings): Promise<void>
  /** Asks the browser not to evict stored data. Returns whether storage is persistent. */
  requestPersistence(): Promise<boolean>
}

export interface PickedFile {
  name: string
  text: string
}

export interface FileImport {
  /**
   * Lets the user pick a quiz file and returns its text, or null if cancelled.
   * Call it from a click handler (browsers only open pickers on a user action).
   */
  pickQuizFile(): Promise<PickedFile | null>
}

export interface Platform {
  storage: QuizStorage
  files: FileImport
}
