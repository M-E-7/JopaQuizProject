import { useEffect, useRef, useState } from 'react'
import { formatDuration, OPTION_LETTERS, plural } from '../format.ts'
import { platform, type ExamRunInfo, type ExamSettings } from '../platform/index.ts'
import type { QuizSet } from '../quiz/types.ts'
import type { Answer } from '../score.ts'
import { shuffleQuestions } from '../shuffle.ts'
import ConfirmDialog from './ConfirmDialog.tsx'
import QuizSummary from './QuizSummary.tsx'
import { usePreviousRun } from './usePreviousRun.ts'

/** Seconds left at which the countdown turns red. */
const LOW_TIME_SECONDS = 60

/**
 * Exam mode: a random selection of questions against the clock. Answers can be
 * changed until handed in; nothing is checked before. At 0 it hands in by itself.
 */
export default function ExamRun({
  quiz,
  settings,
  onQuit,
  onBackToList,
  onRestart,
  onLeaveGuardChange,
}: {
  quiz: QuizSet
  settings: ExamSettings
  onQuit: () => void
  onBackToList: () => void
  onRestart: () => void
  onLeaveGuardChange: (needed: boolean) => void
}) {
  /** This exam's questions and option order; Start again remounts, so it picks anew. */
  const [questions] = useState(() => shuffleQuestions(quiz.questions).slice(0, settings.questionCount))
  /** The clock runs on real time, so it keeps going while the app is in the background. */
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const [index, setIndex] = useState(0)
  /** Picked option per question id. */
  const [chosen, setChosen] = useState<ReadonlyMap<string, number>>(() => new Map())
  const [confirmingHandIn, setConfirmingHandIn] = useState(false)
  const [result, setResult] = useState<{ answers: Answer[]; exam: ExamRunInfo }>()
  const previous = usePreviousRun(quiz, 'exam')
  const [saveError, setSaveError] = useState<string>()
  const questionRef = useRef<HTMLParagraphElement>(null)
  /** Set on hand-in, so the clock and a tap in the same moment can't save twice. */
  const handedIn = useRef(false)

  const total = questions.length
  const limitSeconds = settings.timeLimitMinutes * 60
  const deadline = startedAt + limitSeconds * 1000

  useEffect(() => {
    onLeaveGuardChange(chosen.size > 0 && !result)
  }, [chosen.size, result, onLeaveGuardChange])
  useEffect(() => () => onLeaveGuardChange(false), [onLeaveGuardChange])

  // New question: start at the top, with keyboard focus on the question.
  useEffect(() => {
    window.scrollTo(0, 0)
    questionRef.current?.focus({ preventScroll: true })
  }, [index])

  /** The latest handIn for the timer, which is set up once. */
  const handInRef = useRef(handIn)
  useEffect(() => {
    handInRef.current = handIn
  })

  useEffect(() => {
    if (result) return
    const timer = setInterval(() => {
      const t = Date.now()
      if (t >= deadline) handInRef.current(true)
      else setNow(t)
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline, result])

  function choose(questionId: string, option: number) {
    setChosen((c) => new Map(c).set(questionId, option))
  }

  function requestHandIn() {
    if (chosen.size < total) setConfirmingHandIn(true)
    else handIn(false)
  }

  function handIn(timedOut: boolean) {
    if (handedIn.current) return
    handedIn.current = true
    const answers = questions.flatMap((q): Answer[] => {
      const option = chosen.get(q.id)
      return option === undefined ? [] : [{ questionId: q.id, correct: option === q.correctIndex, chosen: option }]
    })
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    const exam: ExamRunInfo = {
      ...settings,
      timeUsedSeconds: timedOut ? limitSeconds : Math.min(elapsed, limitSeconds),
      timedOut,
    }
    setConfirmingHandIn(false)
    setResult({ answers, exam })
    // Saved from the hand-in (not an effect), so the exam is stored exactly once.
    platform.storage
      .addRun({
        quizId: quiz.id,
        mode: 'exam',
        finishedAt: new Date().toISOString(),
        questionIds: questions.map((q) => q.id),
        // The picked option stays in memory; history keeps only right/wrong.
        results: answers.map(({ questionId, correct }) => ({ questionId, correct })),
        exam,
      })
      .catch((e: Error) => setSaveError(e.message))
  }

  if (result) {
    return (
      <QuizSummary
        quiz={quiz}
        mode="exam"
        exam={result.exam}
        questions={questions}
        answers={result.answers}
        previous={previous}
        saveError={saveError}
        onRestart={onRestart}
        onBackToList={onBackToList}
      />
    )
  }

  const question = questions[index]
  const picked = chosen.get(question.id)
  const answered = chosen.size
  const unanswered = total - answered
  const isLast = index === total - 1

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
          <Countdown secondsLeft={Math.max(0, Math.ceil((deadline - now) / 1000))} limitSeconds={limitSeconds} />
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
        aria-valuenow={answered}
        aria-valuetext={`${answered} of ${total} answered`}
      >
        <div className="progress-fill" style={{ width: `${(answered / total) * 100}%` }} />
      </div>

      <p className="question-text" ref={questionRef} tabIndex={-1}>
        {question.question}
      </p>

      <ol className="options">
        {question.options.map((text, i) => {
          const selected = i === picked
          return (
            <li key={i}>
              <button
                type="button"
                className={`option ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                onClick={() => choose(question.id, i)}
              >
                <span className="option-letter" aria-hidden="true">
                  {OPTION_LETTERS[i]}
                </span>
                <span className="option-text">{text}</span>
                {selected && (
                  <span className="option-mark" aria-hidden="true">
                    ●
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="actions exam-nav">
        <button type="button" className="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          Previous
        </button>
        <button type="button" className="button primary" disabled={isLast} onClick={() => setIndex((i) => i + 1)}>
          Next
        </button>
        <button type="button" className={`button hand-in ${isLast ? 'primary' : ''}`} onClick={requestHandIn}>
          Hand in
        </button>
      </div>

      <details className="overview">
        <summary>
          Questions: {answered} of {total} answered
        </summary>
        <ol className="overview-grid">
          {questions.map((q, i) => {
            const done = chosen.has(q.id)
            return (
              <li key={q.id}>
                <button
                  type="button"
                  className={`overview-item ${done ? 'answered' : ''}`}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={`Question ${i + 1}, ${done ? 'answered' : 'not answered'}`}
                  onClick={() => setIndex(i)}
                >
                  {i + 1}
                </button>
              </li>
            )
          })}
        </ol>
      </details>

      <ConfirmDialog
        open={confirmingHandIn}
        confirmLabel="Hand in"
        cancelLabel="Keep going"
        onConfirm={() => handIn(false)}
        onCancel={() => setConfirmingHandIn(false)}
      >
        <p>
          {plural(unanswered, 'question')} not answered yet. Unanswered questions count as missed. Hand in anyway?
        </p>
      </ConfirmDialog>
    </section>
  )
}

/** Time left, red in the last minute; screen readers hear it at 5 minutes and at 1 minute. */
function Countdown({ secondsLeft, limitSeconds }: { secondsLeft: number; limitSeconds: number }) {
  const low = secondsLeft <= LOW_TIME_SECONDS
  const notice =
    secondsLeft <= 60 && limitSeconds > 60
      ? '1 minute left'
      : secondsLeft <= 300 && limitSeconds > 300
        ? '5 minutes left'
        : ''
  return (
    <p className={`timer ${low ? 'low' : ''}`}>
      <span aria-hidden="true">⏱</span>{' '}
      <span role="timer">
        <span className="visually-hidden">Time left: </span>
        {formatDuration(secondsLeft)}
      </span>
      <span className="visually-hidden" aria-live="polite">
        {notice}
      </span>
    </p>
  )
}
