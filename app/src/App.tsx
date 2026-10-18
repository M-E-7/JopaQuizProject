import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmDialog from './components/ConfirmDialog.tsx'
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
            quizzes && <QuizList quizzes={quizzes} onStart={startQuiz} />
          )}
          <ImportQuiz onImported={loadQuizzes} />
        </>
      )}
      <footer className="version muted">
        {__BUILD_DATE__} · {__COMMIT__}
      </footer>
    </main>
  )
}

export default App
