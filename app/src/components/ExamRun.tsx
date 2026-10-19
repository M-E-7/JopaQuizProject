import { useEffect, useRef, useState } from 'react'
import { formatDuration, OPTION_LETTERS, plural } from '../format.ts'
import { platform, type ExamRunInfo, type ExamSettings } from '../platform/index.ts'
import type { QuizSet } from '../quiz/types.ts'
import type { Answer } from '../score.ts'
import { shuffleQuestions } from '../shuffle.ts'
import ConfirmDialog from './ConfirmDialog.tsx'
import ExamReview, { type ReviewOrder } from './ExamReview.tsx'
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
  onBackOverrideChange,
}: {
  quiz: QuizSet
  settings: ExamSettings
  onQuit: () => void
  onBackToList: () => void
  onRestart: () => void
  onLeaveGuardChange: (needed: boolean) => void
  /** Set while the review page is open, so Back returns to the questions instead of leaving. */
  onBackOverrideChange: (handler: (() => void) | undefined) => void
}) {
  /** This exam's questions and option order; Start again remounts, so it picks anew. */
  const [questions] = useState(() => shuffleQuestions(quiz.questions).slice(0, settings.questionCount))
  /** The clock runs on real time, so it keeps going while the app is in the background. */
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const [index, setIndex] = useState(0)
  /** Picked option per question id. */
  const [chosen, setChosen] = useState<ReadonlyMap<string, number>>(() => new Map())
  /** Ids of questions marked to come back to; in memory only, not part of the result. */
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set())
  /** The review page before handing in, in place of the question. */
  const [reviewing, setReviewing] = useState(false)
  const [reviewOrder, setReviewOrder] = useState<ReviewOrder>('exam')
  const [confirmingHandIn, setConfirmingHandIn] = useState(false)
  const [result, setResult] = useState<{ answers: Answer[]; exam: ExamRunInfo }>()
  const previous = usePreviousRun(quiz, 'exam')
  const [saveError, setSaveError] = useState<string>()
  const questionRef = useRef<HTMLParagraphElement>(null)
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null)
  /** Set on hand-in, so the clock and a tap in the same moment can't save twice. */
  const handedIn = useRef(false)

  const total = questions.length
  const limitSeconds = settings.timeLimitMinutes * 60
  const deadline = startedAt + limitSeconds * 1000

  useEffect(() => {
    onLeaveGuardChange((chosen.size > 0 || marked.size > 0) && !result)
  }, [chosen.size, marked.size, result, onLeaveGuardChange])
  useEffect(() => () => onLeaveGuardChange(false), [onLeaveGuardChange])

  useEffect(() => {
    onBackOverrideChange(reviewing && !result ? () => setReviewing(false) : undefined)
  }, [reviewing, result, onBackOverrideChange])
  useEffect(() => () => onBackOverrideChange(undefined), [onBackOverrideChange])

  // New question or the review page: start at the top, with keyboard focus on its heading.
  useEffect(() => {
    window.scrollTo(0, 0)
    const target = reviewing ? reviewHeadingRef.current : questionRef.current
    target?.focus({ preventScroll: true })
  }, [index, reviewing])

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

  /** Marking skips ahead to the next question; unmarking stays. */
  function toggleMark(questionId: string) {
    const marking = !marked.has(questionId)
    setMarked((m) => {
      const next = new Set(m)
      if (marking) next.add(questionId)
      else next.delete(questionId)
      return next
    })
    if (marking && index < total - 1) setIndex(index + 1)
  }

  function openQuestion(i: number) {
    setIndex(i)
    setReviewing(false)
  }

  /** From the review page; asks first while questions are unanswered or still marked. */
  function requestHandIn() {
    if (chosen.size < total || marked.size > 0) setConfirmingHandIn(true)
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
  const isMarked = marked.has(question.id)
  const answered = chosen.size
  const unanswered = total - answered
  const isLast = index === total - 1
  const handInIssues = [
    unanswered > 0 && `${plural(unanswered, 'question')} not answered yet`,
    marked.size > 0 && `${plural(marked.size, 'question')} still marked`,
  ].filter(Boolean)

  return (
    <section className="quiz">
      <header className="quiz-header">
        <div>
          <p className="muted">{quiz.title}</p>
          <p>
            <strong>{reviewing ? 'Review' : `Question ${index + 1} of ${total}`}</strong>
            {!reviewing && isMarked && (
              <span className="mark-badge">
                <span aria-hidden="true">⚑</span> Marked
              </span>
            )}
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

      {reviewing ? (
        <ExamReview
          questions={questions}
          chosen={chosen}
          marked={marked}
          order={reviewOrder}
          onOrderChange={setReviewOrder}
          onOpenQuestion={openQuestion}
          onBack={() => setReviewing(false)}
          onHandIn={requestHandIn}
          headingRef={reviewHeadingRef}
        />
      ) : (
        <>
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
            <button
              type="button"
              className={`button mark ${isMarked ? 'marked' : ''}`}
              aria-pressed={isMarked}
              onClick={() => toggleMark(question.id)}
            >
              <span aria-hidden="true">⚑</span> {isMarked ? 'Marked' : 'Mark'}
            </button>
            {isLast ? (
              <button type="button" className="button primary" onClick={() => setReviewing(true)}>
                Review
              </button>
            ) : (
              <button type="button" className="button primary" onClick={() => setIndex((i) => i + 1)}>
                Next
              </button>
            )}
          </div>
          <div className="actions exam-hand-in">
            <button type="button" className="button" onClick={() => setReviewing(true)}>
              Hand in
            </button>
          </div>

          <details className="overview">
            <summary>
              Questions: {answered} of {total} answered{marked.size > 0 && ` · ${marked.size} marked`}
            </summary>
            <ol className="overview-grid">
              {questions.map((q, i) => {
                const done = chosen.has(q.id)
                const flagged = marked.has(q.id)
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      className={`overview-item ${done ? 'answered' : ''} ${flagged ? 'marked' : ''}`}
                      aria-current={i === index ? 'step' : undefined}
                      aria-label={`Question ${i + 1}, ${done ? 'answered' : 'not answered'}${flagged ? ', marked' : ''}`}
                      onClick={() => setIndex(i)}
                    >
                      {i + 1}
                      {flagged && (
                        <span className="overview-flag" aria-hidden="true">
                          ⚑
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          </details>
        </>
      )}

      <ConfirmDialog
        open={confirmingHandIn}
        confirmLabel="Hand in"
        cancelLabel="Keep going"
        onConfirm={() => handIn(false)}
        onCancel={() => setConfirmingHandIn(false)}
      >
        <p>
          {handInIssues.join(', ')}.{unanswered > 0 && ' Unanswered questions count as missed.'} Hand in anyway?
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
