// Small text helpers for the UI.

/** Labels of the four options as shown (the order is the run's shuffled one). */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D']

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Seconds as a clock duration: "4:05", "12:34", "1:02:03". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = String(s % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

/** Date in the device's language, e.g. "18 Oct 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
