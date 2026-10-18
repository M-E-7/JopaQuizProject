import { formatDate, plural } from '../format.ts'
import type { QuizSetSummary } from '../platform/index.ts'

export default function QuizList({ quizzes }: { quizzes: QuizSetSummary[] }) {
  if (quizzes.length === 0) return <p className="muted">No quizzes imported yet.</p>
  return (
    <ul className="quiz-list">
      {quizzes.map((q) => (
        <li key={q.id} className="panel">
          <strong>{q.title}</strong>
          <span className="muted">
            {plural(q.questionCount, 'question')} · imported {formatDate(q.importedAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}
