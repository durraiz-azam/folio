import { Extension, type CommandProps } from "@tiptap/core"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    folioIndent: {
      indentText: () => ReturnType
      outdentText: () => ReturnType
    }
  }
}

function changeIndent(delta: number) {
  return ({ tr, state, dispatch }: CommandProps) => {
    const { from, to } = state.selection
    const updates: { pos: number; attrs: Record<string, unknown> }[] = []
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name !== "paragraph" && node.type.name !== "heading") return
      const current = Number(node.attrs.indent) || 0
      const next = Math.max(0, Math.min(8, current + delta))
      if (next !== current) updates.push({ pos, attrs: { ...node.attrs, indent: next } })
    })
    if (!updates.length) return false
    if (dispatch) {
      for (const update of updates) tr.setNodeMarkup(update.pos, undefined, update.attrs)
      dispatch(tr)
    }
    return true
  }
}

export const Indent = Extension.create({
  name: "folioIndent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => Number(element.getAttribute("data-indent") || 0),
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent) || 0
              if (!indent) return {}
              return { "data-indent": indent, style: `margin-left: ${indent * 24}px` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      indentText: () => changeIndent(1),
      outdentText: () => changeIndent(-1),
    }
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("listItem") || this.editor.isActive("taskItem")) return false
        return this.editor.commands.indentText()
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("listItem") || this.editor.isActive("taskItem")) return false
        return this.editor.commands.outdentText()
      },
    }
  },
})
