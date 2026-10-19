import { useEffect, useRef, useState } from 'react'
import { platform, type QuestionResult } from '../platform/index.ts'
import type { QuizQuestion, QuizSet } from '../quiz/types.ts'
import { countResults, historySummary, type Answer, type RunScore } from '../score.ts'
import { shuffleQuestions } from '../shuffle.ts'
import QuizSummary from './QuizSummary.tsx'
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
  /** Bumped by "Start again": a new key remounts the quiz with fresh state. */
  const [attempt, setAttempt] = useState(0)

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
  return (
    <Quiz
      key={attempt}
      quiz={load.quiz}
      onQuit={onQuit}
      onRestart={() => setAttempt((a) => a + 1)}
      onLeaveGuardChange={onLeaveGuardChange}
    />
  )
}

function Quiz({
  quiz,
  onQuit,
  onRestart,
  onLeaveGuardChange,
}: {
  quiz: QuizSet
  onQuit: () => void
  onRestart: () => void
  onLeaveGuardChange: (needed: boolean) => void
}) {
  /** This run's order of questions and options; Start again remounts, so it reshuffles. */
  const [questions] = useState(() => shuffleQuestions(quiz.questions))
  const [index, setIndex] = useState(0)
  /** Option picked for the current question; set means answered. */
  const [chosen, setChosen] = useState<number>()
  const [answers, setAnswers] = useState<Answer[]>([])
  /** Score of the set's latest saved run before this one, for the summary. */
  const [previous, setPrevious] = useState<RunScore>()
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

  // Loaded before this run is saved; Start again remounts, so it then finds the run just finished.
  useEffect(() => {
    let cancelled = false
    const questionIds = new Set(quiz.questions.map((q) => q.id))
    platform.storage.listRuns(quiz.id).then(
      (runs) => {
        if (!cancelled) setPrevious(historySummary(runs, questionIds).last)
      },
      // Without it the summary just leaves out "Last time".
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [quiz])

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
    platform.storage
      .addRun({
        quizId: quiz.id,
        finishedAt: new Date().toISOString(),
        // The picked option stays in memory; history keeps only right/wrong.
        results: answers.map(({ questionId, correct }) => ({ questionId, correct })),
      })
      .catch((e: Error) => setSaveError(e.message))
  }

  if (finished) {
    return (
      <QuizSummary
        quiz={quiz}
        questions={questions}
        answers={answers}
        previous={previous}
        saveError={saveError}
        onRestart={onRestart}
        onQuit={onQuit}
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
