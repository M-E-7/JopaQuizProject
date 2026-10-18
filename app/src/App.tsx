import { useCallback, useEffect, useState } from 'react'
import ImportQuiz from './components/ImportQuiz.tsx'
import QuizList from './components/QuizList.tsx'
import { platform, type QuizSetSummary } from './platform/index.ts'

function App() {
  const [quizzes, setQuizzes] = useState<QuizSetSummary[]>()
  const [loadError, setLoadError] = useState<string>()

  const loadQuizzes = useCallback(() => {
    platform.storage.listQuizSets().then(setQuizzes, (e: Error) => setLoadError(e.message))
  }, [])
  useEffect(loadQuizzes, [loadQuizzes])

  return (
    <main className="app">
      <h1>JopaQuiz</h1>
      {loadError ? (
        <p className="panel error" role="alert">
          Couldn't read the quizzes stored on this device: {loadError}
        </p>
      ) : (
        quizzes && <QuizList quizzes={quizzes} />
      )}
      <ImportQuiz onImported={loadQuizzes} />
      <footer className="version muted">
        {__BUILD_DATE__} · {__COMMIT__}
      </footer>
    </main>
  )
}

export default App
