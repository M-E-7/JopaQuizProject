import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MAX_EXAM_MINUTES } from '../exam.ts'
import { plural } from '../format.ts'
import type { ExamSettings } from '../platform/index.ts'
import type { QuizSet } from '../quiz/types.ts'
import { LEARNED_AFTER } from '../score.ts'
import ConfirmDialog from './ConfirmDialog.tsx'

/**
 * After Start: Study of the questions not learned yet (with a reset), Exam with
 * its settings (question count and minutes, adjustable here), or Retry of the
 * still-missed questions.
 */
export default function ModeChoice({
  quiz,
  examSettings,
  missedCount,
  studyCount,
  learnedCount,
  onResetLearned,
  onStudy,
  onExam,
  onRetry,
  onBack,
}: {
  quiz: QuizSet
  /** Prefilled into the exam fields. */
  examSettings: ExamSettings
  /** Questions whose latest answer was wrong or not given. */
  missedCount: number
  /** Questions Study asks: the ones not learned yet. */
  studyCount: number
  learnedCount: number
  /** Puts every learned question back into Study (after the confirmation here). */
  onResetLearned: () => Promise<void>
  onStudy: () => void
  onExam: (settings: ExamSettings) => void
  onRetry: () => void
  onBack: () => void
}) {
  const available = quiz.questions.length
  // Kept as typed, so a field can be empty while editing.
  const [count, setCount] = useState(String(examSettings.questionCount))
  const [minutes, setMinutes] = useState(String(examSettings.timeLimitMinutes))
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetError, setResetError] = useState<string>()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  function resetLearned() {
    setConfirmingReset(false)
    setResetError(undefined)
    onResetLearned().catch((e: Error) => setResetError(e.message))
  }

  const questionCount = wholeNumber(count, 1, available)
  const timeLimitMinutes = wholeNumber(minutes, 1, MAX_EXAM_MINUTES)

  function startExam(event: FormEvent) {
    event.preventDefault()
    if (questionCount !== undefined && timeLimitMinutes !== undefined) onExam({ questionCount, timeLimitMinutes })
  }

  return (
    <section className="quiz">
      <header className="quiz-header">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="mode-heading">
            {quiz.title}
          </h1>
          <p className="muted">{plural(available, 'question')}</p>
        </div>
        <button type="button" className="button" onClick={onBack}>
          Back
        </button>
      </header>

      <section className="panel mode" aria-labelledby="study-heading">
        <h2 id="study-heading">Study</h2>
        {studyCount > 0 ? (
          <p>The questions you haven't learned yet. Each answer is checked at once, with the explanation and the source.</p>
        ) : (
          <p>All questions in this set are learned.</p>
        )}
        <p className="muted">
          {studyCount} to study · {learnedCount} learned. A question is learned after {LEARNED_AFTER} correct answers
          (a wrong one takes one away) and then stays out of Study.
        </p>
        {resetError && (
          <p className="panel error" role="alert">
            Couldn't reset the learned questions: {resetError}
          </p>
        )}
        <div className="actions">
          <button type="button" className="button primary" disabled={studyCount === 0} onClick={onStudy}>
            Start study
          </button>
          {learnedCount > 0 && (
            <button type="button" className="button" onClick={() => setConfirmingReset(true)}>
              Reset learned questions
            </button>
          )}
        </div>
      </section>
      <ConfirmDialog
        open={confirmingReset}
        confirmLabel="Reset"
        cancelLabel="Keep them"
        danger
        onConfirm={resetLearned}
        onCancel={() => setConfirmingReset(false)}
      >
        <p>
          Reset learned questions? All {plural(learnedCount, 'question')} come back into Study and count from 0 again.
          Your score history is kept.
        </p>
      </ConfirmDialog>

      <form className="panel mode" aria-labelledby="exam-heading" onSubmit={startExam} noValidate>
        <h2 id="exam-heading">Exam</h2>
        <p>
          Random questions against the clock. No feedback until you hand in; you can go back and change answers.
          Unanswered questions count as missed.
        </p>
        <div className="exam-settings">
          <label>
            <span>Questions</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={available}
              step={1}
              value={count}
              aria-invalid={questionCount === undefined}
              aria-describedby="exam-count-hint"
              onChange={(e) => setCount(e.target.value)}
            />
          </label>
          <label>
            <span>Minutes</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_EXAM_MINUTES}
              step={1}
              value={minutes}
              aria-invalid={timeLimitMinutes === undefined}
              aria-describedby={timeLimitMinutes === undefined ? 'exam-minutes-hint' : undefined}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
        </div>
        <p id="exam-count-hint" className={questionCount === undefined ? 'field-error' : 'field-hint muted'}>
          {available === 1 ? 'The set has 1 question.' : `1 to ${available} questions.`}
        </p>
        {timeLimitMinutes === undefined && (
          <p id="exam-minutes-hint" className="field-error">
            1 to {MAX_EXAM_MINUTES} minutes.
          </p>
        )}
        <div className="actions">
          <button
            type="submit"
            className="button primary"
            disabled={questionCount === undefined || timeLimitMinutes === undefined}
          >
            Start exam
          </button>
        </div>
      </form>

      <section className="panel mode" aria-labelledby="retry-heading">
        <h2 id="retry-heading">Missed questions</h2>
        {missedCount > 0 ? (
          <p>
            {plural(missedCount, 'question')} you got wrong or left unanswered the last time you saw {missedCount === 1 ? 'it' : 'them'}. Each answer is checked at once; answer one right
            and it leaves this list.
          </p>
        ) : (
          <p>
            No missed questions right now. Questions you get wrong or leave unanswered in a run show up here until you
            answer them right.
          </p>
        )}
        <div className="actions">
          <button type="button" className="button primary" disabled={missedCount === 0} onClick={onRetry}>
            Retry missed
          </button>
        </div>
      </section>
    </section>
  )
}

/** The typed whole number if it lies in [min, max], else undefined. */
function wholeNumber(text: string, min: number, max: number): number | undefined {
  if (!/^\d+$/.test(text.trim())) return undefined
  const n = Number(text)
  return n >= min && n <= max ? n : undefined
}
