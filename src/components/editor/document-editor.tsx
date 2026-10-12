"use client"

import type { JSONContent } from "@tiptap/core"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { toast } from "sonner"
import { FindBar } from "@/components/editor/find-bar"
import { createExtensions } from "@/components/editor/extensions"
import { Toolbar } from "@/components/editor/toolbar"
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
import { marginCss, pageCss, pageHeightPx } from "@/lib/constants"
import type { FolioDocument } from "@/lib/types"

type DocumentEditorProps = {
  doc: FolioDocument
  zoom: number
  findOpen: boolean
  pendingHtmlRef: RefObject<string | null>
  onFindOpen: (open: boolean) => void
  onChange: (content: JSONContent) => void
  onLineSpacing: (value: number) => void
  onPages: (pages: number) => void
  onEditor: (editor: Editor | null) => void
}

export function DocumentEditor({
  doc,
  zoom,
  findOpen,
  pendingHtmlRef,
  onFindOpen,
  onChange,
  onLineSpacing,
  onPages,
  onEditor,
}: DocumentEditorProps) {
  const onChangeRef = useRef(onChange)
  const onPagesRef = useRef(onPages)
  const editorRef = useRef<Editor | null>(null)
  const extensions = useMemo(() => createExtensions(), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [imageUrl, setImageUrl] = useState("")

  const editor = useEditor({
    extensions,
    content: doc.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "folio-editor",
        spellcheck: "true",
        "aria-label": "Document",
      },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files)
        if (!files.length) return false
        event.preventDefault()
        void insertImageFiles(editorRef.current, files)
        return true
      },
      handleDrop: (view, event) => {
        const files = imageFiles(event.dataTransfer?.files)
        if (!files.length) return false
        event.preventDefault()
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        void insertImageFiles(editorRef.current, files, position)
        return true
      },
    },
    onCreate: ({ editor: created }) => {
      editorRef.current = created
      const html = pendingHtmlRef.current
      if (html) {
        pendingHtmlRef.current = null
        created.commands.setContent(html, { emitUpdate: false })
        onChangeRef.current(created.getJSON())
      }
    },
    onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON()),
  })

  useEffect(() => {
    onChangeRef.current = onChange
    onPagesRef.current = onPages
  })

  useEffect(() => {
    editorRef.current = editor
    onEditor(editor)
    return () => {
      editorRef.current = null
      onEditor(null)
    }
  }, [editor, onEditor])

  useEffect(() => {
    function openLink() {
      const href = editorRef.current?.getAttributes("link").href as string | undefined
      setLinkUrl(href || "https://")
      setLinkOpen(true)
    }
    window.addEventListener("folio-open-link", openLink)
    return () => window.removeEventListener("folio-open-link", openLink)
  }, [])

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const measure = () => {
      const pages = Math.max(1, Math.ceil(sheet.scrollHeight / pageHeightPx(doc.pageSize) - 0.04))
      onPagesRef.current(pages)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [doc.pageSize, doc.header, doc.footer, doc.pageNumbers, editor, zoom])

  const page = pageCss(doc.pageSize)
  const pad = marginCss(doc.margin)
  const showHeader = Boolean(doc.header.trim() || doc.pageNumbers)
  const showFooter = Boolean(doc.footer.trim() || doc.pageNumbers)
  const extra = (showHeader ? 28 : 0) + (showFooter ? 28 : 0)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Toolbar
        editor={editor}
        lineSpacing={doc.lineSpacing}
        onLineSpacing={onLineSpacing}
        onFind={() => onFindOpen(true)}
        onLink={() => {
          const href = editor?.getAttributes("link").href as string | undefined
          setLinkUrl(href || "https://")
          setLinkOpen(true)
        }}
        onUploadImage={() => fileRef.current?.click()}
        onImageUrl={() => {
          setImageUrl("https://")
          setImageOpen(true)
        }}
      />
      {findOpen && editor && <FindBar editor={editor} onClose={() => onFindOpen(false)} />}
      <div className="folio-scroll min-h-0 flex-1 overflow-auto">
        <div className="flex min-w-min justify-center px-3 py-6 sm:px-8 sm:py-10">
          <article
            ref={sheetRef}
            className="folio-sheet"
            style={{
              width: page.width,
              minHeight: page.height,
              padding: pad,
              zoom,
              ["--folio-editor-min" as string]: `calc(${page.height} - ${pad} - ${pad} - ${extra}px)`,
            }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) editor?.commands.focus("end")
            }}
          >
            {showHeader && (
              <div className="folio-running-header">
                <span>{doc.header}</span>
                {doc.pageNumbers && <span>1</span>}
              </div>
            )}
            {editor ? <EditorContent editor={editor} /> : <div className="folio-editor animate-pulse" />}
            {showFooter && (
              <div className="folio-running-footer">
                <span>{doc.footer}</span>
                {doc.pageNumbers && <span>1</span>}
              </div>
            )}
          </article>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const files = event.target.files
          if (files?.length) void insertImageFiles(editor, files)
          event.target.value = ""
        }}
      />
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link</DialogTitle>
            <DialogDescription>Select text first, or the address itself will be inserted.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="link-url">Address</Label>
            <Input id="link-url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://" />
          </div>
          <DialogFooter>
            {editor?.isActive("link") && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  editor.chain().focus().unsetLink().run()
                  setLinkOpen(false)
                }}
              >
                Remove
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                if (!editor) return
                const href = normalizeUrl(linkUrl)
                if (!href) {
                  editor.chain().focus().unsetLink().run()
                  setLinkOpen(false)
                  return
                }
                const { from, to } = editor.state.selection
                if (from === to) {
                  const safe = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
                  editor.chain().focus().insertContent(`<a href="${safe}">${safe}</a>`).run()
                }
                else editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
                setLinkOpen(false)
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Picture from a link</DialogTitle>
            <DialogDescription>Paste a direct image address. Pictures you upload stay in this browser.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="image-url">Image address</Label>
            <Input id="image-url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://" />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                const href = normalizeUrl(imageUrl)
                if (!href || !editor) return
                editor.chain().focus().setImage({ src: href, alt: "Picture" }).run()
                setImageOpen(false)
              }}
            >
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function imageFiles(list: FileList | null | undefined) {
  return [...(list || [])].filter((file) => file.type.startsWith("image/"))
}

async function insertImageFiles(editor: Editor | null, files: FileList | File[], position?: number) {
  if (!editor) return
  for (const file of [...files]) {
    if (file.size > 1_500_000) {
      toast.warning("That picture is large. Export a copy if this browser runs out of room.")
    }
    const src = await readDataUrl(file)
    if (position !== undefined) {
      editor.chain().focus().setTextSelection(position).setImage({ src, alt: file.name }).run()
    } else {
      editor.chain().focus().setImage({ src, alt: file.name }).run()
    }
  }
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed === "https://") return ""
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
