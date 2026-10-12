import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib"
import { MARGIN_POINTS, PAGE_POINTS } from "@/lib/constants"
import type { FontFiles } from "@/lib/fonts"
import { imageKind, loadImageBytes, rasterizeToPng } from "@/lib/images"
import { headingSize, toBlocks, type Block, type Inline, type ParagraphBlock, type TextStyle } from "@/lib/model"
import type { FolioDocument } from "@/lib/types"

const INK = rgb(28 / 255, 25 / 255, 21 / 255)
const MUTED = rgb(111 / 255, 103 / 255, 93 / 255)
const RULE = rgb(200 / 255, 191 / 255, 178 / 255)
const PAPER = rgb(1, 254 / 255, 251 / 255)
const HEADER_FILL = rgb(246 / 255, 241 / 255, 232 / 255)
const CODE_FILL = rgb(246 / 255, 241 / 255, 232 / 255)
const COPPER = rgb(138 / 255, 90 / 255, 50 / 255)
const LINK = rgb(24 / 255, 73 / 255, 169 / 255)

type Face = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont }
type Faces = { serif: Face; sans: Face; mono: Face }
type EmbeddedImage = { image: PDFImage; width: number; height: number }

type Ctx = {
  pdf: PDFDocument
  page: PDFPage
  pages: PDFPage[]
  y: number
  pageWidth: number
  pageHeight: number
  margin: number
  contentWidth: number
  top: number
  bottom: number
  lineSpacing: number
  faces: Faces
  images: Map<string, EmbeddedImage>
  draw: boolean
  forceBold: boolean
  compact: boolean
  quoted: boolean
  contained: boolean
}

type Snapshot = Pick<
  Ctx,
  | "page"
  | "y"
  | "margin"
  | "contentWidth"
  | "top"
  | "bottom"
  | "draw"
  | "forceBold"
  | "compact"
  | "quoted"
  | "contained"
>

const glyphOk = new Map<string, boolean>()

function supports(font: PDFFont, id: string, char: string) {
  const key = `${id}:${char}`
  const known = glyphOk.get(key)
  if (known !== undefined) return known
  let ok = true
  try {
    font.widthOfTextAtSize(char, 12)
  } catch {
    ok = false
  }
  glyphOk.set(key, ok)
  return ok
}

function cleanText(font: PDFFont, id: string, text: string) {
  let output = ""
  for (const char of text) output += supports(font, id, char) ? char : ""
  return output
}

function faceFor(style: TextStyle, faces: Faces) {
  const family = faces[style.font]
  if (style.bold && style.italic) return { font: family.boldItalic, id: `${style.font}-boldItalic` }
  if (style.bold) return { font: family.bold, id: `${style.font}-bold` }
  if (style.italic) return { font: family.italic, id: `${style.font}-italic` }
  return { font: family.regular, id: `${style.font}-regular` }
}

function paintSize(style: TextStyle) {
  return style.super || style.sub ? style.size * 0.7 : style.size
}

function resolveStyle(style: TextStyle, baseSize: number, forceBold: boolean): TextStyle {
  return {
    ...style,
    bold: style.bold || forceBold,
    size: style.sizeSet ? style.size : baseSize,
  }
}

function parseColor(value: string | null, fallback = INK) {
  if (!value) return fallback
  const hex = value.trim().replace("#", "")
  const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex
  if (!/^[0-9a-fA-F]{6}/.test(full)) return fallback
  const num = Number.parseInt(full.slice(0, 6), 16)
  return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255)
}

function save(ctx: Ctx): Snapshot {
  return {
    page: ctx.page,
    y: ctx.y,
    margin: ctx.margin,
    contentWidth: ctx.contentWidth,
    top: ctx.top,
    bottom: ctx.bottom,
    draw: ctx.draw,
    forceBold: ctx.forceBold,
    compact: ctx.compact,
    quoted: ctx.quoted,
    contained: ctx.contained,
  }
}

function restore(ctx: Ctx, snapshot: Snapshot) {
  ctx.page = snapshot.page
  ctx.y = snapshot.y
  ctx.margin = snapshot.margin
  ctx.contentWidth = snapshot.contentWidth
  ctx.top = snapshot.top
  ctx.bottom = snapshot.bottom
  ctx.draw = snapshot.draw
  ctx.forceBold = snapshot.forceBold
  ctx.compact = snapshot.compact
  ctx.quoted = snapshot.quoted
  ctx.contained = snapshot.contained
}

