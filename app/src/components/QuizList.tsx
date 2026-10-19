import { formatDate, plural } from '../format.ts'
import type { QuizMode, QuizSetSummary } from '../platform/index.ts'
import type { HistorySummary } from '../score.ts'

export default function QuizList({
  quizzes,
  history,
  onStart,
  onDelete,
}: {
  quizzes: QuizSetSummary[]
  /** Score history per quiz id; a set without runs may be missing. */
  history: Record<string, HistorySummary>
  onStart: (id: string) => void
  onDelete: (quiz: QuizSetSummary) => void
}) {
  if (quizzes.length === 0) return <p className="muted">No quizzes imported yet.</p>
  return (
    <ul className="quiz-list">
      {quizzes.map((q) => (
        <li key={q.id} className="panel">
          <div className="quiz-info">
            <strong>{q.title}</strong>
            <span className="muted">
              {plural(q.questionCount, 'question')} · imported {formatDate(q.importedAt)}
            </span>
            <LastScore history={history[q.id]} />
          </div>
          <div className="quiz-actions">
            <button type="button" className="button primary" onClick={() => onStart(q.id)}>
              Start
            </button>
            <button type="button" className="button" aria-label={`Delete ${q.title}`} onClick={() => onDelete(q)}>
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

const MODE_LABELS: Record<QuizMode, string> = { study: 'Study', exam: 'Exam', retry: 'Retry' }

/** "Last: Exam 85% (17 of 20) · 18 Oct 2026 · 3 runs" (latest run of any mode); nothing for a set never finished. */
function LastScore({ history }: { history: HistorySummary | undefined }) {
  const last = history?.last
  if (!last) return null
  return (
    <span className="muted">
      Last: {MODE_LABELS[last.mode]} {last.percent}% ({last.correct} of {last.total}) ·{' '}
      {formatDate(last.finishedAt)} ·{' '}
      {plural(history.count, 'run')}
    </span>
  )
}
