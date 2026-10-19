import { useEffect, useRef, useState } from 'react'
import { OPTION_LETTERS } from '../format.ts'
import type { QuestionResult, QuizRun } from '../platform/index.ts'
import type { QuizQuestion, QuizSet } from '../quiz/types.ts'
import { countResults, type Answer, type RunScore } from '../score.ts'
import { shuffleQuestions } from '../shuffle.ts'
import QuizSummary from './QuizSummary.tsx'
import SourceReference from './SourceReference.tsx'

/**
 * Study mode: every question, each answer checked at once with the explanation
 * and source. Retry mode is the same with only the set's still-missed questions.
 */
export default function StudyRun({
  quiz,
  mode,
  questions: toAsk,
  previous,
  saveRun,
  missedCount,
  onRetryMissed,
  onQuit,
  onBackToList,
  onRestart,
  onLeaveGuardChange,
}: {
  quiz: QuizSet
  mode: 'study' | 'retry'
  /** The questions to ask: all of them, or the still-missed ones for a retry. Read at mount. */
  questions: QuizQuestion[]
  /** The set's latest saved run of this mode, for "Last time". Read at mount. */
  previous: RunScore | undefined
  saveRun: (run: Omit<QuizRun, 'id'>) => Promise<void>
  /** Still-missed questions in the set, kept up to date as runs are saved. */
  missedCount: number
  onRetryMissed: () => void
  onQuit: () => void
  onBackToList: () => void
  onRestart: () => void
  onLeaveGuardChange: (needed: boolean) => void
}) {
  /** This run's order of questions and options; Start again remounts, so it reshuffles. */
  const [questions] = useState(() => shuffleQuestions(toAsk))
  const [lastTime] = useState(previous)
  const [index, setIndex] = useState(0)
  /** Option picked for the current question; set means answered. */
  const [chosen, setChosen] = useState<number>()
  const [answers, setAnswers] = useState<Answer[]>([])
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const questionRef = useRef<HTMLParagraphElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const total = questions.length
  const finished = index >= total

  useEffect(() => {
    onLeaveGuardChange(answers.length > 0 && !finished)
  }, [answers.length, finished, onLeaveGuardChange])
  useEffect(() => () => onLeaveGuardChange(false), [onLeaveGuardChange])

  // New question: start at the top, with keyboard focus on the question.
  useEffect(() => {
    window.scrollTo(0, 0)
    questionRef.current?.focus({ preventScroll: true })
  }, [index])

  // Answered: bring the explanation and the Next button into view.
  useEffect(() => {
    if (chosen === undefined) return
    nextRef.current?.focus({ preventScroll: true })
    feedbackRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [chosen])

  function answer(question: QuizQuestion, option: number) {
    if (chosen !== undefined) return
    setChosen(option)
    setAnswers((r) => [...r, { questionId: question.id, correct: option === question.correctIndex, chosen: option }])
  }

  function next() {
    // Saved from the click (not an effect), so a finished run is stored exactly once.
    if (index + 1 >= total) save()
    setChosen(undefined)
    setIndex((i) => i + 1)
  }

  function save() {
    saveRun({
      quizId: quiz.id,
      mode,
      finishedAt: new Date().toISOString(),
      questionIds: questions.map((q) => q.id),
      // The picked option stays in memory; history keeps only right/wrong.
      results: answers.map(({ questionId, correct }) => ({ questionId, correct })),
    }).then(
      () => setSaved(true),
      (e: Error) => setSaveError(e.message),
    )
  }

  // A reload (or Back/Forward) can land on a retry with nothing left to retry.
  if (total === 0) {
    return (
      <section className="quiz">
        <p className="muted quiz-title">{quiz.title}</p>
        <div className="panel">
          <p>No missed questions to retry right now.</p>
          <div className="actions">
            <button type="button" className="button" onClick={onQuit}>
              Back
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (finished) {
    return (
      <QuizSummary
        quiz={quiz}
        mode={mode}
        questions={questions}
        answers={answers}
        previous={lastTime}
        saveError={saveError}
        // Counted once this run is stored, so it includes this run's answers.
        retryCount={saved ? missedCount : undefined}
        onRetryMissed={onRetryMissed}
        onRestart={onRestart}
        onBackToList={onBackToList}
      />
    )
  }

  const question = questions[index]
  const answered = chosen !== undefined
  const correct = chosen === question.correctIndex

  return (
    <section className="quiz">
      <header className="quiz-header">
        <div>
          <p className="muted">{quiz.title}</p>
          {mode === 'retry' && <p className="muted">Retry missed</p>}
          <p>
            <strong>
              Question {index + 1} of {total}
            </strong>
          </p>
          <ScoreTally results={answers} />
        </div>
        <button type="button" className="button" onClick={onQuit}>
          Quit
        </button>
      </header>
      <div
        className="progress"
        role="progressbar"
        aria-label="Answered"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answers.length}
        aria-valuetext={`${answers.length} of ${total} answered`}
      >
        <div className="progress-fill" style={{ width: `${(answers.length / total) * 100}%` }} />
      </div>

      <p className="question-text" ref={questionRef} tabIndex={-1}>
        {question.question}
      </p>

      <ol className="options">
        {question.options.map((text, i) => {
          const mark = answered && i === question.correctIndex ? 'correct' : i === chosen ? 'wrong' : ''
          return (
            <li key={i}>
              <button
                type="button"
                className={`option ${mark}`}
                disabled={answered}
                onClick={() => answer(question, i)}
              >
                <span className="option-letter" aria-hidden="true">
                  {OPTION_LETTERS[i]}
                </span>
                <span className="option-text">{text}</span>
                {mark && (
                  <span
                    className="option-mark"
                    role="img"
                    aria-label={mark === 'correct' ? 'correct answer' : 'your answer, wrong'}
                  >
                    {mark === 'correct' ? '✓' : '✗'}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      {answered && (
        <div className="feedback" ref={feedbackRef}>
          <div className={`panel ${correct ? 'success' : 'error'}`} role="status">
            <p>
              <strong>{correct ? 'Correct' : 'Wrong'}</strong>
              {!correct && ' — the correct answer is marked.'}
            </p>
            <p className="explanation">{question.explanation}</p>
          </div>
          <SourceReference reference={question.reference} sources={quiz.sources} />
          <div className="actions">
            <button type="button" className="button primary" ref={nextRef} onClick={next}>
              {index + 1 < total ? 'Next' : 'Finish'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Running count of right and wrong answers; the icons are extra, the words carry the meaning. */
function ScoreTally({ results }: { results: QuestionResult[] }) {
  const { correct, wrong } = countResults(results)
  return (
    <p className="tally">
      <span className="tally-correct" aria-hidden="true">
        ✓
      </span>{' '}
      {correct} correct ·{' '}
      <span className="tally-wrong" aria-hidden="true">
        ✗
      </span>{' '}
      {wrong} wrong
    </p>
  )
}
