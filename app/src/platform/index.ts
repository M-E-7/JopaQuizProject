// The platform the app runs on. UI code imports `platform` from here; a native
// wrapper (Tauri / Capacitor) would only change this file.
import type { Platform } from './types.ts'
import { createWebFileImport } from './web/file-import.ts'
import { createIdbStorage } from './web/idb-storage.ts'

export type * from './types.ts'

export const platform: Platform = {
  storage: createIdbStorage(),
  files: createWebFileImport(),
}
