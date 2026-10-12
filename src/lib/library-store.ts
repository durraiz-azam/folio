import { loadLibrary, saveLibrary } from "@/lib/storage"
import type { Library } from "@/lib/types"

type SaveState = "saved" | "saving" | "error"

let library: Library | null = null
let saveState: SaveState = "saved"
let saveTimer: ReturnType<typeof setTimeout> | null = null
let saveError: string | null = null

const libraryListeners = new Set<() => void>()
const saveListeners = new Set<() => void>()

function emitLibrary() {
  libraryListeners.forEach((listener) => listener())
}

function emitSave() {
  saveListeners.forEach((listener) => listener())
}

function remember(next: Library) {
  library = next
  saveState = "saving"
  saveError = null
  emitSave()
  emitLibrary()
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      saveLibrary(next)
      saveState = "saved"
      saveError = null
    } catch (error) {
      saveState = "error"
      saveError = error instanceof Error ? error.message : "Could not save"
    }
    emitSave()
  }, 400)
}

export function readLibrary(): Library {
  if (!library) library = typeof window === "undefined" ? { activeId: "", documents: [] } : loadLibrary()
  return library
}

export function readServerLibrary(): Library | null {
  return null
}

export function writeLibrary(update: (current: Library) => Library) {
  remember(update(readLibrary()))
}

export function subscribeLibrary(listener: () => void) {
  libraryListeners.add(listener)
  return () => {
    libraryListeners.delete(listener)
  }
}

export function readSaveState() {
  return saveState
}

export function readSaveError() {
  return saveError
}

export function subscribeSave(listener: () => void) {
  saveListeners.add(listener)
  return () => {
    saveListeners.delete(listener)
  }
}

export function flushLibrary() {
  if (!library) return
  if (saveTimer) clearTimeout(saveTimer)
  try {
    saveLibrary(library)
    saveState = "saved"
    saveError = null
  } catch (error) {
    saveState = "error"
    saveError = error instanceof Error ? error.message : "Could not save"
    throw error
  } finally {
    emitSave()
  }
}
