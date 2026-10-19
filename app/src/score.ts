// Score figures derived from a run's results (pure, no storage).
import type { QuestionResult } from './platform/index.ts'

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