function addPage(ctx: Ctx) {
  if (!ctx.draw) {
    ctx.y = ctx.top
    return
  }
  const page = ctx.pdf.addPage([ctx.pageWidth, ctx.pageHeight])
  page.drawRectangle({ x: 0, y: 0, width: ctx.pageWidth, height: ctx.pageHeight, color: PAPER })
  ctx.page = page
  ctx.pages.push(page)
  ctx.y = ctx.top
}

function ensure(ctx: Ctx, height: number) {
  if (ctx.contained) return
  if (ctx.y > ctx.top + 0.5 && ctx.y + height > ctx.bottom + 0.1) addPage(ctx)
}

type Token = { text: string; style: TextStyle; width: number; font: PDFFont }

function measureToken(style: TextStyle, text: string, faces: Faces) {
  const { font, id } = faceFor(style, faces)
  const safe = cleanText(font, id, text)
  const size = paintSize(style)
  const width = safe ? font.widthOfTextAtSize(safe, size) : 0
  return { text: safe, style, width, font }
}

function tokensFor(inlines: Inline[], baseSize: number, forceBold: boolean, faces: Faces) {
  const tokens: Token[] = []
  const pushText = (text: string, style: TextStyle) => {
    const parts = text.split(/(\s+)/).filter(Boolean)
    for (const part of parts) {
      const token = measureToken(style, part, faces)
      if (!token.text) continue
      tokens.push(token)
    }
  }
  for (const inline of inlines) {
    if (inline.type === "break") {
      tokens.push({ text: "\n", style: resolveStyle(inlineStyleFallback(baseSize), baseSize, forceBold), width: 0, font: faces.serif.regular })
      continue
    }
    pushText(inline.text, resolveStyle(inline.style, baseSize, forceBold))
  }
  return tokens
}

function inlineStyleFallback(size: number): TextStyle {
  return {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    super: false,
    sub: false,
    color: null,
    highlight: null,
    font: "serif",
    size,
    sizeSet: true,
    href: null,
  }
}

function wrapTokens(tokens: Token[], maxWidth: number, faces: Faces): Token[][] {
  const lines: Token[][] = []
  let line: Token[] = []
  let width = 0
  const commit = () => {
    while (line.length && /^\s+$/.test(line[line.length - 1].text)) line.pop()
    lines.push(line)
    line = []
    width = 0
  }
  const explode = (token: Token) => {
    let buffer = ""
    let bufferWidth = 0
    for (const char of token.text) {
      const piece = measureToken(token.style, buffer + char, faces)
      if (buffer && piece.width > maxWidth) {
        if (line.length) commit()
        line.push(measureToken(token.style, buffer, faces))
        commit()
        buffer = char
        bufferWidth = measureToken(token.style, char, faces).width
      } else {
        buffer += char
        bufferWidth = piece.width
      }
    }
    if (buffer) {
      const tokenWidth = bufferWidth
      if (line.length && width + tokenWidth > maxWidth) commit()
      const next = measureToken(token.style, buffer, faces)
      line.push(next)
      width += next.width
    }
  }
  for (const token of tokens) {
    if (token.text === "\n") {
      commit()
      continue
    }
    if (token.width > maxWidth && token.text.trim()) {
      explode(token)
      continue
    }
    if (line.length && width + token.width > maxWidth) {
      if (/^\s+$/.test(token.text)) continue
      commit()
    }
    line.push(token)
    width += token.width
  }
  commit()
  return lines.filter((entry, index, all) => entry.length > 0 || index < all.length - 1 || all.length === 1)
}

function lineWidth(line: Token[]) {
  return line.reduce((sum, token) => sum + token.width, 0)
}

function addLink(pdf: PDFDocument, page: PDFPage, x: number, y: number, width: number, height: number, url: string) {
  if (!url || width <= 0 || height <= 0) return
  let href = url
  if (!/^(https?:|mailto:|tel:)/i.test(href)) href = `https://${href}`
  const annotation = pdf.context.register(
    pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(href) },
    }),
  )
  const existing = page.node.Annots()
  if (existing) existing.push(annotation)
  else page.node.set(PDFName.of("Annots"), pdf.context.obj([annotation]))
}

