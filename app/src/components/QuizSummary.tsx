import { useEffect, useRef } from 'react'
import type { ExamRunInfo, QuizMode } from '../platform/index.ts'
import type { QuizQuestion, QuizSet } from '../quiz/types.ts'
import { formatDate, formatDuration, plural } from '../format.ts'
import { countResults, scorePercent, type Answer, type RunScore } from '../score.ts'
import SourceReference from './SourceReference.tsx'

const SUMMARY_HEADINGS: Record<QuizMode, string> = {
  study: 'Quiz finished',
  exam: 'Exam finished',
  retry: 'Retry finished',
}

/**
 * End of a run (Study, Exam or Retry): score, percentage, time used for an exam, and
 * the missed questions (wrong or not answered), each collapsed until tapped.
 */
export default function QuizSummary({
  quiz,
  mode,
  exam,
  questions,
  answers,
  previous,
  learnedCount = 0,
  saveError,
  retryCount,
  onRetryMissed,
  onRestart,
  onBackToList,
}: {
  quiz: QuizSet
  mode: QuizMode
  /** Exam runs: settings, time used and whether time ran out. */
  exam?: ExamRunInfo
  /** The run's questions, in the order they were asked. */
  questions: QuizQuestion[]
  answers: Answer[]
  /** The set's previous saved run of the same mode, shown as "Last time". */
  previous?: RunScore
  /** Study / Retry: questions this run brought to the learned count. */
  learnedCount?: number
  /** Set if this run couldn't be saved. */
  saveError?: string
  /** Still-missed questions in the set once this run is saved; no Retry button while undefined or 0. */
  retryCount?: number
  onRetryMissed: () => void
  /**
   * Same mode again (not offered after a retry: its next round is Retry missed;
   * nor when undefined, a Study run with nothing left to ask).
   */
  onRestart?: () => void
  onBackToList: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  const total = questions.length
  const { correct } = countResults(answers)
  const byId = new Map(answers.map((a) => [a.questionId, a]))
  const missed = questions
    .map((question, i) => ({ question, number: i + 1, answer: byId.get(question.id) }))
    .filter(({ answer }) => !answer?.correct)

  return (
    <section className="quiz">
      <div>
        <p className="muted quiz-title">{quiz.title}</p>
        <h1 ref={headingRef} tabIndex={-1} className="summary-heading">
          {SUMMARY_HEADINGS[mode]}
        </h1>
      </div>

      <div className="panel success summary-score" role="status">
        <p className="summary-percent">{scorePercent(correct, total)}%</p>
        <p>
          {correct} of {total} correct
        </p>
        {exam && (
          <p>
            Time used: {formatDuration(exam.timeUsedSeconds)} of {formatDuration(exam.timeLimitMinutes * 60)}
          </p>
        )}
        {exam?.timedOut && <p>Time ran out — the exam was handed in automatically.</p>}
        {learnedCount > 0 && (
          <p>
            {plural(learnedCount, 'question')} learned this run — {learnedCount === 1 ? 'it' : 'they'} won't come up in
            Study again.
          </p>
        )}
        {previous && (
          <p className="muted">
            Last time: {previous.percent}% ({previous.correct} of {previous.total}) · {formatDate(previous.finishedAt)}
          </p>
        )}
      </div>

      {saveError && (
        <p className="panel error" role="alert">
          Couldn't save this result on this device: {saveError}
        </p>
      )}

      {missed.length === 0 ? (
        <p>No missed questions — all correct.</p>
      ) : (
        <section aria-labelledby="missed-heading">
          <h2 id="missed-heading" className="summary-subheading">
            Missed questions ({missed.length})
          </h2>
          <ul className="missed-list">
            {missed.map(({ question, number, answer }) => (
              <li key={question.id}>
                <MissedQuestion question={question} number={number} answer={answer} quiz={quiz} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="actions">
        {mode !== 'retry' && onRestart && (
          <button type="button" className="button primary" onClick={onRestart}>
            Start again
          </button>
        )}
        {retryCount !== undefined && retryCount > 0 && (
          <button type="button" className={mode === 'retry' ? 'button primary' : 'button'} onClick={onRetryMissed}>
            Retry missed ({retryCount})
          </button>
        )}
        <button type="button" className="button" onClick={onBackToList}>
          Back to list
        </button>
      </div>
    </section>
  )
}

function MissedQuestion({
  question,
  number,
  answer,
  quiz,
}: {
  question: QuizQuestion
  number: number
  answer: Answer | undefined
  quiz: QuizSet
}) {
  return (
    <details className="missed">
      <summary>
        <strong>Question {number}</strong>
        <span className="missed-preview">{question.question}</span>
      </summary>
      <div className="missed-body">
        <p className="question-text">{question.question}</p>
        <p className="answer-line">
          <span className="answer-wrong" aria-hidden="true">
            ✗
          </span>{' '}
          {answer ? `Your answer: ${question.options[answer.chosen]}` : 'Not answered'}
        </p>
        <p className="answer-line">
          <span className="answer-correct" aria-hidden="true">
            ✓
          </span>{' '}
          Correct answer: {question.options[question.correctIndex]}
        </p>
        <p className="explanation">{question.explanation}</p>
        <SourceReference reference={question.reference} sources={quiz.sources} />
      </div>
    </details>
  )
}
