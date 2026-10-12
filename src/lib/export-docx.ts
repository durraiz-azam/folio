import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from "docx"

type NumberingConfig = {
  reference: string
  levels: {
    level: number
    format: (typeof LevelFormat)[keyof typeof LevelFormat]
    text: string
    alignment: (typeof AlignmentType)[keyof typeof AlignmentType]
    style?: { paragraph?: { indent?: { left?: number; hanging?: number } } }
  }[]
}
import { DOCX_FONTS, MARGIN_POINTS } from "@/lib/constants"
import { fitPixels, imageKind, imagePixelSize, loadImageBytes } from "@/lib/images"
import { headingSize, toBlocks, type Block, type Inline, type ParagraphBlock, type TextStyle } from "@/lib/model"
import type { FolioDocument } from "@/lib/types"

const PAGE_TWIP = {
  letter: { width: 12240, height: 15840 },
  a4: { width: 11906, height: 16838 },
} as const

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "C8BFB2" }
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }

function hex(color: string | null) {
  if (!color) return undefined
  const value = color.replace("#", "")
  const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value
  return /^[0-9a-fA-F]{6}/.test(full) ? full.slice(0, 6).toUpperCase() : undefined
}

function alignment(value: ParagraphBlock["align"]) {
  if (value === "center") return AlignmentType.CENTER
  if (value === "right") return AlignmentType.RIGHT
  if (value === "justify") return AlignmentType.BOTH
  return AlignmentType.LEFT
}

function runOptions(style: TextStyle, fallbackSize: number, forceBold: boolean) {
  const size = style.sizeSet ? style.size : fallbackSize
  const color = hex(style.href ? style.color || "#1849A9" : style.color)
  return {
    bold: style.bold || forceBold,
    italics: style.italic,
    underline: style.underline || style.href ? { type: UnderlineType.SINGLE, color } : undefined,
    strike: style.strike,
    superScript: style.super || undefined,
    subScript: style.sub && !style.super ? true : undefined,
    color,
    font: DOCX_FONTS[style.font],
    size: Math.round(size * 2),
    shading: style.highlight
      ? { type: ShadingType.CLEAR, fill: hex(style.highlight) || "FDE68A" }
      : undefined,
  }
}

function runsFrom(inlines: Inline[], fallbackSize: number, forceBold: boolean) {
  const children: (TextRun | ExternalHyperlink)[] = []
  for (const inline of inlines) {
    if (inline.type === "break") {
      children.push(new TextRun({ break: 1 }))
      continue
    }
    if (!inline.text) continue
    const options = { ...runOptions(inline.style, fallbackSize, forceBold), text: inline.text }
    const run = new TextRun(options)
    if (inline.style.href) {
      children.push(new ExternalHyperlink({ link: inline.style.href, children: [run] }))
    } else {
      children.push(run)
    }
  }
  return children
}

function spacing(variant: ParagraphBlock["variant"], lineSpacing: number, compact: boolean) {
  return {
    before: compact ? 0 : variant === "body" ? 0 : variant === "h1" ? 240 : 160,
    after: compact ? 40 : variant === "body" ? 160 : 80,
    line: Math.round(lineSpacing * 240),
    lineRule: LineRuleType.AUTO,
  }
}

function paragraphFrom(
  block: ParagraphBlock,
  doc: FolioDocument,
  options: {
    numbering?: { reference: string; level: number }
    extraIndent?: number
    forceBold?: boolean
    compact?: boolean
    quote?: boolean
  } = {},
) {
  const size = headingSize(block.variant)
  const left = (block.indent * 360) + (options.extraIndent || 0) + (options.quote ? 360 : 0)
  return new Paragraph({
    heading:
      block.variant === "h1"
        ? HeadingLevel.HEADING_1
        : block.variant === "h2"
          ? HeadingLevel.HEADING_2
          : block.variant === "h3"
            ? HeadingLevel.HEADING_3
            : undefined,
    alignment: alignment(block.align),
    spacing: spacing(block.variant, doc.lineSpacing, Boolean(options.compact)),
    numbering: options.numbering,
    indent: left ? { left } : undefined,
    border: options.quote
      ? { left: { style: BorderStyle.SINGLE, size: 12, color: "8A5A32", space: 8 } }
      : undefined,
    children: runsFrom(block.inlines, size, Boolean(options.forceBold) || block.variant !== "body"),
  })
}

function blocksToChildren(
  blocks: Block[],
  doc: FolioDocument,
  numbering: NumberingConfig[],
  state: { next: number },
  options: { compact?: boolean; quote?: boolean; forceBold?: boolean } = {},
): (Paragraph | Table)[] {
  const output: (Paragraph | Table)[] = []
  for (const block of blocks) output.push(...renderBlock(block, doc, numbering, state, options))
  return output
}

