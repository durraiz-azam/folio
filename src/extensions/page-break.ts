import { Node, mergeAttributes } from "@tiptap/core"

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-page-break]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-page-break": "true", class: "folio-page-break" }),
      ["span", {}, "Page break"],
    ]
  },
})
