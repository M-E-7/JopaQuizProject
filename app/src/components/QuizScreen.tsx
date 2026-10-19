import { useEffect, useState } from 'react'
import { examSettingsFor } from '../exam.ts'
import { platform, type ExamSettings, type QuizMode } from '../platform/index.ts'
import type { QuizSet } from '../quiz/types.ts'
import ExamRun from './ExamRun.tsx'
import ModeChoice from './ModeChoice.tsx'
import StudyRun from './StudyRun.tsx'

type Load =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; quiz: QuizSet; examSettings: ExamSettings }

/** One quiz set: its mode choice, or a Study / Exam run. */
export default function QuizScreen({
  quizId,
  mode,
  onChooseMode,
  onBack,
  onBackToList,
  onLeaveGuardChange,
  onBackOverrideChange,
}: {
  quizId: string
  /** Undefined on the mode choice. */
  mode: QuizMode | undefined
  onChooseMode: (mode: QuizMode) => void
  /** One step back (run → mode choice → list); asks first if answers would be lost. */
  onBack: () => void
  onBackToList: () => void
  /** Called with true while leaving would lose answers given so far. */
  onLeaveGuardChange: (needed: boolean) => void
  /** Exam review page: a handler that Back calls instead of leaving the run. */
  onBackOverrideChange: (handler: (() => void) | undefined) => void
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  /** Settings picked on the mode choice in this visit; until then the stored ones. */
  const [pickedSettings, setPickedSettings] = useState<ExamSettings>()
  /** Bumped by "Start again": a new key remounts the run with fresh state. */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    Promise.all([platform.storage.getQuizSet(quizId), platform.storage.getExamSettings(quizId)]).then(
      ([stored, settings]) =>
        setLoad(
          stored
            ? {
                status: 'ready',
                quiz: stored.quiz,
                examSettings: examSettingsFor(settings, stored.quiz.questions.length),
              }
            : { status: 'missing' },
        ),
      (e: Error) => setLoad({ status: 'failed', message: e.message }),
    )
  }, [quizId])

  if (load.status === 'loading') return <p className="muted">Loading…</p>
  if (load.status !== 'ready') {
    return (
      <div className="panel error" role="alert">
        <p>
          {load.status === 'missing'
            ? 'This quiz is no longer on this device.'
            : `Couldn't read the quiz from this device: ${load.message}`}
        </p>
        <div className="actions">
          <button type="button" className="button" onClick={onBackToList}>
            Back to list
          </button>
        </div>
      </div>
    )
  }

  const examSettings = pickedSettings ?? load.examSettings

  function startExam(settings: ExamSettings) {
    setPickedSettings(settings)
    // Remembered for next time; if saving fails, this exam still uses them.
    platform.storage.saveExamSettings(quizId, settings).catch(() => {})
    onChooseMode('exam')
  }

  const runProps = {
    quiz: load.quiz,
    onQuit: onBack,
    onBackToList,
    onRestart: () => setAttempt((a) => a + 1),
    onLeaveGuardChange,
  }
  if (mode === 'study') return <StudyRun key={attempt} {...runProps} />
  if (mode === 'exam') return (
      <ExamRun key={attempt} settings={examSettings} onBackOverrideChange={onBackOverrideChange} {...runProps} />
    )
  return (
    <ModeChoice
      quiz={load.quiz}
      examSettings={examSettings}
      onStudy={() => onChooseMode('study')}
      onExam={startExam}
      onBack={onBack}
    />
  )
}