async function renderList(
  block: Extract<Block, { type: "list" }>,
  doc: FolioDocument,
  numbering: NumberingConfig[],
  state: { next: number },
  level: number,
  reference: string | null,
) {
  const ref = reference ?? `list-${state.next++}`
  if (!reference && !block.task) {
    numbering.push({
      reference: ref,
      levels: [0, 1, 2, 3, 4].map((entry) => ({
        level: entry,
        format: block.ordered
          ? entry % 3 === 1
            ? LevelFormat.LOWER_LETTER
            : entry % 3 === 2
              ? LevelFormat.LOWER_ROMAN
              : LevelFormat.DECIMAL
          : LevelFormat.BULLET,
        text: block.ordered ? `%${entry + 1}.` : ["•", "◦", "▪"][entry % 3],
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: {
            indent: { left: 720 * (entry + 1), hanging: 360 },
          },
        },
      })),
    })
  }
  const output: (Paragraph | Table)[] = []
  for (const item of block.items) {
    let markerUsed = false
    const itemBlocks = item.blocks.length
      ? item.blocks
      : [{ type: "paragraph", variant: "body", align: "left", indent: 0, inlines: [] } as ParagraphBlock]
    for (const child of itemBlocks) {
      if (child.type === "list") {
        output.push(...(await renderList(child, doc, numbering, state, level + 1, block.task ? null : ref)))
        continue
      }
      if (child.type === "paragraph" && !markerUsed) {
        const prefix = block.task ? (item.checked ? "[x] " : "[ ] ") : ""
        const inlines: Inline[] = prefix
          ? [{ type: "text", text: prefix, style: child.inlines[0]?.type === "text" ? child.inlines[0].style : {
              bold: false, italic: false, underline: false, strike: false, super: false, sub: false,
              color: null, highlight: null, font: "serif", size: 12, sizeSet: false, href: null,
            } }, ...child.inlines]
          : child.inlines
        output.push(
          paragraphFrom(
            { ...child, inlines },
            doc,
            {
              numbering: block.task ? undefined : { reference: ref, level },
              compact: true,
            },
          ),
        )
        markerUsed = true
        continue
      }
      output.push(...(await renderWithImages([child], doc, numbering, state, { compact: true })))
      markerUsed = true
    }
  }
  return output
}

function renderBlock(
  block: Block,
  doc: FolioDocument,
  numbering: NumberingConfig[],
  state: { next: number },
  options: { compact?: boolean; quote?: boolean; forceBold?: boolean } = {},
): (Paragraph | Table)[] {
  switch (block.type) {
    case "paragraph":
      return [paragraphFrom(block, doc, options)]
    case "quote":
      return blocksToChildren(block.blocks, doc, numbering, state, { ...options, quote: true })
    case "list":
      return []
    case "rule":
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "C8BFB2", space: 1 } },
          spacing: { before: 120, after: 120 },
        }),
      ]
    case "pageBreak":
      return [new Paragraph({ children: [new PageBreak()] })]
    case "code":
      return [
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: "F6F1E8" },
          spacing: spacing("body", doc.lineSpacing, true),
          children: block.text.split("\n").flatMap((line, index, lines) => {
            const run = new TextRun({ text: line || " ", font: "Courier New", size: 20 })
            return index < lines.length - 1 ? [run, new TextRun({ break: 1 })] : [run]
          }),
        }),
      ]
    case "image":
      return [new Paragraph({ children: [new TextRun(block.alt || "Picture")] })]
    case "table":
      return [renderTable(block, doc, numbering, state)]
    default:
      return []
  }
}

function renderTable(
  block: Extract<Block, { type: "table" }>,
  doc: FolioDocument,
  numbering: NumberingConfig[],
  state: { next: number },
) {
  const columns = Math.max(1, ...block.rows.map((row) => row.cells.length))
  const margin = MARGIN_POINTS[doc.margin] * 20
  const content = PAGE_TWIP[doc.pageSize].width - margin * 2
  const columnWidth = Math.floor(content / columns)
  return new Table({
    width: { size: content, type: WidthType.DXA },
    rows: block.rows.map(
      (row) =>
        new TableRow({
          tableHeader: row.header,
          children: Array.from({ length: columns }, (_, index) => {
            const cell = row.cells[index] || []
            const children = blocksToChildren(cell, doc, numbering, state, { compact: true, forceBold: row.header })
            return new TableCell({
              width: { size: columnWidth, type: WidthType.DXA },
              borders: cellBorders,
              shading: row.header ? { type: ShadingType.CLEAR, fill: "F6F1E8" } : undefined,
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: children.length ? children : [new Paragraph("")],
            })
          }),
        }),
    ),
  })
}

async function imageParagraph(block: Extract<Block, { type: "image" }>): Promise<Block> {
  const loaded = await loadImageBytes(block.src)
  if (!loaded) return block
  const kind = imageKind(loaded.mime, loaded.bytes)
  if (kind !== "png" && kind !== "jpg" && kind !== "gif" && kind !== "bmp") return block
  const natural = imagePixelSize(kind, loaded.bytes) || { width: block.width || 480, height: block.height || 320 }
  const fitted = fitPixels(block.width || natural.width, block.height || natural.height, 624)
  const height = block.width && !block.height ? Math.round(fitted.width * (natural.height / natural.width)) : fitted.height
  return {
    ...block,
    width: fitted.width,
    height: Math.max(1, height),
    alt: block.alt,
    src: block.src,
  }
}

