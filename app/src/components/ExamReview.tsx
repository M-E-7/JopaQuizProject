import type { RefObject } from 'react'
import { needsAttention } from '../exam.ts'
import type { QuizQuestion } from '../quiz/types.ts'

/** "attention" lists marked and unanswered questions first, each group in exam order. */
export type ReviewOrder = 'exam' | 'attention'

/**
 * The exam's last page before handing in: every question with its state
 * (answered / not answered / marked). A row opens that question again.
 */
export default function ExamReview({
  questions,
  chosen,
  marked,
  order,
  onOrderChange,
  onOpenQuestion,
  onBack,
  onHandIn,
  headingRef,
}: {
  questions: QuizQuestion[]
  chosen: ReadonlyMap<string, number>
  marked: ReadonlySet<string>
  order: ReviewOrder
  onOrderChange: (order: ReviewOrder) => void
  /** Index in the exam's order. */
  onOpenQuestion: (index: number) => void
  onBack: () => void
  onHandIn: () => void
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const rows = questions.map((question, index) => ({
    question,
    index,
    answered: chosen.has(question.id),
    flagged: marked.has(question.id),
  }))
  const attention = (r: (typeof rows)[number]) => needsAttention(r.question.id, chosen, marked)
  const shown = order === 'exam' ? rows : [...rows.filter(attention), ...rows.filter((r) => !attention(r))]

  return (
    <section className="review" aria-labelledby="review-heading">
      <h2 id="review-heading" className="review-heading" ref={headingRef} tabIndex={-1}>
        Review before handing in
      </h2>
      <p className="muted">
        {chosen.size} of {questions.length} answered{marked.size > 0 && ` · ${marked.size} marked`}
      </p>

      <div className="review-order" role="group" aria-label="Order">
        <OrderButton current={order} value="exam" onChange={onOrderChange}>
          Exam order
        </OrderButton>
        <OrderButton current={order} value="attention" onChange={onOrderChange}>
          Needs attention first
        </OrderButton>
      </div>

      <ul className="review-list">
        {shown.map(({ question, index, answered, flagged }) => (
          <li key={question.id}>
            <button
              type="button"
              className={`review-item ${answered ? '' : 'unanswered'} ${flagged ? 'marked' : ''}`}
              onClick={() => onOpenQuestion(index)}
            >
              <strong>Question {index + 1}</strong>
              <span className="review-preview">{question.question}</span>
              <span className="review-status">
                {answered ? (
                  <span>
                    <span aria-hidden="true">✓</span> Answered
                  </span>
                ) : (
                  <span>
                    <span aria-hidden="true">—</span> Not answered
                  </span>
                )}
                {flagged && (
                  <span className="review-flag">
                    <span aria-hidden="true">⚑</span> Marked
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="actions">
        <button type="button" className="button" onClick={onBack}>
          Back to exam
        </button>
        <button type="button" className="button primary" onClick={onHandIn}>
          Hand in
        </button>
      </div>
    </section>
  )
}

function OrderButton({
  current,
  value,
  onChange,
  children,
}: {
  current: ReviewOrder
  value: ReviewOrder
  onChange: (order: ReviewOrder) => void
  children: string
}) {
  return (
    <button
      type="button"
      className="review-order-button"
      aria-pressed={current === value}
      onClick={() => onChange(value)}
    >
      {children}
    </button>
  )
}