function drawLine(ctx: Ctx, line: Token[], align: ParagraphBlock["align"], isLast: boolean, lineHeight: number) {
  const natural = lineWidth(line)
  const gaps = line.filter((token) => /^\s+$/.test(token.text)).length
  const justify = align === "justify" && !isLast && gaps > 0 && natural < ctx.contentWidth
  const extra = justify ? (ctx.contentWidth - natural) / gaps : 0
  let x = ctx.margin
  if (!justify && align === "center") x += (ctx.contentWidth - natural) / 2
  if (!justify && align === "right") x += ctx.contentWidth - natural
  const maxSize = Math.max(12, ...line.map((token) => token.style.size))
  const baseline = ctx.pageHeight - (ctx.y + maxSize * 0.8)
  for (const token of line) {
    const gap = /^\s+$/.test(token.text) ? extra : 0
    const width = token.width + gap
    const size = paintSize(token.style)
    const shift = token.style.super ? size * 0.45 : token.style.sub ? -size * 0.2 : 0
    const color = parseColor(token.style.color, token.style.href ? LINK : INK)
    if (ctx.draw && token.style.highlight && token.text.trim()) {
      ctx.page.drawRectangle({
        x,
        y: baseline + shift - size * 0.22,
        width,
        height: size * 1.12,
        color: parseColor(token.style.highlight, rgb(1, 0.93, 0.7)),
      })
    }
    if (ctx.draw && token.text) {
      try {
        ctx.page.drawText(token.text, { x, y: baseline + shift, size, font: token.font, color })
      } catch {
        // A missing glyph should already have been removed. Skip the run if the font still refuses it.
      }
    }
    if (ctx.draw && (token.style.underline || token.style.href) && token.text.trim()) {
      const underlineY = baseline + shift - 1.4
      ctx.page.drawLine({
        start: { x, y: underlineY },
        end: { x: x + width, y: underlineY },
        thickness: 0.6,
        color,
      })
    }
    if (ctx.draw && token.style.strike && token.text.trim()) {
      const strikeY = baseline + shift + size * 0.28
      ctx.page.drawLine({
        start: { x, y: strikeY },
        end: { x: x + width, y: strikeY },
        thickness: 0.6,
        color,
      })
    }
    if (ctx.draw && token.style.href) {
      addLink(ctx.pdf, ctx.page, x, baseline + shift - 2, width, size + 3, token.style.href)
    }
    x += width
  }
  return lineHeight
}

function drawParagraph(block: ParagraphBlock, ctx: Ctx) {
  const baseSize = headingSize(block.variant)
  const forceBold = ctx.forceBold || block.variant !== "body"
  const before = ctx.compact ? 0 : block.variant === "body" ? 0 : block.variant === "h1" ? 12 : 8
  const after = ctx.compact ? 2 : block.variant === "body" ? 8 : 4
  const startPage = ctx.page
  const startY = ctx.y
  if (before) {
    ensure(ctx, before + baseSize)
    if (ctx.y > ctx.top + 0.5) ctx.y += before
  }
  const snapshot = save(ctx)
  ctx.margin += block.indent * 18
  ctx.contentWidth -= block.indent * 18
  const lines = wrapTokens(tokensFor(block.inlines, baseSize, forceBold, ctx.faces), Math.max(24, ctx.contentWidth), ctx.faces)
  const usable = lines.length ? lines : [[]]
  for (let index = 0; index < usable.length; index += 1) {
    const line = usable[index]
    const maxSize = Math.max(baseSize, ...line.map((token) => token.style.size))
    const lineHeight = maxSize * ctx.lineSpacing
    ensure(ctx, lineHeight)
    if (line.length) drawLine(ctx, line, block.align, index === usable.length - 1, lineHeight)
    ctx.y += lineHeight
  }
  ctx.y += after
  if (ctx.quoted && ctx.draw && ctx.page === startPage) {
    ctx.page.drawLine({
      start: { x: snapshot.margin - 10, y: ctx.pageHeight - startY },
      end: { x: snapshot.margin - 10, y: ctx.pageHeight - (ctx.y - after) },
      thickness: 2,
      color: COPPER,
    })
  }
  const endY = ctx.y
  const endPage = ctx.page
  restore(ctx, snapshot)
  ctx.y = endY
  ctx.page = endPage
}

