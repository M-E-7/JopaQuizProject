import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MAX_EXAM_MINUTES } from '../exam.ts'
import { plural } from '../format.ts'
import type { ExamSettings } from '../platform/index.ts'
import type { QuizSet } from '../quiz/types.ts'

/** After Start: Study, or Exam with its settings (question count and minutes, adjustable here). */
export default function ModeChoice({
  quiz,
  examSettings,
  onStudy,
  onExam,
  onBack,
}: {
  quiz: QuizSet
  /** Prefilled into the exam fields. */
  examSettings: ExamSettings
  onStudy: () => void
  onExam: (settings: ExamSettings) => void
  onBack: () => void
}) {
  const available = quiz.questions.length
  // Kept as typed, so a field can be empty while editing.
  const [count, setCount] = useState(String(examSettings.questionCount))
  const [minutes, setMinutes] = useState(String(examSettings.timeLimitMinutes))
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [])

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
        <p>All questions. Each answer is checked at once, with the explanation and the source.</p>
        <div className="actions">
          <button type="button" className="button primary" onClick={onStudy}>
            Start study
          </button>
        </div>
      </section>

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
    </section>
  )
}

/** The typed whole number if it lies in [min, max], else undefined. */
function wholeNumber(text: string, min: number, max: number): number | undefined {
  if (!/^\d+$/.test(text.trim())) return undefined
  const n = Number(text)
  return n >= min && n <= max ? n : undefined
}
