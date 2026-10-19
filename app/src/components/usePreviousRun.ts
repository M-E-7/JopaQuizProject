import { useEffect, useState } from 'react'
import { platform, type QuizMode } from '../platform/index.ts'
import type { QuizSet } from '../quiz/types.ts'
import { historySummary, type RunScore } from '../score.ts'

/**
 * Score of the set's latest saved run in `mode`, for the summary's "Last time".
 * Loaded when the run starts, before it is saved; Start again remounts the run,
 * so it then finds the run just finished.
 */
export function usePreviousRun(quiz: QuizSet, mode: QuizMode): RunScore | undefined {
  const [previous, setPrevious] = useState<RunScore>()

  useEffect(() => {
    let cancelled = false
    const questionIds = new Set(quiz.questions.map((q) => q.id))
    platform.storage.listRuns(quiz.id).then(
      (runs) => {
        if (!cancelled) setPrevious(historySummary(runs, questionIds, mode).last)
      },
      // Without it the summary just leaves out "Last time".
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [quiz, mode])

  return previous
}
