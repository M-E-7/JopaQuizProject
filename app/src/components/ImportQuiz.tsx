import { useState } from 'react'
import { platform, type StoredQuizSet } from '../platform/index.ts'
import type { QuizSet } from '../quiz/types.ts'
import { parseQuizJson, type Issue } from '../quiz/validate.ts'
import { formatDate, plural } from '../format.ts'

type State =
  | { step: 'idle' }
  | { step: 'invalid'; fileName: string; issues: Issue[] }
  | { step: 'confirm'; fileName: string; quiz: QuizSet; warnings: Issue[]; existing: StoredQuizSet }
  | { step: 'done'; quiz: QuizSet; replaced: boolean; warnings: Issue[] }
  | { step: 'failed'; message: string }

/** Longest issue list shown; the rest is summarised as "and N more". */
const MAX_ISSUES = 10

export default function ImportQuiz({ onImported }: { onImported: () => void }) {
  const [state, setState] = useState<State>({ step: 'idle' })

  async function pickFile() {
    try {
      const file = await platform.files.pickQuizFile()
      if (!file) return
      const result = parseQuizJson(file.text)
      if (!result.ok) {
        setState({ step: 'invalid', fileName: file.name, issues: result.issues })
        return
      }
      const existing = await platform.storage.getQuizSet(result.quiz.id)
      if (existing) {
        setState({ step: 'confirm', fileName: file.name, quiz: result.quiz, warnings: result.issues, existing })
      } else {
        await save(result.quiz, file.name, result.issues, false)
      }
    } catch (e) {
      setState({ step: 'failed', message: (e as Error).message })
    }
  }

  async function save(quiz: QuizSet, fileName: string, warnings: Issue[], replaced: boolean) {
    try {
      await platform.storage.saveQuizSet({ quiz, importedAt: new Date().toISOString(), fileName })
      setState({ step: 'done', quiz, replaced, warnings })
      onImported()
    } catch (e) {
      setState({ step: 'failed', message: (e as Error).message })
    }
  }

  return (
    <section className="import">
      {state.step !== 'confirm' && (
        <button type="button" className="button primary" onClick={pickFile}>
          Import quiz from file
        </button>
      )}

      {state.step === 'invalid' && (
        <div className="panel error" role="alert">
          <p>
            <strong>{state.fileName}</strong> can't be imported:
          </p>
          <IssueList issues={state.issues} />
        </div>
      )}

      {state.step === 'confirm' && (
        <div className="panel">
          <p>
            <strong>{state.quiz.title}</strong> is already on this device. Replace it with the version from{' '}
            <strong>{state.fileName}</strong>? Your score history is kept.
          </p>
          <ul className="compare">
            <li>On this device: {describe(state.existing.quiz)}</li>
            <li>In the file: {describe(state.quiz)}</li>
          </ul>
          <div className="actions">
            <button
              type="button"
              className="button primary"
              onClick={() => save(state.quiz, state.fileName, state.warnings, true)}
            >
              Replace
            </button>
            <button type="button" className="button" onClick={() => setState({ step: 'idle' })}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.step === 'done' && (
        <div className="panel success" role="status">
          <p>
            {state.replaced ? 'Replaced' : 'Imported'} <strong>{state.quiz.title}</strong> (
            {plural(state.quiz.questions.length, 'question')}).
          </p>
          {state.warnings.length > 0 && (
            <>
              <p className="muted">Warnings (the quiz works, but the file could be improved):</p>
              <IssueList issues={state.warnings} />
            </>
          )}
        </div>
      )}

      {state.step === 'failed' && (
        <div className="panel error" role="alert">
          <p>Couldn't save the quiz on this device: {state.message}</p>
        </div>
      )}
    </section>
  )
}

function IssueList({ issues }: { issues: Issue[] }) {
  const shown = issues.slice(0, MAX_ISSUES)
  return (
    <ul className="issues">
      {shown.map((issue, i) => (
        <li key={i}>
          {issue.path !== '(file)' && <code>{issue.path}</code>} {issue.message}
        </li>
      ))}
      {issues.length > shown.length && <li className="muted">… and {issues.length - shown.length} more</li>}
    </ul>
  )
}

function describe(quiz: QuizSet): string {
  return `${plural(quiz.questions.length, 'question')}, last changed ${formatDate(quiz.updatedAt ?? quiz.createdAt)}`
}
