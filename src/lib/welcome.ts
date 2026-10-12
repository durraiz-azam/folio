import type { JSONContent } from "@tiptap/core"

function text(value: string, marks?: JSONContent["marks"]): JSONContent {
  return marks ? { type: "text", text: value, marks } : { type: "text", text: value }
}

function paragraph(...nodes: JSONContent[]): JSONContent {
  return { type: "paragraph", content: nodes }
}

function heading(level: number, value: string): JSONContent {
  return { type: "heading", attrs: { level }, content: [text(value)] }
}

function item(value: string, kind = "listItem"): JSONContent {
  return { type: kind, content: [paragraph(text(value))] }
}

function cell(value: string, header = false): JSONContent {
  return {
    type: header ? "tableHeader" : "tableCell",
    content: [paragraph(text(value))],
  }
}

function row(values: string[], header = false): JSONContent {
  return { type: "tableRow", content: values.map((value) => cell(value, header)) }
}

export function welcomeContent(): JSONContent {
  return {
    type: "doc",
    content: [
      heading(1, "A desk for everyday writing"),
      paragraph(
        text("Folio covers the ordinary work of a word processor. Write a letter, a meeting note, a one-page brief, or a handout. Format it here, then take it with you as a PDF or a Word file. Accents such as café survive the export."),
      ),
      heading(2, "Formatting you already know"),
      paragraph(
        text("Select text and use the ribbon. The shortcuts are the usual ones: "),
        text("Ctrl+B", [{ type: "bold" }]),
        text(" for bold, "),
        text("Ctrl+I", [{ type: "italic" }]),
        text(" for italic, and "),
        text("Ctrl+U", [{ type: "underline" }]),
        text(" for underline."),
      ),
      {
        type: "bulletList",
        content: [
          item("Headings, quotes, and both kinds of lists"),
          item("Font, size, color, and highlight"),
          item("Alignment, indent, and line spacing"),
          item("Tables, pictures, links, and page breaks"),
        ],
      },
      heading(2, "A page, not a web view"),
      paragraph(
        text("The sheet on the desk is the page you will export. Letter and A4, with narrow, normal, or wide margins, live under Page setup. Line spacing follows the whole document, the way a simple Word file does."),
      ),
      {
        type: "table",
        content: [
          row(["", "Draft", "Final"], true),
          row(["Notes", "Today", "Friday"]),
          row(["Review", "Sam", "Priya"]),
        ],
      },
      heading(2, "Take it with you"),
      {
        type: "orderedList",
        content: [
          item("Export PDF when you need a file to send or print."),
          item("Export Word when someone will keep editing in Microsoft Word."),
          item("Open a .docx, .html, or Folio file when the draft started somewhere else."),
        ],
      },
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [paragraph(text("Write the draft"))],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [paragraph(text("Export a PDF"))],
          },
        ],
      },
      {
        type: "blockquote",
        content: [
          paragraph(
            text("Nothing here is uploaded. Folio keeps your documents in this browser, and saves as you type."),
          ),
        ],
      },
      paragraph(
        text("Delete this page whenever you like, or keep it as a scratch sheet. "),
        text("Find", [{ type: "highlight", attrs: { color: "#fde68a" } }]),
        text(" is Ctrl+F, and a link looks like "),
        text("this", [{ type: "link", attrs: { href: "https://example.com" } }]),
        text("."),
      ),
    ],
  }
}
