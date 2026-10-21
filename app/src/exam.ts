// Exam settings: defaults and limits, and which questions need attention (pure).
import type { ExamSettings } from './platform/index.ts'

export const DEFAULT_EXAM_QUESTIONS = 20
export const DEFAULT_EXAM_MINUTES = 20
export const MAX_EXAM_MINUTES = 300

/**
 * The set's stored settings, or the defaults, with the question count limited
 * to the questions the set has now (fewer than 20, or fewer after a re-import).
 */
export function examSettingsFor(stored: ExamSettings | undefined, available: number): ExamSettings {
  const { questionCount, timeLimitMinutes } = stored ?? {
    questionCount: DEFAULT_EXAM_QUESTIONS,
    timeLimitMinutes: DEFAULT_EXAM_MINUTES,
  }
  return { questionCount: Math.max(1, Math.min(questionCount, available)), timeLimitMinutes }
}

/** Marked or not answered yet: listed first by "Needs attention first", stepped through by "Next to check". */
export function needsAttention(
  questionId: string,
  chosen: ReadonlyMap<string, number>,
  marked: ReadonlySet<string>,
): boolean {
  return marked.has(questionId) || !chosen.has(questionId)
}