function drawMarker(ctx: Ctx, x: number, ordered: boolean, task: boolean, checked: boolean, index: number) {
  const baseline = ctx.pageHeight - (ctx.y + 12 * 0.8)
  if (task) {
    ctx.page.drawRectangle({
      x,
      y: baseline - 1,
      width: 8,
      height: 8,
      borderWidth: 0.8,
      borderColor: INK,
      color: PAPER,
    })
    if (checked) {
      ctx.page.drawLine({ start: { x: x + 1.4, y: baseline + 2.2 }, end: { x: x + 3.2, y: baseline + 0.2 }, thickness: 1, color: INK })
      ctx.page.drawLine({ start: { x: x + 3.1, y: baseline + 0.2 }, end: { x: x + 6.8, y: baseline + 5.4 }, thickness: 1, color: INK })
    }
    return
  }
  if (ordered) {
    const label = `${index + 1}.`
    ctx.page.drawText(label, { x, y: baseline, size: 12, font: ctx.faces.serif.regular, color: INK })
    return
  }
  ctx.page.drawEllipse({ x: x + 3.2, y: baseline + 3, xScale: 1.45, yScale: 1.45, color: INK })
}

function drawList(block: Extract<Block, { type: "list" }>, ctx: Ctx) {
  const snapshot = save(ctx)
  const markerX = ctx.margin
  ctx.margin += 20
  ctx.contentWidth -= 20
  ctx.compact = true
  block.items.forEach((item, index) => {
    ensure(ctx, 14)
    if (ctx.draw) drawMarker(ctx, markerX, block.ordered, block.task, item.checked, index)
    if (!item.blocks.length) {
      ctx.y += 12 * ctx.lineSpacing
      return
    }
    for (const child of item.blocks) {
      if (child.type === "list") drawList(child, ctx)
      else drawBlock(child, ctx)
    }
  })
  const endY = ctx.y
  const endPage = ctx.page
  restore(ctx, snapshot)
  ctx.y = endY + 4
  ctx.page = endPage
}

function drawCode(text: string, ctx: Ctx) {
  const style: TextStyle = {
    ...inlineStyleFallback(10),
    font: "mono",
    size: 10,
  }
  const lines = text.split("\n").flatMap((line) => {
    const parts = line.split(/(\s+)/).filter(Boolean)
    const tokens = parts.map((part) => measureToken(style, part, ctx.faces)).filter((token) => token.text)
    const wrapped = wrapTokens(tokens, Math.max(24, ctx.contentWidth - 12), ctx.faces)
    return wrapped.length ? wrapped : [[]]
  })
  const lineHeight = 10 * 1.35
  const pad = 6
  const height = Math.max(1, lines.length) * lineHeight + pad * 2
  ensure(ctx, height + 6)
  if (ctx.draw) {
    ctx.page.drawRectangle({
      x: ctx.margin,
      y: ctx.pageHeight - ctx.y - height,
      width: ctx.contentWidth,
      height,
      color: CODE_FILL,
    })
  }
  let cursor = ctx.y + pad
  for (const line of lines) {
    if (ctx.draw && line.length) {
      const baseline = ctx.pageHeight - (cursor + 10 * 0.8)
      let x = ctx.margin + pad
      for (const token of line) {
        if (token.text.trim() || token.text) {
          try {
            ctx.page.drawText(token.text, { x, y: baseline, size: 10, font: token.font, color: INK })
          } catch {
            // Ignore a glyph the mono font cannot draw.
          }
        }
        x += token.width
      }
    }
    cursor += lineHeight
  }
  ctx.y += height + 8
}

function drawImage(block: Extract<Block, { type: "image" }>, ctx: Ctx) {
  const embedded = ctx.images.get(block.src)
  if (!embedded) {
    drawParagraph(
      { type: "paragraph", variant: "body", align: "left", indent: 0, inlines: [{ type: "text", text: block.alt || "Picture", style: inlineStyleFallback(12) }] },
      ctx,
    )
    return
  }
  let width = embedded.width * 0.75
  let height = embedded.height * 0.75
  if (block.width) {
    width = block.width * 0.75
    height = block.height ? block.height * 0.75 : width * (embedded.height / embedded.width)
  }
  const maxWidth = Math.max(24, ctx.contentWidth)
  if (width > maxWidth) {
    const scale = maxWidth / width
    width *= scale
    height *= scale
  }
  const available = Math.max(24, ctx.bottom - ctx.top - 8)
  if (height > available) {
    const scale = available / height
    width *= scale
    height *= scale
  }
  ensure(ctx, height + 8)
  if (ctx.draw) {
    ctx.page.drawImage(embedded.image, {
      x: ctx.margin,
      y: ctx.pageHeight - ctx.y - height,
      width,
      height,
    })
  }
  ctx.y += height + 8
}

