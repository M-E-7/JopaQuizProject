import { useEffect, useRef, useState } from 'react'
import { platform, type QuestionResult } from '../platform/index.ts'
import type { QuizQuestion, QuizSet } from '../quiz/types.ts'
import { countResults } from '../score.ts'
import SourceReference from './SourceReference.tsx'

type Load =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; quiz: QuizSet }

const LETTERS = ['A', 'B', 'C', 'D']

export default function QuizScreen({
  quizId,
  onQuit,
  onLeaveGuardChange,
}: {
  quizId: string
  onQuit: () => void
  /** Called with true while leaving would lose answers given so far. */
  onLeaveGuardChange: (needed: boolean) => void
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })

  useEffect(() => {
    platform.storage.getQuizSet(quizId).then(
      (stored) => setLoad(stored ? { status: 'ready', quiz: stored.quiz } : { status: 'missing' }),
      (e: Error) => setLoad({ status: 'failed', message: e.message }),
    )
  }, [quizId])

  if (load.status === 'loading') return <p className="muted">Loading…</p>
  if (load.status !== 'ready') {
    return (
      <div className="panel error" role="alert">
        <p>
          {load.status === 'missing'
            ? 'This quiz is no longer on this device.'
            : `Couldn't read the quiz from this device: ${load.message}`}
        </p>
        <div className="actions">
          <button type="button" className="button" onClick={onQuit}>
            Back to list
          </button>
        </div>
      </div>
    )
  }
  return <Quiz quiz={load.quiz} onQuit={onQuit} onLeaveGuardChange={onLeaveGuardChange} />
}

function Quiz({
  quiz,
  onQuit,
  onLeaveGuardChange,
}: {
  quiz: QuizSet
  onQuit: () => void
  onLeaveGuardChange: (needed: boolean) => void
}) {
  const [index, setIndex] = useState(0)
  /** Option picked for the current question; set means answered. */
  const [chosen, setChosen] = useState<number>()
  const [results, setResults] = useState<QuestionResult[]>([])
  const questionRef = useRef<HTMLParagraphElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const total = quiz.questions.length
  const finished = index >= total

  useEffect(() => {
    onLeaveGuardChange(results.length > 0 && !finished)
  }, [results.length, finished, onLeaveGuardChange])
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
    setResults((r) => [...r, { questionId: question.id, correct: option === question.correctIndex }])
  }

  function next() {
    setChosen(undefined)
    setIndex((i) => i + 1)
  }

  if (finished) {
    return (
      <section className="quiz">
        <p className="muted">{quiz.title}</p>
        <div className="panel success" role="status">
          <p>You've reached the end of the quiz.</p>
          <ScoreTally results={results} />
          <div className="actions">
            <button type="button" className="button primary" onClick={onQuit}>
              Back to list
            </button>
          </div>
        </div>
      </section>
    )
  }

  const question = quiz.questions[index]
  const answered = chosen !== undefined
  const correct = chosen === question.correctIndex

  return (
    <section className="quiz">
      <header className="quiz-header">
        <div>
          <p className="muted">{quiz.title}</p>
          <p>
            <strong>
              Question {index + 1} of {total}
            </strong>
          </p>
          <ScoreTally results={results} />
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
        aria-valuenow={results.length}
        aria-valuetext={`${results.length} of ${total} answered`}
      >
        <div className="progress-fill" style={{ width: `${(results.length / total) * 100}%` }} />
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
                  {LETTERS[i]}
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
