import { formatDate, plural } from '../format.ts'
import type { QuizSetSummary } from '../platform/index.ts'

export default function QuizList({
  quizzes,
  onStart,
}: {
  quizzes: QuizSetSummary[]
  onStart: (id: string) => void
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
          <button type="button" className="button primary" onClick={() => onStart(q.id)}>
            Start
          </button>
        </li>
      ))}
    </ul>
  )
}
