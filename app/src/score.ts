// Score figures derived from a run's results (pure, no storage).
import type { QuestionResult } from './platform/index.ts'

export function countResults(results: QuestionResult[]): { correct: number; wrong: number } {
  const correct = results.filter((r) => r.correct).length
  return { correct, wrong: results.length - correct }
}
