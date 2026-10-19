import type { QuizLocation, QuizReference, QuizSource } from '../quiz/types.ts'

/** Where in the document the passage is; the paragraph number is left out (it rarely matches Word's count). */
function describeLocation(location: QuizLocation): string {
  switch (location.type) {
    case 'section':
      return location.headingPath.join(' › ')
    case 'row':
      return `row ${location.row}`
    case 'page':
      return [`page ${location.page}`, location.headingPath?.join(' › ')].filter(Boolean).join(' · ')
  }
}

/** A CSV quote "Column: value | Column: value", one column per line. */
function RowQuote({ quote }: { quote: string }) {
  return quote.split(' | ').map((part, i) => {
    const colon = part.indexOf(': ')
    return (
      <span key={i} className="reference-row">
        {colon < 0 ? (
          part
        ) : (
          <>
            <strong>{part.slice(0, colon)}</strong>
            {part.slice(colon)}
          </>
        )}
      </span>
    )
  })
}

export default function SourceReference({
  reference,
  sources,
}: {
  reference: QuizReference
  sources: QuizSource[]
}) {
  const source = sources.find((s) => s.id === reference.sourceId)
  const name = source ? (source.title ?? source.fileName) : reference.sourceId
  const location = describeLocation(reference.location)

  return (
    <figure className="reference">
      <figcaption>
        <span className="reference-label">Source</span> <cite>{name}</cite>
        {location && <span className="reference-location">{location}</span>}
      </figcaption>
      <blockquote>
        {reference.location.type === 'row' ? <RowQuote quote={reference.quote} /> : reference.quote}
      </blockquote>
    </figure>
  )
}
