// Score figures derived from a run's results (pure, no storage).
import type { QuestionResult, QuizRun } from './platform/index.ts'

/** An answer given during a run. `chosen` (option index) is only kept in memory, for the summary. */
export interface Answer extends QuestionResult {
  chosen: number
}

export function countResults(results: QuestionResult[]): { correct: number; wrong: number } {
  const correct = results.filter((r) => r.correct).length
  return { correct, wrong: results.length - correct }
}

/** Whole-number percentage of `total` questions answered correctly (0 for an empty run). */
export function scorePercent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100)
}

/**
 * Results whose question is still in the set. Drops questions that were removed
 * on re-import: an id in `removedQuestionIds` can't belong to a question (the
 * validator rejects that), so checking the current ids covers both cases.
 */
export function currentResults(results: QuestionResult[], questionIds: ReadonlySet<string>): QuestionResult[] {
  return results.filter((r) => questionIds.has(r.questionId))
}

/** A saved run's score, counted against the set's current questions. */
export interface RunScore {
  finishedAt: string
  correct: number
  total: number
  percent: number
}

/** Score of a saved run, or undefined if none of its questions are left in the set. */
export function runScore(run: QuizRun, questionIds: ReadonlySet<string>): RunScore | undefined {
  // A Study run answers every question it asks, so its results are its questions.
  const results = currentResults(run.results, questionIds)
  if (results.length === 0) return undefined
  const { correct } = countResults(results)
  return { finishedAt: run.finishedAt, correct, total: results.length, percent: scorePercent(correct, results.length) }
}

export interface HistorySummary {
  /** Runs that still have questions in the set. */
  count: number
  last?: RunScore
}

/** Run count and latest score of a set's history (`runs` oldest first, as `listRuns` returns them). */
export function historySummary(runs: QuizRun[], questionIds: ReadonlySet<string>): HistorySummary {
  const scores = runs.map((run) => runScore(run, questionIds)).filter((s) => s !== undefined)
  return { count: scores.length, last: scores.at(-1) }
}
