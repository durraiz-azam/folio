import type { JSONContent } from "@tiptap/core"

export type PageSize = "letter" | "a4"
export type MarginPreset = "narrow" | "normal" | "wide"
export type FontKey = "serif" | "sans" | "mono"
export type Align = "left" | "center" | "right" | "justify"

export type FolioDocument = {
  id: string
  title: string
  content: JSONContent
  pageSize: PageSize
  margin: MarginPreset
  lineSpacing: number
  header: string
  footer: string
  pageNumbers: boolean
  createdAt: number
  updatedAt: number
}

export type Library = {
  activeId: string
  documents: FolioDocument[]
}
