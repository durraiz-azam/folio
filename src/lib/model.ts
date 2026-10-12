import type { JSONContent } from "@tiptap/core"
import { fontKeyFromFamily, parseFontSize } from "@/lib/constants"
import type { Align, FontKey } from "@/lib/types"

export type TextStyle = {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  super: boolean
  sub: boolean
  color: string | null
  highlight: string | null
  font: FontKey
  size: number
  sizeSet: boolean
  href: string | null
}

export type Inline = { type: "text"; text: string; style: TextStyle } | { type: "break" }

export type ParagraphBlock = {
  type: "paragraph"
  variant: "body" | "h1" | "h2" | "h3"
  align: Align
  indent: number
  inlines: Inline[]
}

export type Block =
  | ParagraphBlock
  | { type: "quote"; blocks: Block[] }
  | { type: "list"; ordered: boolean; task: boolean; items: { checked: boolean; blocks: Block[] }[] }
  | { type: "rule" }
  | { type: "pageBreak" }
  | { type: "image"; src: string; alt: string; width: number | null; height: number | null }
  | { type: "table"; rows: { header: boolean; cells: Block[][] }[] }
  | { type: "code"; text: string }

const BASE_STYLE: TextStyle = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  super: false,
  sub: false,
  color: null,
  highlight: null,
  font: "serif",
  size: 12,
  sizeSet: false,
  href: null,
}

function alignOf(attrs: JSONContent["attrs"]): Align {
  const value = attrs?.textAlign
  if (value === "center" || value === "right" || value === "justify") return value
  return "left"
}

function styleFromMarks(marks: JSONContent["marks"]): TextStyle {
  const style: TextStyle = { ...BASE_STYLE }
  for (const mark of marks || []) {
    if (mark.type === "bold") style.bold = true
    if (mark.type === "italic") style.italic = true
    if (mark.type === "underline") style.underline = true
    if (mark.type === "strike") style.strike = true
    if (mark.type === "superscript") style.super = true
    if (mark.type === "subscript") style.sub = true
    if (mark.type === "link" && mark.attrs?.href) style.href = String(mark.attrs.href)
    if (mark.type === "highlight" && mark.attrs?.color) style.highlight = String(mark.attrs.color)
    if (mark.type === "textStyle") {
      if (mark.attrs?.color) style.color = String(mark.attrs.color)
      if (mark.attrs?.fontFamily) style.font = fontKeyFromFamily(String(mark.attrs.fontFamily))
      if (mark.attrs?.fontSize) {
        style.size = parseFontSize(String(mark.attrs.fontSize))
        style.sizeSet = true
      }
    }
  }
  return style
}

function inlinesOf(nodes: JSONContent[] | undefined): Inline[] {
  const inlines: Inline[] = []
  for (const node of nodes || []) {
    if (node.type === "hardBreak") {
      inlines.push({ type: "break" })
      continue
    }
    if (node.type === "text" && node.text) {
      inlines.push({ type: "text", text: node.text, style: styleFromMarks(node.marks) })
      continue
    }
    if (node.content) inlines.push(...inlinesOf(node.content))
  }
  return inlines
}

function paragraph(node: JSONContent, variant: ParagraphBlock["variant"]): ParagraphBlock {
  return {
    type: "paragraph",
    variant,
    align: alignOf(node.attrs),
    indent: Math.max(0, Math.min(8, Number(node.attrs?.indent) || 0)),
    inlines: inlinesOf(node.content),
  }
}

function childrenOf(node: JSONContent): Block[] {
  return (node.content || []).map(convertNode).filter((block): block is Block => Boolean(block))
}

function textOf(node: JSONContent): string {
  if (node.text) return node.text
  return (node.content || []).map(textOf).join(node.type === "hardBreak" ? "\n" : "")
}

function convertNode(node: JSONContent): Block | null {
  switch (node.type) {
    case "paragraph":
      return paragraph(node, "body")
    case "heading": {
      const level = Number(node.attrs?.level)
      return paragraph(node, level === 1 ? "h1" : level === 2 ? "h2" : "h3")
    }
    case "blockquote":
      return { type: "quote", blocks: childrenOf(node) }
    case "bulletList":
      return listBlock(node, false, false)
    case "orderedList":
      return listBlock(node, true, false)
    case "taskList":
      return listBlock(node, false, true)
    case "horizontalRule":
      return { type: "rule" }
    case "pageBreak":
      return { type: "pageBreak" }
    case "image":
      return {
        type: "image",
        src: String(node.attrs?.src || ""),
        alt: String(node.attrs?.alt || ""),
        width: numberOrNull(node.attrs?.width),
        height: numberOrNull(node.attrs?.height),
      }
    case "codeBlock":
      return { type: "code", text: textOf(node) }
    case "table":
      return {
        type: "table",
        rows: (node.content || []).map((row) => ({
          header: (row.content || []).some((cell) => cell.type === "tableHeader"),
          cells: (row.content || []).map((cell) => childrenOf(cell)),
        })),
      }
    default:
      if (node.content) {
        const blocks = childrenOf(node)
        return blocks.length === 1 ? blocks[0] : null
      }
      return null
  }
}

function listBlock(node: JSONContent, ordered: boolean, task: boolean): Block {
  return {
    type: "list",
    ordered,
    task,
    items: (node.content || []).map((item) => ({
      checked: item.attrs?.checked === true,
      blocks: childrenOf(item),
    })),
  }
}

function numberOrNull(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function toBlocks(doc: JSONContent | null | undefined): Block[] {
  if (!doc) return []
  if (doc.type === "doc") return childrenOf(doc)
  return childrenOf({ type: "doc", content: [doc] })
}

export function headingSize(variant: ParagraphBlock["variant"]) {
  if (variant === "h1") return 22
  if (variant === "h2") return 16
  if (variant === "h3") return 13
  return 12
}
