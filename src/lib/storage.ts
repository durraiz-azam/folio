import type { JSONContent } from "@tiptap/core"
import { nearestLineSpacing } from "@/lib/constants"
import type { FolioDocument, Library, MarginPreset, PageSize } from "@/lib/types"
import { welcomeContent } from "@/lib/welcome"

const STORAGE_KEY = "folio.library.v1"

export function emptyContent(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] }
}

export function createDocument(partial: Partial<FolioDocument> = {}): FolioDocument {
  const now = Date.now()
  return normalizeDocument({
    id: crypto.randomUUID(),
    title: "Untitled document",
    content: emptyContent(),
    pageSize: "letter",
    margin: "normal",
    lineSpacing: 1.15,
    header: "",
    footer: "",
    pageNumbers: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  })
}

export function normalizeDocument(raw: Partial<FolioDocument>): FolioDocument {
  const pageSize: PageSize = raw.pageSize === "a4" ? "a4" : "letter"
  const margin: MarginPreset = raw.margin === "narrow" || raw.margin === "wide" ? raw.margin : "normal"
  const now = Date.now()
  return {
    id: raw.id || crypto.randomUUID(),
    title: (raw.title || "Untitled document").slice(0, 120),
    content: raw.content?.type ? raw.content : emptyContent(),
    pageSize,
    margin,
    lineSpacing: nearestLineSpacing(Number(raw.lineSpacing) || 1.15),
    header: raw.header || "",
    footer: raw.footer || "",
    pageNumbers: Boolean(raw.pageNumbers),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  }
}

export function seedLibrary(): Library {
  const welcome = createDocument({
    title: "Welcome to Folio",
    content: welcomeContent(),
  })
  return { activeId: welcome.id, documents: [welcome] }
}

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedLibrary()
    const parsed = JSON.parse(raw) as Partial<Library>
    const documents = (parsed.documents || []).map((document) => normalizeDocument(document))
    if (!documents.length) return seedLibrary()
    const activeId = documents.some((document) => document.id === parsed.activeId)
      ? String(parsed.activeId)
      : documents[0].id
    return { activeId, documents }
  } catch {
    return seedLibrary()
  }
}

export function saveLibrary(library: Library) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
}

export function uniqueTitle(title: string, documents: FolioDocument[]) {
  const names = new Set(documents.map((document) => document.title))
  if (!names.has(title)) return title
  let index = 2
  while (names.has(`${title} ${index}`)) index += 1
  return `${title} ${index}`
}
