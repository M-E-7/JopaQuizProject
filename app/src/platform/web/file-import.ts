// FileImport with the browser's file picker (a detached <input type="file">).
import type { FileImport, PickedFile } from '../types.ts'

export function createWebFileImport(): FileImport {
  return {
    pickQuizFile() {
      return new Promise<PickedFile | null>((resolve, reject) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json,application/json'
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
