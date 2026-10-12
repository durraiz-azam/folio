import type { JSONContent } from "@tiptap/core"
import { normalizeDocument } from "@/lib/storage"
import type { FolioDocument } from "@/lib/types"

export type ImportedFile =
  | { kind: "folio"; document: FolioDocument }
  | { kind: "html"; title: string; html: string }

function titleFrom(file: File) {
  return file.name.replace(/\.[^.]+$/, "") || "Imported document"
}

export async function readImportedFile(file: File): Promise<ImportedFile> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("That file is larger than 15 MB.")
  }
  const name = file.name.toLowerCase()
  if (name.endsWith(".json") || file.type === "application/json") {
    const parsed = JSON.parse(await file.text()) as Partial<FolioDocument>
    if (!parsed || typeof parsed !== "object" || !parsed.content || parsed.content.type !== "doc") {
      throw new Error("That JSON file is not a Folio document.")
    }
    return {
      kind: "folio",
      document: normalizeDocument({
        ...parsed,
        id: undefined,
        title: parsed.title || titleFrom(file),
      }),
    }
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth")
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
    return { kind: "html", title: titleFrom(file), html: result.value || "<p></p>" }
  }
  if (name.endsWith(".html") || name.endsWith(".htm") || file.type === "text/html") {
    return { kind: "html", title: titleFrom(file), html: await file.text() }
  }
  throw new Error("Open a .docx, .html, or Folio .json file.")
}

export function htmlDocument(doc: FolioDocument, body: string) {
  const title = escapeHtml(doc.title || "Untitled document")
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { margin: 0; background: #e6dfd2; color: #1c1915; }
    article { box-sizing: border-box; width: ${doc.pageSize === "a4" ? "210mm" : "8.5in"}; min-height: ${doc.pageSize === "a4" ? "297mm" : "11in"}; margin: 24px auto; padding: ${doc.margin === "narrow" ? "0.5in" : doc.margin === "wide" ? "1.25in" : "1in"}; background: #fffefb; font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: ${doc.lineSpacing}; }
    h1 { font-size: 22pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #c8bfb2; padding: 4pt 6pt; vertical-align: top; }
    blockquote { border-left: 2px solid #8a5a32; margin-left: 0; padding-left: 12pt; }
  </style>
</head>
<body>
  <article>${body}</article>
</body>
</html>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
    return map[char] || char
  })
}

export function isDocContent(value: unknown): value is JSONContent {
  return Boolean(value && typeof value === "object" && (value as JSONContent).type === "doc")
}
