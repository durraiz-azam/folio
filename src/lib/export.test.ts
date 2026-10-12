import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { promisify } from "node:util"
import JSZip from "jszip"
import { PDFDocument } from "pdf-lib"
import { buildDocx } from "./export-docx"
import { buildPdf } from "./export-pdf"
import { loadFontsFromDirectory } from "./fonts"
import { toBlocks } from "./model"
import { createDocument, normalizeDocument } from "./storage"
import { countWords, plainText } from "./text-stats"
import { welcomeContent } from "./welcome"

const exec = promisify(execFile)

async function fonts() {
  return loadFontsFromDirectory((filename) => readFile(join("public/fonts", filename)))
}

function assertNoEmptyText(node: { type?: string; text?: string; content?: unknown[] }) {
  if (node.type === "text") assert.ok(node.text)
  for (const child of node.content ?? []) assertNoEmptyText(child as { type?: string; text?: string; content?: unknown[] })
}

test("welcome document has the usual word-processor pieces", () => {
  const content = welcomeContent()
  assertNoEmptyText(content)
  const blocks = toBlocks(content)
  assert.ok(blocks.some((block) => block.type === "list" && !block.ordered))
  assert.ok(blocks.some((block) => block.type === "list" && block.ordered))
  assert.ok(blocks.some((block) => block.type === "table"))
  assert.ok(blocks.some((block) => block.type === "quote"))
  assert.ok(countWords(plainText(content)) > 40)
})

test("saved documents drop empty text nodes the editor cannot open", () => {
  const document = normalizeDocument({
    title: "Recovered",
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "" }, { type: "text", text: "Hi" }] }],
    },
  })
  assert.deepEqual(document.content.content?.[0]?.content, [{ type: "text", text: "Hi" }])
  assertNoEmptyText(document.content)
})

test("pdf export is a real multi-page-capable text file", async () => {
  const document = createDocument({
    title: "Welcome to Folio",
    content: welcomeContent(),
    pageNumbers: true,
    header: "Folio",
  })
  document.content = {
    type: "doc",
    content: [
      ...(document.content.content ?? []),
      { type: "pageBreak" },
      { type: "paragraph", content: [{ type: "text", text: "This starts the next page." }] },
    ],
  }
  const pdf = await buildPdf(document, await fonts())
  assert.equal(pdf[0], 0x25)
  const loaded = await PDFDocument.load(pdf)
  assert.equal(loaded.getPageCount(), 2)
  const directory = await mkdtemp(join(tmpdir(), "folio-"))
  const path = join(directory, "welcome.pdf")
  await writeFile(path, pdf)
  const { stdout } = await exec("pdftotext", [path, "-"])
  assert.match(stdout, /everyday writing/)
  assert.match(stdout, /This starts the next page/)
  assert.match(stdout, /café/)
})

test("word export keeps headings, table text, and lists", async () => {
  const document = createDocument({ title: "Welcome to Folio", content: welcomeContent(), pageNumbers: true })
  const docx = await buildDocx(document)
  const zip = await JSZip.loadAsync(docx)
  const xml = await zip.file("word/document.xml")?.async("string")
  assert.ok(xml)
  assert.match(xml, /everyday writing/)
  assert.match(xml, /Draft/)
  assert.match(xml, /Priya/)
})
