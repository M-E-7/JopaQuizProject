import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmDialog from './components/ConfirmDialog.tsx'
import { plural } from './format.ts'
import ImportQuiz from './components/ImportQuiz.tsx'
import QuizList from './components/QuizList.tsx'
import QuizScreen from './components/QuizScreen.tsx'
import { platform, type QuizSetSummary } from './platform/index.ts'

/**
 * Screens use browser history without changing the URL: starting a quiz pushes
 * an entry `{ quizId }`, so Back (Android's back button too) returns to the list.
 */
function quizIdFromState(state: unknown): string | undefined {
  const quizId = (state as { quizId?: unknown } | null)?.quizId
  return typeof quizId === 'string' ? quizId : undefined
}

function App() {
  const [quizzes, setQuizzes] = useState<QuizSetSummary[]>()
  const [loadError, setLoadError] = useState<string>()
  const [quizId, setQuizId] = useState(() => quizIdFromState(history.state))
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  /** The set whose Delete was tapped, while the confirmation is open. */
  const [deleting, setDeleting] = useState<QuizSetSummary>()
  const [deleteError, setDeleteError] = useState<string>()
  /** True while leaving the quiz would lose answers; set by QuizScreen. */
  const leaveGuard = useRef(false)

  const loadQuizzes = useCallback(() => {
    platform.storage.listQuizSets().then(setQuizzes, (e: Error) => setLoadError(e.message))
  }, [])
  useEffect(loadQuizzes, [loadQuizzes])

  const setLeaveGuard = useCallback((needed: boolean) => {
    leaveGuard.current = needed
  }, [])

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const next = quizIdFromState(event.state)
      if (leaveGuard.current && next !== quizId) {
        // Back pressed mid-quiz: put the quiz entry back and ask first.
        history.pushState({ quizId }, '')
        setConfirmingLeave(true)
        return
      }
      setConfirmingLeave(false)
      setQuizId(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [quizId])

  function startQuiz(id: string) {
    history.pushState({ quizId: id }, '')
    setQuizId(id)
  }

  function requestLeave() {
    if (leaveGuard.current) setConfirmingLeave(true)
    else history.back()
  }

  function leave() {
    leaveGuard.current = false
    setConfirmingLeave(false)
    history.back()
  }

  async function deleteQuiz(quiz: QuizSetSummary) {
    setDeleting(undefined)
    try {
      await platform.storage.deleteQuizSet(quiz.id)
      setDeleteError(undefined)
    } catch (e) {
      setDeleteError(`Couldn't delete ${quiz.title}: ${(e as Error).message}`)
    }
    loadQuizzes()
  }

  return (
    <main className="app">
      {quizId ? (
        <>
          <QuizScreen key={quizId} quizId={quizId} onQuit={requestLeave} onLeaveGuardChange={setLeaveGuard} />
          <ConfirmDialog
            open={confirmingLeave}
            confirmLabel="Leave"
            cancelLabel="Keep going"
            onConfirm={leave}
            onCancel={() => setConfirmingLeave(false)}
          >
            <p>Leave this quiz? Your answers so far won't be kept.</p>
          </ConfirmDialog>
        </>
      ) : (
        <>
          <h1>JopaQuiz</h1>
          {loadError ? (
            <p className="panel error" role="alert">
              Couldn't read the quizzes stored on this device: {loadError}
            </p>
          ) : (
            quizzes && <QuizList quizzes={quizzes} onStart={startQuiz} onDelete={setDeleting} />
          )}
          {deleteError && (
            <p className="panel error" role="alert">
              {deleteError}
            </p>
          )}
          <ImportQuiz onImported={loadQuizzes} />
          <ConfirmDialog
            open={deleting !== undefined}
            confirmLabel="Delete"
            cancelLabel="Keep it"
            danger
            onConfirm={() => deleting && deleteQuiz(deleting)}
            onCancel={() => setDeleting(undefined)}
          >
            {deleting && (
              <p>
                Delete <strong>{deleting.title}</strong> ({plural(deleting.questionCount, 'question')}) from this
                device? Its score history is deleted too. You can import the file again, but the history can't be
                brought back.
              </p>
            )}
          </ConfirmDialog>
        </>
      )}
      <footer className="version muted">
        {__BUILD_DATE__} · {__COMMIT__}
      </footer>
    </main>
  )
}

export default App