function measureHeight(blocks: Block[], width: number, ctx: Ctx, header: boolean) {
  const snapshot = save(ctx)
  ctx.draw = false
  ctx.contained = true
  ctx.compact = true
  ctx.quoted = false
  ctx.forceBold = header
  ctx.y = 0
  ctx.top = 0
  ctx.bottom = Number.POSITIVE_INFINITY
  ctx.margin = 0
  ctx.contentWidth = width
  for (const block of blocks) drawBlock(block, ctx)
  const height = ctx.y
  restore(ctx, snapshot)
  return height
}

function drawTable(block: Extract<Block, { type: "table" }>, ctx: Ctx) {
  const columns = Math.max(1, ...block.rows.map((row) => row.cells.length))
  const columnWidth = ctx.contentWidth / columns
  const pad = 4
  for (const row of block.rows) {
    const heights = Array.from({ length: columns }, (_, index) =>
      measureHeight(row.cells[index]?.length ? row.cells[index] : [], columnWidth - pad * 2, ctx, row.header),
    )
    const rowHeight = Math.max(16, ...heights) + pad * 2
    ensure(ctx, rowHeight)
    const top = ctx.y
    for (let index = 0; index < columns; index += 1) {
      const x = ctx.margin + index * columnWidth
      if (ctx.draw) {
        ctx.page.drawRectangle({
          x,
          y: ctx.pageHeight - top - rowHeight,
          width: columnWidth,
          height: rowHeight,
          borderWidth: 0.6,
          borderColor: RULE,
          color: row.header ? HEADER_FILL : PAPER,
        })
      }
      const snapshot = save(ctx)
      ctx.y = top + pad
      ctx.margin = x + pad
      ctx.contentWidth = columnWidth - pad * 2
      ctx.contained = true
      ctx.compact = true
      ctx.forceBold = row.header || ctx.forceBold
      for (const child of row.cells[index] || []) drawBlock(child, ctx)
      restore(ctx, snapshot)
    }
    ctx.y = top + rowHeight
  }
  ctx.y += 8
}

function drawBlock(block: Block, ctx: Ctx) {
  switch (block.type) {
    case "paragraph":
      drawParagraph(block, ctx)
      return
    case "quote": {
      const snapshot = save(ctx)
      ctx.margin += 14
      ctx.contentWidth -= 14
      ctx.quoted = true
      for (const child of block.blocks) drawBlock(child, ctx)
      const endY = ctx.y
      const endPage = ctx.page
      restore(ctx, snapshot)
      ctx.y = endY
      ctx.page = endPage
      return
    }
    case "list":
      drawList(block, ctx)
      return
    case "rule":
      ensure(ctx, 16)
      ctx.y += 6
      if (ctx.draw) {
        const y = ctx.pageHeight - ctx.y
        ctx.page.drawLine({
          start: { x: ctx.margin, y },
          end: { x: ctx.margin + ctx.contentWidth, y },
          thickness: 0.7,
          color: RULE,
        })
      }
      ctx.y += 10
      return
    case "pageBreak":
      if (!ctx.contained && ctx.y > ctx.top + 2) addPage(ctx)
      return
    case "image":
      drawImage(block, ctx)
      return
    case "table":
      drawTable(block, ctx)
      return
    case "code":
      drawCode(block.text, ctx)
      return
    default:
      return
  }
}

async function embedImages(blocks: Block[], pdf: PDFDocument) {
  const images = new Map<string, EmbeddedImage>()
  const sources: string[] = []
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.type === "image" && block.src && !sources.includes(block.src)) sources.push(block.src)
      if (block.type === "quote") walk(block.blocks)
      if (block.type === "list") block.items.forEach((item) => walk(item.blocks))
      if (block.type === "table") block.rows.forEach((row) => row.cells.forEach((cell) => walk(cell)))
    }
  }
  walk(blocks)
  for (const src of sources) {
    const loaded = await loadImageBytes(src)
    if (!loaded) continue
    let bytes = loaded.bytes
    let kind = imageKind(loaded.mime, bytes)
    if (kind !== "png" && kind !== "jpg") {
      const png = await rasterizeToPng(bytes, loaded.mime)
      if (!png) continue
      bytes = png
      kind = "png"
    }
    try {
      const image = kind === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
      images.set(src, { image, width: image.width, height: image.height })
    } catch {
      // Skip pictures the PDF library cannot embed.
    }
  }
  return images
}

