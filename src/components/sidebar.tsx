"use client"

import { Copy, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { editedLabel } from "@/lib/download"
import type { FolioDocument } from "@/lib/types"
import { cn } from "@/lib/utils"

type SidebarProps = {
  documents: FolioDocument[]
  activeId: string
  query: string
  onQuery: (value: string) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export function Sidebar({
  documents,
  activeId,
  query,
  onQuery,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
}: SidebarProps) {
  const filtered = documents.filter((document) => document.title.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Documents</p>
        <Button type="button" size="sm" onClick={onCreate}>
          <Plus />
          New
        </Button>
      </div>
      <div className="px-3 pb-2">
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search documents"
          aria-label="Search documents"
          className="bg-white"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        {filtered.length === 0 && (
          <p className="px-2 py-6 text-sm text-muted-foreground">
            {documents.length === 0 ? "No documents yet." : "No documents with that name."}
          </p>
        )}
        <ul className="space-y-1">
          {filtered.map((document) => {
            const active = document.id === activeId
            return (
              <li key={document.id}>
                <div
                  className={cn(
                    "group flex items-stretch rounded-lg",
                    active ? "bg-white shadow-sm ring-1 ring-border" : "hover:bg-white/70",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(document.id)}
                    className={cn(
                      "min-w-0 flex-1 rounded-lg px-3 py-2 text-left",
                      active && "border-l-2 border-l-[#8a5a32]",
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{document.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{editedLabel(document.updatedAt)}</span>
                  </button>
                  <div className="flex items-center pr-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Duplicate ${document.title}`} onClick={() => onDuplicate(document.id)}>
                      <Copy />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${document.title}`} onClick={() => onDelete(document.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
