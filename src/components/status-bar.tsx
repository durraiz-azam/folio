"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MARGIN_LABEL, PAGE_POINTS } from "@/lib/constants"
import type { FolioDocument } from "@/lib/types"

type StatusBarProps = {
  doc: FolioDocument | null
  words: number
  characters: number
  reading: string
  pages: number
  saveState: "saved" | "saving" | "error"
  zoom: number
  onZoom: (zoom: number) => void
  onFit: () => void
}

export function StatusBar({ doc, words, characters, reading, pages, saveState, zoom, onZoom, onFit }: StatusBarProps) {
  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved in this browser"
  return (
    <footer className="folio-chrome flex h-9 shrink-0 items-center justify-between gap-3 border-t border-border bg-[#f7f3eb] px-3 text-xs text-muted-foreground">
      <p className="min-w-0 truncate">
        <span className="text-foreground">{words.toLocaleString()} words</span>
        <span className="hidden sm:inline"> · {characters.toLocaleString()} characters · {reading}</span>
      </p>
      <p className="hidden md:block">{saveLabel}</p>
      <div className="flex items-center gap-2">
        {doc && (
          <span className="hidden lg:inline">
            {pages} {pages === 1 ? "page" : "pages"} · {PAGE_POINTS[doc.pageSize].label} · {MARGIN_LABEL[doc.margin]}
          </span>
        )}
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Zoom out" onClick={() => onZoom(clamp(zoom - 0.1))}>
          <Minus />
        </Button>
        <button type="button" className="w-12 tabular-nums" onClick={onFit} aria-label="Fit page to width">
          {Math.round(zoom * 100)}%
        </button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Zoom in" onClick={() => onZoom(clamp(zoom + 0.1))}>
          <Plus />
        </Button>
      </div>
    </footer>
  )
}

function clamp(value: number) {
  return Math.min(2, Math.max(0.5, Math.round(value * 100) / 100))
}
