import type { JSONContent } from "@tiptap/core"

export function plainText(node: JSONContent | null | undefined): string {
  if (!node) return ""
  const parts: string[] = []
  const walk = (current: JSONContent) => {
    if (current.text) parts.push(current.text)
    if (current.type === "hardBreak") parts.push("\n")
    for (const child of current.content || []) walk(child)
    if (
      current.type === "paragraph" ||
      current.type === "heading" ||
      current.type === "blockquote" ||
      current.type === "listItem" ||
      current.type === "taskItem" ||
      current.type === "codeBlock"
    ) {
      parts.push("\n")
    }
  }
  walk(node)
  return parts.join("")
}

export function countWords(text: string) {
  const trimmed = text.replace(/\u00a0/g, " ").trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function countCharacters(text: string) {
  return text.replace(/\n/g, "").length
}

export function readingLabel(words: number) {
  if (words === 0) return "No words yet"
  const minutes = Math.max(1, Math.round(words / 220))
  return minutes === 1 ? "1 min read" : `${minutes} min read`
}
