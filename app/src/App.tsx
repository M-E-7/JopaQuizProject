import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmDialog from './components/ConfirmDialog.tsx'
import { plural } from './format.ts'
import ImportQuiz from './components/ImportQuiz.tsx'
import QuizList from './components/QuizList.tsx'
import QuizScreen from './components/QuizScreen.tsx'
import { platform, type QuizMode, type QuizSetSummary } from './platform/index.ts'
import { historySummary, type HistorySummary } from './score.ts'

/** No quiz = the list; a quiz without a mode = its mode choice; both = a run. */
interface Screen {
  quizId?: string
  mode?: QuizMode
}

/**
 * Screens use browser history without changing the URL: Start pushes `{ quizId }`
 * (mode choice) and picking a mode pushes `{ quizId, mode }`, so Back (Android's
 * back button too) goes run → mode choice → list. "Retry missed" on a summary
 * replaces the finished run's entry.
 */
function screenFromState(state: unknown): Screen {
  const { quizId, mode } = (state ?? {}) as { quizId?: unknown; mode?: unknown }
  if (typeof quizId !== 'string') return {}
  return { quizId, mode: mode === 'study' || mode === 'exam' || mode === 'retry' ? mode : undefined }
}

/** The stored sets plus each one's score history, counted against its current questions. */
async function loadList(): Promise<{ quizzes: QuizSetSummary[]; runHistory: Record<string, HistorySummary> }> {
  const quizzes = await platform.storage.listQuizSets()
  const runs = await Promise.all(quizzes.map((q) => platform.storage.listRuns(q.id)))
  const runHistory = Object.fromEntries(quizzes.map((q, i) => [q.id, historySummary(runs[i], new Set(q.questionIds))]))
  return { quizzes, runHistory }
}

function App() {
  const [quizzes, setQuizzes] = useState<QuizSetSummary[]>()
  /** Score history per quiz id (not `history`: that name is the browser's History API, used below). */
  const [runHistory, setRunHistory] = useState<Record<string, HistorySummary>>({})
  const [loadError, setLoadError] = useState<string>()
  const [screen, setScreen] = useState(() => screenFromState(history.state))
  const { quizId, mode } = screen
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  /** The set whose Delete was tapped, while the confirmation is open. */
  const [deleting, setDeleting] = useState<QuizSetSummary>()
  const [deleteError, setDeleteError] = useState<string>()
  /** True while leaving the quiz would lose answers; set by QuizScreen. */
  const leaveGuard = useRef(false)
  /** Set by the exam's review page: Back closes it instead of leaving the run. */
  const backOverride = useRef<() => void>(undefined)

  const loadQuizzes = useCallback(() => {
    loadList().then(({ quizzes, runHistory }) => {
      setQuizzes(quizzes)
      setRunHistory(runHistory)
    }, (e: Error) => setLoadError(e.message))
  }, [])
  // Also on coming back from a quiz, so a run just finished shows in the list.
  useEffect(() => {
    if (!quizId) loadQuizzes()
  }, [quizId, loadQuizzes])

  const setLeaveGuard = useCallback((needed: boolean) => {
    leaveGuard.current = needed
  }, [])
  const setBackOverride = useCallback((handler: (() => void) | undefined) => {
    backOverride.current = handler
  }, [])

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const next = screenFromState(event.state)
      const leavingRun = next.quizId !== quizId || next.mode !== mode
      if (backOverride.current && leavingRun) {
        // Back on the review page: stay in the run and go back to its questions.
        history.pushState({ quizId, mode }, '')
        backOverride.current()
        return
      }
      if (leaveGuard.current && leavingRun) {
        // Back pressed mid-run: put the run's entry back and ask first.
        history.pushState({ quizId, mode }, '')
        setConfirmingLeave(true)
        return
      }
      setConfirmingLeave(false)
      setScreen(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [quizId, mode])

  function show(next: Screen) {
    history.pushState(next, '')
    setScreen(next)
  }

  /** A finished run's summary → a run of another mode in its place, so Back still goes to the mode choice. */
  function switchMode(next: QuizMode) {
    history.replaceState({ quizId, mode: next }, '')
    setScreen({ quizId, mode: next })
  }

  /** One step back: run → mode choice → list. Asks first if a run would lose answers. */
  function requestBack() {
    if (leaveGuard.current) setConfirmingLeave(true)
    else leave()
  }

  /** From a finished run (or an error), skipping the mode choice. */
  function backToList() {
    history.go(mode ? -2 : -1)
  }

  /** Quit (or Leave in the dialog) leaves the run, from its review page too. */
  function leave() {
    leaveGuard.current = false
    backOverride.current = undefined
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
          <QuizScreen
            key={quizId}
            quizId={quizId}
            mode={mode}
            onChooseMode={(m) => show({ quizId, mode: m })}
            onSwitchMode={switchMode}
            onBack={requestBack}
            onBackToList={backToList}
            onLeaveGuardChange={setLeaveGuard}
            onBackOverrideChange={setBackOverride}
          />
          <ConfirmDialog
            open={confirmingLeave}
            confirmLabel="Leave"
            cancelLabel="Keep going"
            onConfirm={leave}
            onCancel={() => setConfirmingLeave(false)}
          >
            <p>Leave this {mode === 'exam' ? 'exam' : 'quiz'}? Your answers so far won't be kept.</p>
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
            quizzes && <QuizList quizzes={quizzes} history={runHistory} onStart={(id) => show({ quizId: id })} onDelete={setDeleting} />
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
