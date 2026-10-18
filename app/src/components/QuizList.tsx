import { formatDate, plural } from '../format.ts'
import type { QuizSetSummary } from '../platform/index.ts'

export default function QuizList({
  quizzes,
  onStart,
  onDelete,
}: {
  quizzes: QuizSetSummary[]
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
