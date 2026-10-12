import { Extension, type Editor } from "@tiptap/core"
import type { Node as ProseNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

type Match = { from: number; to: number }

export type SearchSnapshot = {
  term: string
  index: number
  caseSensitive: boolean
  matches: Match[]
  decorations: DecorationSet
}

export const searchPluginKey = new PluginKey<SearchSnapshot>("folioSearch")

function scan(doc: ProseNode, term: string, caseSensitive: boolean) {
  if (!term) return []
  const matches: Match[] = []
  const needle = caseSensitive ? term : term.toLowerCase()
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const haystack = caseSensitive ? node.text : node.text.toLowerCase()
    let start = 0
    while (start <= haystack.length - needle.length) {
      const found = haystack.indexOf(needle, start)
      if (found === -1) break
      matches.push({ from: pos + found, to: pos + found + needle.length })
      start = found + Math.max(needle.length, 1)
    }
  })
  return matches
}

function decorate(doc: ProseNode, term: string, index: number, caseSensitive: boolean): SearchSnapshot {
  const matches = scan(doc, term, caseSensitive)
  const safeIndex = matches.length ? ((index % matches.length) + matches.length) % matches.length : 0
  return {
    term,
    index: safeIndex,
    caseSensitive,
    matches,
    decorations: DecorationSet.create(
      doc,
      matches.map((match, matchIndex) =>
        Decoration.inline(match.from, match.to, {
          class: matchIndex === safeIndex ? "search-hit search-hit-current" : "search-hit",
        }),
      ),
    ),
  }
}

export const SearchReplace = Extension.create({
  name: "searchReplace",
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchSnapshot>({
        key: searchPluginKey,
        state: {
          init: (_, state) => decorate(state.doc, "", 0, false),
          apply(tr, previous) {
            const meta = tr.getMeta(searchPluginKey) as
              | Partial<Pick<SearchSnapshot, "term" | "index" | "caseSensitive">>
              | undefined
            if (!meta && !tr.docChanged) {
              return { ...previous, decorations: previous.decorations.map(tr.mapping, tr.doc) }
            }
            return decorate(
              tr.doc,
              meta?.term ?? previous.term,
              meta?.index ?? previous.index,
              meta?.caseSensitive ?? previous.caseSensitive,
            )
          },
        },
        props: {
          decorations(state) {
            return searchPluginKey.getState(state)?.decorations ?? null
          },
        },
      }),
    ]
  },
})

export function searchState(editor: Editor) {
  return searchPluginKey.getState(editor.state)
}

export function setSearch(editor: Editor, patch: Partial<Pick<SearchSnapshot, "term" | "index" | "caseSensitive">>) {
  const current = searchState(editor)
  editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, { ...current, ...patch }))
}

export function replaceCurrent(editor: Editor, replacement: string) {
  const current = searchState(editor)
  const match = current?.matches[current.index]
  if (!current || !match) return 0
  const tr = editor.state.tr.insertText(replacement, match.from, match.to)
  tr.setMeta(searchPluginKey, { term: current.term, index: current.index, caseSensitive: current.caseSensitive })
  editor.view.dispatch(tr)
  return 1
}

export function replaceAll(editor: Editor, replacement: string) {
  const current = searchState(editor)
  if (!current?.matches.length) return 0
  const tr = editor.state.tr
  for (const match of [...current.matches].reverse()) tr.insertText(replacement, match.from, match.to)
  tr.setMeta(searchPluginKey, { term: current.term, index: 0, caseSensitive: current.caseSensitive })
  editor.view.dispatch(tr)
  return current.matches.length
}

export function revealCurrentMatch(editor: Editor) {
  editor.view.dom.querySelector(".search-hit-current")?.scrollIntoView({ block: "center", inline: "nearest" })
}
