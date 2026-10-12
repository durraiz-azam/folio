"use client"

import type { Editor } from "@tiptap/react"
import { Download, FolderOpen, Keyboard, Menu, PanelLeftClose, Printer, Settings2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { DeleteDialog, PageSetupDialog, ShortcutsDialog } from "@/components/dialogs"
import { DocumentEditor } from "@/components/editor/document-editor"
import { Sidebar } from "@/components/sidebar"
import { StatusBar } from "@/components/status-bar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { pageWidthPx } from "@/lib/constants"
import { downloadBytes, fileSlug, modLabel } from "@/lib/download"
import { htmlDocument, readImportedFile } from "@/lib/import-file"
import { flushLibrary, readLibrary, readSaveError, readSaveState, readServerLibrary, subscribeLibrary, subscribeSave, writeLibrary } from "@/lib/library-store"
import { createDocument, uniqueTitle } from "@/lib/storage"
import { countCharacters, countWords, plainText, readingLabel } from "@/lib/text-stats"
import type { FolioDocument } from "@/lib/types"
import { cn } from "@/lib/utils"

export function FolioApp() {
  const library = useSyncExternalStore(subscribeLibrary, readLibrary, readServerLibrary)
  const saveState = useSyncExternalStore(subscribeSave, readSaveState, readSaveState)
  const [query, setQuery] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [pageSetupOpen, setPageSetupOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pages, setPages] = useState(1)
  const [busy, setBusy] = useState(false)
  const userZoomed = useRef(false)
  const editorRef = useRef<Editor | null>(null)
  const pendingHtmlRef = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const storageWarning = useRef(false)

  useEffect(() => {
    try {
      flushLibrary()
    } catch {
      if (!storageWarning.current) {
        storageWarning.current = true
        toast.error("This browser could not store the document. Export a copy before you close the tab.")
      }
    }
    return subscribeSave(() => {
      if (!readSaveError()) {
        storageWarning.current = false
        return
      }
      if (storageWarning.current) return
      storageWarning.current = true
      toast.error("This browser could not store the document. Export a copy before you close the tab.")
    })
  }, [])

  const active = library?.documents.find((document) => document.id === library.activeId) ?? null
  const text = useMemo(() => plainText(active?.content), [active?.content])
  const words = countWords(text)
  const characters = countCharacters(text)

  const fit = useCallback((pageSize = active?.pageSize ?? "letter") => {
    const paper = pageWidthPx(pageSize)
    const sidebar = window.innerWidth >= 768 && !focusMode ? 288 : 0
    const available = window.innerWidth - sidebar - 48
    setZoom(Math.min(1, Math.max(0.45, Math.round((available / paper) * 100) / 100)))
  }, [active?.pageSize, focusMode])

  useEffect(() => {
    if (!library || userZoomed.current) return
    fit()
  }, [library, fit])

  const onEditor = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const onPages = useCallback((next: number) => setPages(next), [])

  function patchActive(patch: Partial<FolioDocument>) {
    writeLibrary((current) => ({
      ...current,
      documents: current.documents.map((document) =>
        document.id === current.activeId ? { ...document, ...patch, updatedAt: Date.now() } : document,
      ),
    }))
  }

  function addDocument(document: FolioDocument) {
    writeLibrary((current) => {
      const documents = current.documents ?? []
      return { activeId: document.id, documents: [document, ...documents.filter((item) => item.id !== document.id)] }
    })
    setSidebarOpen(false)
    setFocusMode(false)
  }

  function liveDocument() {
    if (!active) return null
    const editor = editorRef.current
    return editor ? { ...active, content: editor.getJSON() } : active
  }

  async function withExport(label: string, work: (document: FolioDocument) => Promise<void>) {
    const document = liveDocument()
    if (!document || busy) return
    setBusy(true)
    const id = toast.loading(label)
    try {
      await work(document)
      toast.success("Download started", { id })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export that file", { id })
    } finally {
      setBusy(false)
    }
  }

  async function onOpenFile(file: File) {
    try {
      const imported = await readImportedFile(file)
      if (!library) return
      if (imported.kind === "folio") {
        addDocument({ ...imported.document, title: uniqueTitle(imported.document.title, library.documents), updatedAt: Date.now() })
        toast.success(`Opened ${imported.document.title}`)
        return
      }
      pendingHtmlRef.current = imported.html
      addDocument(createDocument({ title: uniqueTitle(imported.title, library.documents) }))
      toast.success(`Opened ${imported.title}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open that file")
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      const target = event.target as HTMLElement | null
      const inField = Boolean(target?.closest("input, textarea, select"))
      if (key === "f") {
        event.preventDefault()
        setFindOpen(true)
      } else if (key === "s") {
        event.preventDefault()
        try {
          flushLibrary()
          toast.success("Saved in this browser")
        } catch {
          toast.error("Could not save in this browser")
        }
      } else if (key === "k" && !inField) {
        event.preventDefault()
        window.dispatchEvent(new Event("folio-open-link"))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (!library) {
    return (
      <div className="grid h-dvh place-items-center bg-desk">
        <div className="h-[62vh] w-[min(720px,calc(100%-2rem))] animate-pulse bg-paper shadow-[0_18px_50px_rgba(60,40,20,0.12)]" />
      </div>
    )
  }

  const deleteTarget = library.documents.find((document) => document.id === deleteId) ?? null

  return (
    <div className="folio-app flex h-dvh flex-col bg-desk text-foreground">
      <header className="folio-chrome flex h-14 shrink-0 items-center gap-2 border-b border-border bg-[#f7f3eb] px-2 sm:px-3">
        <Button type="button" variant="ghost" size="icon-sm" className="md:hidden" aria-label="Documents" onClick={() => setSidebarOpen(true)}>
          <Menu />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="hidden md:inline-flex"
          aria-label={focusMode ? "Show documents" : "Hide documents"}
          onClick={() => setFocusMode((value) => !value)}
        >
          <PanelLeftClose />
        </Button>
        <div className="flex items-center gap-2 pr-1">
          <span className="grid size-7 place-items-center rounded-md bg-primary font-serif text-sm text-primary-foreground">F</span>
          <span className="hidden font-serif text-lg tracking-tight sm:inline">Folio</span>
        </div>
        <input
          value={active?.title ?? ""}
          disabled={!active}
          aria-label="Document title"
          onChange={(event) => patchActive({ title: event.target.value.slice(0, 120) })}
          className="h-8 min-w-0 flex-1 truncate rounded-md bg-transparent px-2 text-center text-sm font-medium outline-none focus:bg-white"
        />
        <Button type="button" variant="ghost" size="sm" disabled={!active} onClick={() => setPageSetupOpen(true)}>
          <Settings2 />
          <span className="hidden sm:inline">Page setup</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <FolderOpen />
          <span className="hidden sm:inline">Open</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" disabled={!active || busy}>
              <Download />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => void withExport("Preparing PDF…", async (document) => {
              const [{ buildPdf }, { loadFonts }] = await Promise.all([import("@/lib/export-pdf"), import("@/lib/fonts")])
              const bytes = await buildPdf(document, await loadFonts())
              downloadBytes(bytes, `${fileSlug(document.title)}.pdf`, "application/pdf")
            })}>
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void withExport("Preparing Word file…", async (document) => {
              const { buildDocx } = await import("@/lib/export-docx")
              const bytes = await buildDocx(document)
              downloadBytes(bytes, `${fileSlug(document.title)}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
            })}>
              Word (.docx)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void withExport("Preparing HTML…", async (document) => {
              const html = editorRef.current?.getHTML() ?? ""
              downloadBytes(new Blob([htmlDocument(document, html)], { type: "text/html" }), `${fileSlug(document.title)}.html`, "text/html")
            })}>
              HTML
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void withExport("Preparing Folio file…", async (document) => {
              downloadBytes(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }), `${fileSlug(document.title)}.folio.json`, "application/json")
            })}>
              Folio file
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => window.print()}>
              <Printer /> Print
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Shortcuts" onClick={() => setShortcutsOpen(true)}>
          <Keyboard />
        </Button>
      </header>
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <button type="button" aria-label="Close documents" className="absolute inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside
          className={cn(
            "folio-chrome absolute inset-y-0 left-0 z-40 w-72 border-r border-border transition-transform md:static md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            focusMode && "md:hidden",
          )}
        >
          <Sidebar
            documents={library.documents}
            activeId={library.activeId}
            query={query}
            onQuery={setQuery}
            onSelect={(id) => {
              writeLibrary((current) => ({ ...current, activeId: id }))
              setSidebarOpen(false)
            }}
            onCreate={() => addDocument(createDocument({ title: uniqueTitle("Untitled document", library.documents) }))}
            onDuplicate={(id) => {
              const source = library.documents.find((document) => document.id === id)
              if (!source) return
              addDocument(createDocument({
                title: uniqueTitle(`${source.title} copy`, library.documents),
                content: structuredClone(source.content),
                pageSize: source.pageSize,
                margin: source.margin,
                lineSpacing: source.lineSpacing,
                header: source.header,
                footer: source.footer,
                pageNumbers: source.pageNumbers,
              }))
            }}
            onDelete={setDeleteId}
          />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {active ? (
            <DocumentEditor
              key={active.id}
              doc={active}
              zoom={zoom}
              findOpen={findOpen}
              pendingHtmlRef={pendingHtmlRef}
              onFindOpen={setFindOpen}
              onChange={(content) => patchActive({ content })}
              onLineSpacing={(lineSpacing) => patchActive({ lineSpacing })}
              onPages={onPages}
              onEditor={onEditor}
            />
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <div className="max-w-sm">
                <h1 className="font-serif text-3xl">The desk is clear</h1>
                <p className="mt-2 text-sm text-muted-foreground">Start a document for a letter, notes, or a one-page brief.</p>
                <Button type="button" className="mt-5" onClick={() => addDocument(createDocument())}>
                  New document
                </Button>
              </div>
            </div>
          )}
          <StatusBar
            doc={active}
            words={words}
            characters={characters}
            reading={readingLabel(words)}
            pages={pages}
            saveState={saveState}
            zoom={zoom}
            onZoom={(next) => {
              userZoomed.current = true
              setZoom(next)
            }}
            onFit={() => {
              userZoomed.current = false
              fit()
            }}
          />
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".docx,.html,.htm,.json,application/json,text/html"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onOpenFile(file)
          event.target.value = ""
        }}
      />
      {active && (
        <PageSetupDialog
          doc={active}
          open={pageSetupOpen}
          onOpenChange={setPageSetupOpen}
          onSave={(draft) => patchActive(draft)}
        />
      )}
      <DeleteDialog
        title={deleteTarget?.title ?? "this document"}
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        onConfirm={() => {
          if (!deleteId) return
          writeLibrary((current) => {
            const documents = current.documents.filter((document) => document.id !== deleteId)
            const activeId = current.activeId === deleteId ? documents[0]?.id ?? "" : current.activeId
            return { activeId, documents }
          })
        }}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <span className="sr-only">{modLabel()} shortcuts are listed in the keyboard dialog.</span>
    </div>
  )
}