function renderImageRuns(block: Extract<Block, { type: "image" }>, bytes: Uint8Array, kind: "png" | "jpg" | "gif" | "bmp") {
  return new Paragraph({
    children: [
      new ImageRun({
        type: kind,
        data: bytes,
        transformation: {
          width: block.width || 480,
          height: block.height || 320,
        },
        altText: {
          title: block.alt || "Picture",
          description: block.alt || "Picture",
          name: block.alt || "Picture",
        },
      }),
    ],
  })
}

async function renderWithImages(
  blocks: Block[],
  doc: FolioDocument,
  numbering: NumberingConfig[],
  state: { next: number },
  options: { compact?: boolean; quote?: boolean; forceBold?: boolean } = {},
): Promise<(Paragraph | Table)[]> {
  const output: (Paragraph | Table)[] = []
  for (const block of blocks) {
    if (block.type === "image") {
      const loaded = await loadImageBytes(block.src)
      const kind = loaded ? imageKind(loaded.mime, loaded.bytes) : "other"
      if (loaded && (kind === "png" || kind === "jpg" || kind === "gif" || kind === "bmp")) {
        const prepared = await imageParagraph(block)
        if (prepared.type === "image") output.push(renderImageRuns(prepared, loaded.bytes, kind))
        continue
      }
    }
    if (block.type === "quote") {
      output.push(...(await renderWithImages(block.blocks, doc, numbering, state, { ...options, quote: true })))
      continue
    }
    if (block.type === "list") {
      output.push(...(await renderList(block, doc, numbering, state, 0, null)))
      continue
    }
    if (block.type === "table") {
      output.push(await renderTableAsync(block, doc, numbering, state))
      continue
    }
    output.push(...renderBlock(block, doc, numbering, state, options))
  }
  return output
}

async function renderTableAsync(
  block: Extract<Block, { type: "table" }>,
  doc: FolioDocument,
  numbering: NumberingConfig[],
  state: { next: number },
) {
  const columns = Math.max(1, ...block.rows.map((row) => row.cells.length))
  const margin = MARGIN_POINTS[doc.margin] * 20
  const content = PAGE_TWIP[doc.pageSize].width - margin * 2
  const columnWidth = Math.floor(content / columns)
  const rows = []
  for (const row of block.rows) {
    const cells = []
    for (let index = 0; index < columns; index += 1) {
      const children = await renderWithImages(row.cells[index] || [], doc, numbering, state, {
        compact: true,
        forceBold: row.header,
      })
      cells.push(
        new TableCell({
          width: { size: columnWidth, type: WidthType.DXA },
          borders: cellBorders,
          shading: row.header ? { type: ShadingType.CLEAR, fill: "F6F1E8" } : undefined,
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: children.length ? children : [new Paragraph("")],
        }),
      )
    }
    rows.push(new TableRow({ tableHeader: row.header, children: cells }))
  }
  return new Table({ width: { size: content, type: WidthType.DXA }, rows })
}

function chrome(doc: FolioDocument) {
  const header = doc.header.trim()
    ? new Header({
        children: [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E0D5C5", space: 2 } },
            children: [new TextRun({ text: doc.header.trim(), italics: true, font: "Arial", size: 18, color: "6F675D" })],
          }),
        ],
      })
    : undefined
  const footerChildren: Paragraph[] = []
  if (doc.footer.trim()) {
    footerChildren.push(
      new Paragraph({
        children: [new TextRun({ text: doc.footer.trim(), italics: true, font: "Arial", size: 18, color: "6F675D" })],
      }),
    )
  }
  if (doc.pageNumbers) {
    footerChildren.push(
      new Paragraph({
        alignment: doc.footer.trim() ? AlignmentType.RIGHT : AlignmentType.CENTER,
        children: [
          new TextRun({
            font: "Arial",
            size: 18,
            color: "6F675D",
            children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
          }),
        ],
      }),
    )
  }
  return {
    headers: header ? { default: header } : undefined,
    footers: footerChildren.length ? { default: new Footer({ children: footerChildren }) } : undefined,
  }
}

export async function buildDocx(doc: FolioDocument) {
  const numbering: NumberingConfig[] = []
  const state = { next: 1 }
  const blocks = toBlocks(doc.content)
  const children = await renderWithImages(blocks, doc, numbering, state)
  const margin = MARGIN_POINTS[doc.margin] * 20
  const file = new Document({
    title: doc.title || "Untitled document",
    creator: "Folio",
    description: "Written in Folio",
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 },
          paragraph: {
            spacing: { line: Math.round((doc.lineSpacing || 1.15) * 240), lineRule: LineRuleType.AUTO },
          },
        },
      },
    },
    numbering: { config: numbering },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_TWIP[doc.pageSize].width,
              height: PAGE_TWIP[doc.pageSize].height,
            },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
          },
        },
        ...chrome(doc),
        children: children.length ? children : [new Paragraph("")],
      },
    ],
  })
  const buffer = await Packer.toBuffer(file)
  return new Uint8Array(buffer)
}
