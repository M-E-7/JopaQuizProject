import { useEffect, useState } from 'react'
import { examSettingsFor } from '../exam.ts'
import { platform, type ExamSettings, type QuizMode, type QuizRun } from '../platform/index.ts'
import type { QuizSet } from '../quiz/types.ts'
import { historySummary, learnedCounts, learnedIds, stillMissedIds } from '../score.ts'
import ExamRun from './ExamRun.tsx'
import ModeChoice from './ModeChoice.tsx'
import StudyRun from './StudyRun.tsx'

type Load =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; quiz: QuizSet; examSettings: ExamSettings }

/** One quiz set: its mode choice, or a Study / Exam / Retry run. Holds the set's run history. */
export default function QuizScreen({
  quizId,
  mode,
  onChooseMode,
  onSwitchMode,
  onBack,
  onBackToList,
  onLeaveGuardChange,
  onBackOverrideChange,
}: {
  quizId: string
  /** Undefined on the mode choice. */
  mode: QuizMode | undefined
  /** From the mode choice: a run on top of it. */
  onChooseMode: (mode: QuizMode) => void
  /** From a finished run: a run of another mode in its place. */
  onSwitchMode: (mode: QuizMode) => void
  /** One step back (run → mode choice → list); asks first if answers would be lost. */
  onBack: () => void
  onBackToList: () => void
  /** Called with true while leaving would lose answers given so far. */
  onLeaveGuardChange: (needed: boolean) => void
  /** Exam review page: a handler that Back calls instead of leaving the run. */
  onBackOverrideChange: (handler: (() => void) | undefined) => void
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  /** The set's saved runs, oldest first, plus the ones finished in this visit. */
  const [runs, setRuns] = useState<QuizRun[]>([])
  /** Settings picked on the mode choice in this visit; until then the stored ones. */
  const [pickedSettings, setPickedSettings] = useState<ExamSettings>()
  /** Last run id when the learned questions were reset; only later runs count. */
  const [resetAfter, setResetAfter] = useState<number>()
  /** Bumped by "Start again": a new key remounts the run with fresh state. */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    Promise.all([
      platform.storage.getQuizSet(quizId),
      platform.storage.getExamSettings(quizId),
      // Without the history there's just no "Last time" and nothing to retry.
      platform.storage.listRuns(quizId).catch((): QuizRun[] => []),
      platform.storage.getLearnedReset(quizId).catch(() => undefined),
    ]).then(
      ([stored, settings, storedRuns, reset]) => {
        setRuns(storedRuns)
        setResetAfter(reset)
        setLoad(
          stored
            ? {
                status: 'ready',
                quiz: stored.quiz,
                examSettings: examSettingsFor(settings, stored.quiz.questions.length),
              }
            : { status: 'missing' },
        )
      },
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

  const { quiz } = load
  const examSettings = pickedSettings ?? load.examSettings
  const questionIds = new Set(quiz.questions.map((q) => q.id))
  const missedIds = stillMissedIds(runs, questionIds)
  const missed = quiz.questions.filter((q) => missedIds.has(q.id))
  const counts = learnedCounts(runs, questionIds, resetAfter)
  const learned = learnedIds(counts)
  const toStudy = quiz.questions.filter((q) => !learned.has(q.id))

  /** Every question back into Study; the history itself stays. */
  async function resetLearned() {
    const lastRun = runs.at(-1)
    if (!lastRun) return
    await platform.storage.saveLearnedReset(quizId, lastRun.id)
    setResetAfter(lastRun.id)
  }

  function startExam(settings: ExamSettings) {
    setPickedSettings(settings)
    // Remembered for next time; if saving fails, this exam still uses them.
    platform.storage.saveExamSettings(quizId, settings).catch(() => {})
    onChooseMode('exam')
  }

  /** Stores a finished run; it then counts for the retry pool and the next "Last time". */
  async function saveRun(run: Omit<QuizRun, 'id'>) {
    const id = await platform.storage.addRun(run)
    setRuns((r) => [...r, { ...run, id }])
  }

  const restart = () => setAttempt((a) => a + 1)
  const runProps = {
    quiz,
    // The run keeps the value it mounted with, so it stays "the run before this one".
    previous: mode && historySummary(runs, questionIds, mode).last,
    saveRun,
    missedCount: missed.length,
    // A retry's summary starts the next retry on the questions still missed.
    onRetryMissed: mode === 'retry' ? restart : () => onSwitchMode('retry'),
    onQuit: onBack,
    onBackToList,
    onRestart: restart,
    onLeaveGuardChange,
  }
  // The mode is in the key so a Study run's summary → Retry mounts a fresh StudyRun.
  const key = `${mode}-${attempt}`
  if (mode === 'study' || mode === 'retry') {
    return (
      <StudyRun
        key={key}
        mode={mode}
        questions={mode === 'retry' ? missed : toStudy}
        learnedCounts={counts}
        {...runProps}
        // No Start again into a Study run with every question learned.
        onRestart={mode === 'study' && toStudy.length === 0 ? undefined : restart}
      />
    )
  }
  if (mode === 'exam') return (
      <ExamRun key={key} settings={examSettings} onBackOverrideChange={onBackOverrideChange} {...runProps} />
    )
  return (
    <ModeChoice
      quiz={quiz}
      examSettings={examSettings}
      missedCount={missed.length}
      studyCount={toStudy.length}
      learnedCount={learned.size}
      onResetLearned={resetLearned}
      onStudy={() => onChooseMode('study')}
      onExam={startExam}
      onRetry={() => onChooseMode('retry')}
      onBack={onBack}
    />
  )
}
