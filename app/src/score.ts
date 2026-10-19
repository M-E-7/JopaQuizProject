// Score figures derived from a run's results (pure, no storage).
import type { QuestionResult, QuizMode, QuizRun } from './platform/index.ts'

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

/** A run's mode; runs saved before Exam mode existed have none and were Study runs. */
export function runMode(run: QuizRun): QuizMode {
  return run.mode ?? 'study'
}

/** A saved run's score, counted against the set's current questions. */
export interface RunScore {
  mode: QuizMode
  finishedAt: string
  correct: number
  total: number
  percent: number
}

/**
 * Score of a saved run, or undefined if none of its questions are left in the
 * set. Questions asked but not answered (an exam handed in early) count as missed.
 */
export function runScore(run: QuizRun, questionIds: ReadonlySet<string>): RunScore | undefined {
  // Older runs have no `questionIds`: they were Study runs, which answer every question asked.
  const asked = (run.questionIds ?? run.results.map((r) => r.questionId)).filter((id) => questionIds.has(id))
  if (asked.length === 0) return undefined
  const { correct } = countResults(currentResults(run.results, questionIds))
  return {
    mode: runMode(run),
    finishedAt: run.finishedAt,
    correct,
    total: asked.length,
    percent: scorePercent(correct, asked.length),
  }
}

export interface HistorySummary {
  /** Runs that still have questions in the set. */
  count: number
  last?: RunScore
}

/**
 * Run count and latest score of a set's history (`runs` oldest first, as
 * `listRuns` returns them), of one mode or of all runs.
 */
export function historySummary(runs: QuizRun[], questionIds: ReadonlySet<string>, mode?: QuizMode): HistorySummary {
  const scores = runs
    .filter((run) => mode === undefined || runMode(run) === mode)
    .map((run) => runScore(run, questionIds))
    .filter((s) => s !== undefined)
  return { count: scores.length, last: scores.at(-1) }
}
