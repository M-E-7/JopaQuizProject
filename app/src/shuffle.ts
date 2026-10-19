// Random order for a run (pure, in memory only; stored ids and results are unaffected).
import type { QuizQuestion } from './quiz/types.ts'

/** A shuffled copy of `items` (Fisher–Yates); `random` returns a number in [0, 1). */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** The questions in random order, each with its options in random order and `correctIndex` following the correct one. */
export function shuffleQuestions(
  questions: readonly QuizQuestion[],
  random: () => number = Math.random,
): QuizQuestion[] {
  return shuffled(questions, random).map((question) => {
    const order = shuffled([0, 1, 2, 3], random)
    return {
      ...question,
      options: order.map((i) => question.options[i]) as QuizQuestion['options'],
      correctIndex: order.indexOf(question.correctIndex) as QuizQuestion['correctIndex'],
    }
  })
}
