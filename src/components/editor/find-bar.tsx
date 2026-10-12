"use client"

import type { Editor } from "@tiptap/react"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { replaceAll, replaceCurrent, revealCurrentMatch, searchState, setSearch } from "@/extensions/search"
import { toast } from "sonner"

export function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [term, setTerm] = useState("")
  const [replacement, setReplacement] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [index, setIndex] = useState(0)
  const [total, setTotal] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    return () => setSearch(editor, { term: "", index: 0 })
  }, [editor])

  function publish(nextTerm: string, nextCase: boolean) {
    setSearch(editor, { term: nextTerm, index: 0, caseSensitive: nextCase })
    const snapshot = searchState(editor)
    setIndex(snapshot?.matches.length ? 1 : 0)
    setTotal(snapshot?.matches.length ?? 0)
    revealCurrentMatch(editor)
  }

  function move(direction: 1 | -1) {
    const snapshot = searchState(editor)
    if (!snapshot?.matches.length) return
    const next = (snapshot.index + direction + snapshot.matches.length) % snapshot.matches.length
    setSearch(editor, { index: next })
    setIndex(next + 1)
    revealCurrentMatch(editor)
  }

  return (
    <div className="folio-chrome flex flex-wrap items-center gap-2 border-b border-border bg-[#fbf7f0] px-3 py-2">
      <Input
        ref={inputRef}
        value={term}
        onChange={(event) => {
          const next = event.target.value
          setTerm(next)
          publish(next, caseSensitive)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            move(event.shiftKey ? -1 : 1)
          }
          if (event.key === "Escape") onClose()
        }}
        placeholder="Find"
        aria-label="Find"
        className="h-8 w-40 bg-white sm:w-52"
      />
      <span className="min-w-16 text-xs text-muted-foreground" aria-live="polite">
        {term ? (total ? `${index} of ${total}` : "No matches") : "Find"}
      </span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous match" onClick={() => move(-1)}>
        <ChevronUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Next match" onClick={() => move(1)}>
        <ChevronDown />
      </Button>
      <Button
        type="button"
        variant={caseSensitive ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={caseSensitive}
        onClick={() => {
          const next = !caseSensitive
          setCaseSensitive(next)
          publish(term, next)
        }}
      >
        Aa
      </Button>
      <Input
        value={replacement}
        onChange={(event) => setReplacement(event.target.value)}
        placeholder="Replace"
        aria-label="Replace with"
        className="h-8 w-40 bg-white sm:w-52"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const count = replaceCurrent(editor, replacement)
          const snapshot = searchState(editor)
          setTotal(snapshot?.matches.length ?? 0)
          setIndex(snapshot?.matches.length ? snapshot.index + 1 : 0)
          if (!count) toast("Nothing to replace")
        }}
      >
        Replace
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const count = replaceAll(editor, replacement)
          const snapshot = searchState(editor)
          setTotal(snapshot?.matches.length ?? 0)
          setIndex(snapshot?.matches.length ? 1 : 0)
          toast(count ? `Replaced ${count}` : "Nothing to replace")
        }}
      >
        All
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Close find" onClick={onClose}>
        <X />
      </Button>
    </div>
  )
}
