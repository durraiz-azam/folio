"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LINE_SPACINGS, MARGIN_LABEL, PAGE_POINTS } from "@/lib/constants"
import { modLabel } from "@/lib/download"
import type { FolioDocument, MarginPreset, PageSize } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useState, type ReactNode } from "react"

type PageDraft = Pick<FolioDocument, "pageSize" | "margin" | "lineSpacing" | "header" | "footer" | "pageNumbers">

export function PageSetupDialog({
  doc,
  open,
  onOpenChange,
  onSave,
}: {
  doc: FolioDocument
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (draft: PageDraft) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <PageSetupForm doc={doc} onSave={onSave} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  )
}

function PageSetupForm({
  doc,
  onSave,
  onOpenChange,
}: {
  doc: FolioDocument
  onSave: (draft: PageDraft) => void
  onOpenChange: (open: boolean) => void
}) {
  const [draft, setDraft] = useState<PageDraft>({
    pageSize: doc.pageSize,
    margin: doc.margin,
    lineSpacing: doc.lineSpacing,
    header: doc.header,
    footer: doc.footer,
    pageNumbers: doc.pageNumbers,
  })

  return (
    <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Page setup</DialogTitle>
          <DialogDescription>The sheet on the desk uses these settings, and so do PDF and Word exports.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Paper</legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PAGE_POINTS) as PageSize[]).map((size) => (
                <Choice key={size} pressed={draft.pageSize === size} onClick={() => setDraft({ ...draft, pageSize: size })}>
                  {PAGE_POINTS[size].label}
                </Choice>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Margins</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(MARGIN_LABEL) as MarginPreset[]).map((margin) => (
                <Choice key={margin} pressed={draft.margin === margin} onClick={() => setDraft({ ...draft, margin })}>
                  {MARGIN_LABEL[margin]}
                </Choice>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor="line-spacing">Line spacing</Label>
            <select
              id="line-spacing"
              className="h-8 rounded-lg border border-input bg-white px-2 text-sm"
              value={String(draft.lineSpacing)}
              onChange={(event) => setDraft({ ...draft, lineSpacing: Number(event.target.value) })}
            >
              {LINE_SPACINGS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="header">Header</Label>
            <Input id="header" value={draft.header} onChange={(event) => setDraft({ ...draft, header: event.target.value })} placeholder="Optional running header" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="footer">Footer</Label>
            <Input id="footer" value={draft.footer} onChange={(event) => setDraft({ ...draft, footer: event.target.value })} placeholder="Optional running footer" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.pageNumbers}
              onChange={(event) => setDraft({ ...draft, pageNumbers: event.target.checked })}
            />
            Page numbers
          </label>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => { onSave(draft); onOpenChange(false) }}>
            Apply
          </Button>
        </DialogFooter>
    </DialogContent>
  )
}

export function DeleteDialog({
  title,
  open,
  onOpenChange,
  onConfirm,
}: {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{title}”?</DialogTitle>
          <DialogDescription>This removes it from this browser. Export a copy first if you still need the file.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Keep
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const mod = modLabel()
  const rows = [
    ["Bold", `${mod}+B`],
    ["Italic", `${mod}+I`],
    ["Underline", `${mod}+U`],
    ["Undo", `${mod}+Z`],
    ["Redo", `${mod}+Shift+Z`],
    ["Find", `${mod}+F`],
    ["Link", `${mod}+K`],
    ["Save", `${mod}+S`],
    ["Print", `${mod}+P`],
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shortcuts</DialogTitle>
          <DialogDescription>The same ones you use in a word processor.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
          {rows.map(([name, keys]) => (
            <div key={name} className="contents">
              <dt>{name}</dt>
              <dd className="font-mono text-xs text-muted-foreground">{keys}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}

function Choice({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg border text-sm",
        pressed ? "border-[#8a5a32] bg-[#f6efe4] text-foreground" : "border-border bg-white hover:bg-accent",
      )}
    >
      {children}
    </button>
  )
}
