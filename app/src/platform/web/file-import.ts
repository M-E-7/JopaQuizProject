// FileImport with the browser's file picker (a detached <input type="file">).
import type { FileImport, PickedFile } from '../types.ts'

export function createWebFileImport(): FileImport {
  return {
    pickQuizFile() {
      return new Promise<PickedFile | null>((resolve, reject) => {
        const input = document.createElement('input')
        input.type = 'file'
        // Android's picker can grey out .json files that the app they came from
        // (mail, Drive, a messenger) didn't label as JSON, so allow every file
        // there; the validator rejects anything that isn't a quiz.
        if (!/Android/i.test(navigator.userAgent)) input.accept = '.json,application/json'
        input.addEventListener('change', () => {
          const file = input.files?.[0]
          if (!file) return resolve(null)
          file.text().then((text) => resolve({ name: file.name, text }), reject)
        })
        input.addEventListener('cancel', () => resolve(null))
        input.click()
      })
    },
  }
}
