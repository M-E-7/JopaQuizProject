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

/**
 * Ids of the set's questions whose most recent answer, in any run (`runs` oldest
 * first), was wrong or not given. Answering one right later takes it out; a
 * question never asked isn't in it.
 */
export function stillMissedIds(runs: QuizRun[], questionIds: ReadonlySet<string>): Set<string> {
  const latest = new Map<string, boolean>()
  for (const run of runs) {
    const correct = new Map(run.results.map((r) => [r.questionId, r.correct]))
    for (const id of run.questionIds ?? run.results.map((r) => r.questionId)) {
      if (questionIds.has(id)) latest.set(id, correct.get(id) ?? false)
    }
  }
  return new Set([...latest].filter(([, correct]) => !correct).map(([id]) => id))
}

/** Learned count at which Study stops asking a question. */
export const LEARNED_AFTER = 3

/** A question's learned count after one more answer: right +1, wrong −1, never below 0. */
export function nextLearnedCount(count: number, correct: boolean): number {
  return Math.max(0, count + (correct ? 1 : -1))
}

/**
 * Learned count of each of the set's questions that was answered in a Study or
 * Retry run (`runs` oldest first). Exam answers don't count; with a reset, only
 * runs saved after it (id above `resetAfterRunId`) do.
 */
export function learnedCounts(
  runs: QuizRun[],
  questionIds: ReadonlySet<string>,
  resetAfterRunId?: number,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const run of runs) {
    if (runMode(run) === 'exam' || (resetAfterRunId !== undefined && run.id <= resetAfterRunId)) continue
    for (const { questionId, correct } of currentResults(run.results, questionIds)) {
      counts.set(questionId, nextLearnedCount(counts.get(questionId) ?? 0, correct))
    }
  }
  return counts
}

/** Ids whose learned count has reached `LEARNED_AFTER`: Study leaves them out. */
export function learnedIds(counts: ReadonlyMap<string, number>): Set<string> {
  return new Set([...counts].filter(([, count]) => count >= LEARNED_AFTER).map(([id]) => id))
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