function fitLine(font: PDFFont, id: string, text: string, size: number, maxWidth: number) {
  const safe = cleanText(font, id, text)
  if (!safe || font.widthOfTextAtSize(safe, size) <= maxWidth) return safe
  let cut = safe
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > maxWidth) cut = cut.slice(0, -1)
  return `${cut}...`
}

function drawChrome(ctx: Ctx, doc: FolioDocument) {
  const margin = MARGIN_POINTS[doc.margin]
  const total = ctx.pages.length
  ctx.pages.forEach((page, index) => {
    if (doc.header.trim()) {
      const header = fitLine(ctx.faces.sans.italic, "sans-italic", doc.header.trim(), 9, ctx.pageWidth - margin * 2)
      if (header) {
        page.drawText(header, {
          x: margin,
          y: ctx.pageHeight - margin * 0.62,
          size: 9,
          font: ctx.faces.sans.italic,
          color: MUTED,
        })
      }
      page.drawLine({
        start: { x: margin, y: ctx.pageHeight - ctx.top + 8 },
        end: { x: ctx.pageWidth - margin, y: ctx.pageHeight - ctx.top + 8 },
        thickness: 0.4,
        color: RULE,
      })
    }
    if (doc.footer.trim() || doc.pageNumbers) {
      const footer = doc.footer.trim()
        ? fitLine(ctx.faces.sans.italic, "sans-italic", doc.footer.trim(), 9, ctx.pageWidth - margin * 2 - 90)
        : ""
      if (footer) {
        page.drawText(footer, { x: margin, y: margin * 0.48, size: 9, font: ctx.faces.sans.italic, color: MUTED })
      }
      if (doc.pageNumbers) {
        const label = `Page ${index + 1} of ${total}`
        const width = ctx.faces.sans.regular.widthOfTextAtSize(label, 9)
        const x = footer ? ctx.pageWidth - margin - width : (ctx.pageWidth - width) / 2
        page.drawText(label, { x, y: margin * 0.48, size: 9, font: ctx.faces.sans.regular, color: MUTED })
      }
    }
  })
}

async function embedFaces(pdf: PDFDocument, files: FontFiles): Promise<Faces> {
  const embed = async (bytes: Uint8Array) => pdf.embedFont(bytes, { subset: true })
  const family = async (face: FontFiles["serif"]) => ({
    regular: await embed(face.regular),
    bold: await embed(face.bold),
    italic: await embed(face.italic),
    boldItalic: await embed(face.boldItalic),
  })
  return {
    serif: await family(files.serif),
    sans: await family(files.sans),
    mono: await family(files.mono),
  }
}

export async function buildPdf(doc: FolioDocument, files: FontFiles) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(doc.title || "Untitled document")
  pdf.setCreator("Folio")
  pdf.setProducer("Folio")
  const pageSize = PAGE_POINTS[doc.pageSize]
  const margin = MARGIN_POINTS[doc.margin]
  const headerSpace = doc.header.trim() ? 18 : 0
  const footerSpace = doc.footer.trim() || doc.pageNumbers ? 18 : 0
  const blocks = toBlocks(doc.content)
  const faces = await embedFaces(pdf, files)
  const images = await embedImages(blocks, pdf)
  const ctx: Ctx = {
    pdf,
    page: undefined as unknown as PDFPage,
    pages: [],
    y: 0,
    pageWidth: pageSize.width,
    pageHeight: pageSize.height,
    margin,
    contentWidth: pageSize.width - margin * 2,
    top: margin + headerSpace,
    bottom: pageSize.height - margin - footerSpace,
    lineSpacing: doc.lineSpacing || 1.15,
    faces,
    images,
    draw: true,
    forceBold: false,
    compact: false,
    quoted: false,
    contained: false,
  }
  addPage(ctx)
  for (const block of blocks) drawBlock(block, ctx)
  if (!blocks.length) {
    drawParagraph({ type: "paragraph", variant: "body", align: "left", indent: 0, inlines: [] }, ctx)
  }
  drawChrome(ctx, doc)
  return pdf.save()
}
