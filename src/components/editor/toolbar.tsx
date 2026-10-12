"use client"

import type { Editor } from "@tiptap/react"
import {
  Baseline,
  Bold,
  Code,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Search,
  SeparatorHorizontal,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Underline,
  Undo2,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FONT_OPTIONS, FONT_SIZES, FONT_STACKS, HIGHLIGHTS, LINE_SPACINGS, TEXT_COLORS } from "@/lib/constants"
import { fontKeyFromFamily, parseFontSize } from "@/lib/constants"
import { modLabel } from "@/lib/download"
import { cn } from "@/lib/utils"

type ToolbarProps = {
  editor: Editor | null
  lineSpacing: number
  onLineSpacing: (value: number) => void
  onFind: () => void
  onLink: () => void
  onUploadImage: () => void
  onImageUrl: () => void
}

export function Toolbar(props: ToolbarProps) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!props.editor) return
    const refresh = () => setTick((value) => value + 1)
    props.editor.on("transaction", refresh)
    return () => {
      props.editor?.off("transaction", refresh)
    }
  }, [props.editor])

  const editor = props.editor
  const mod = modLabel()
  const fontFamily = editor?.getAttributes("textStyle").fontFamily as string | undefined
  const fontKey = fontKeyFromFamily(fontFamily)
  const markedSize = editor?.getAttributes("textStyle").fontSize as string | undefined
  const sizeLabel = markedSize
    ? `${parseFontSize(markedSize)}pt`
    : editor?.isActive("heading", { level: 1 })
      ? "22pt"
      : editor?.isActive("heading", { level: 2 })
        ? "16pt"
        : editor?.isActive("heading", { level: 3 })
          ? "13pt"
          : "12pt"

  return (
    <div
      className="folio-chrome folio-ribbon flex items-center gap-1 overflow-x-auto border-b border-border bg-[#f7f3eb] px-2 py-1.5 lg:flex-wrap"
      onMouseDown={(event) => {
        const target = event.target as HTMLElement
        if (target.closest("input, select, textarea")) return
        event.preventDefault()
      }}
    >
      <Group>
        <IconButton label={`Undo (${mod}+Z)`} disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 />
        </IconButton>
        <IconButton label={`Redo (${mod}+Shift+Z)`} disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 />
        </IconButton>
      </Group>
      <Divider />
      <select
        aria-label="Style"
        className={selectClass}
        value={currentStyle(editor)}
        disabled={!editor}
        onChange={(event) => applyStyle(editor, event.target.value)}
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="quote">Quote</option>
      </select>
      <select
        aria-label="Font"
        className={selectClass}
        value={fontKey}
        disabled={!editor}
        onChange={(event) => {
          const key = event.target.value as keyof typeof FONT_STACKS
          if (key === "serif") editor?.chain().focus().unsetFontFamily().run()
          else editor?.chain().focus().setFontFamily(FONT_STACKS[key]).run()
        }}
      >
        {FONT_OPTIONS.map((font) => (
          <option key={font.key} value={font.key}>
            {font.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Font size"
        className={cn(selectClass, "w-[4.6rem]")}
        value={sizeLabel}
        disabled={!editor}
        onChange={(event) => editor?.chain().focus().setFontSize(event.target.value).run()}
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={`${size}pt`}>
            {size}
          </option>
        ))}
        {!FONT_SIZES.includes(parseFontSize(sizeLabel)) && <option value={sizeLabel}>{parseFontSize(sizeLabel)}</option>}
      </select>
      <Divider />
      <Group>
        <IconButton label={`Bold (${mod}+B)`} active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold />
        </IconButton>
        <IconButton label={`Italic (${mod}+I)`} active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic />
        </IconButton>
        <IconButton label={`Underline (${mod}+U)`} active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <Underline />
        </IconButton>
        <IconButton label="Strikethrough" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough />
        </IconButton>
        <IconButton label="Superscript" active={editor?.isActive("superscript")} onClick={() => editor?.chain().focus().toggleSuperscript().run()}>
          <Superscript />
        </IconButton>
        <IconButton label="Subscript" active={editor?.isActive("subscript")} onClick={() => editor?.chain().focus().toggleSubscript().run()}>
          <Subscript />
        </IconButton>
      </Group>
      <ColorMenu editor={editor} />
      <HighlightMenu editor={editor} />
      <Divider />
      <Group>
        <IconButton label="Align left" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
          <TextAlignStart />
        </IconButton>
        <IconButton label="Align center" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
          <TextAlignCenter />
        </IconButton>
        <IconButton label="Align right" active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
          <TextAlignEnd />
        </IconButton>
        <IconButton label="Justify" active={editor?.isActive({ textAlign: "justify" })} onClick={() => editor?.chain().focus().setTextAlign("justify").run()}>
          <TextAlignJustify />
        </IconButton>
      </Group>
      <Divider />
      <Group>
        <IconButton label="Bulleted list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List />
        </IconButton>
        <IconButton label="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </IconButton>
        <IconButton label="Checklist" active={editor?.isActive("taskList")} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
          <ListChecks />
        </IconButton>
        <IconButton label="Decrease indent" onClick={() => shiftIndent(editor, -1)}>
          <ListIndentDecrease />
        </IconButton>
        <IconButton label="Increase indent" onClick={() => shiftIndent(editor, 1)}>
          <ListIndentIncrease />
        </IconButton>
      </Group>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-xs">
            {LINE_SPACINGS.find((item) => item.value === props.lineSpacing)?.label ?? "1.15"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {LINE_SPACINGS.map((item) => (
            <DropdownMenuItem key={item.value} onSelect={() => props.onLineSpacing(item.value)}>
              Line spacing {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Divider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-xs">
            Insert
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onSelect={props.onLink}>
            <Link2 /> Link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onUploadImage}>
            <ImageIcon /> Picture from this computer
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onImageUrl}>
            <ImageIcon /> Picture from a link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table /> Table
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => editor?.chain().focus().insertContent({ type: "pageBreak" }).run()}>
            <SeparatorHorizontal /> Page break
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => editor?.chain().focus().setHorizontalRule().run()}>
            <Minus /> Horizontal line
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote /> Quote
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => editor?.chain().focus().toggleCodeBlock().run()}>
            <Code /> Code block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label="Clear formatting" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting />
      </IconButton>
      <IconButton label={`Find (${mod}+F)`} onClick={props.onFind}>
        <Search />
      </IconButton>
      {editor?.isActive("table") && (
        <>
          <Divider />
          <Group>
            <TextButton onClick={() => editor.chain().focus().addRowAfter().run()}>Row</TextButton>
            <TextButton onClick={() => editor.chain().focus().addColumnAfter().run()}>Column</TextButton>
            <TextButton onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</TextButton>
            <TextButton onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</TextButton>
            <TextButton onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</TextButton>
          </Group>
        </>
      )}
      {editor?.isActive("image") && (
        <>
          <Divider />
          <Group>
            {[25, 50, 75, 100].map((percent) => (
              <TextButton key={percent} onClick={() => resizeImage(editor, percent)}>
                {percent}%
              </TextButton>
            ))}
          </Group>
        </>
      )}
    </div>
  )
}

function ColorMenu({ editor }: { editor: Editor | null }) {
  const current = (editor?.getAttributes("textStyle").color as string | undefined) || "#1c1915"
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Text color">
          <Baseline style={{ color: current }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-4 gap-1">
          {TEXT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              aria-label={color.name}
              className="size-7 rounded-md border border-border"
              style={{ background: color.value }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.chain().focus().setColor(color.value).run()}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-2 w-full rounded-md px-2 py-1 text-left text-xs hover:bg-accent"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().unsetColor().run()}
        >
          Default color
        </button>
      </PopoverContent>
    </Popover>
  )
}

function HighlightMenu({ editor }: { editor: Editor | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Highlight">
          <Highlighter />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-1">
          {HIGHLIGHTS.map((color) => (
            <button
              key={color.value}
              type="button"
              aria-label={color.name}
              className="size-7 rounded-md border border-border"
              style={{ background: color.value }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.chain().focus().setHighlight({ color: color.value }).run()}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-2 w-full rounded-md px-2 py-1 text-left text-xs hover:bg-accent"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().unsetHighlight().run()}
        >
          No highlight
        </button>
      </PopoverContent>
    </Popover>
  )
}

function IconButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          className={cn(active && "bg-accent text-foreground")}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function TextButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onClick}>
      {children}
    </Button>
  )
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />
}

const selectClass =
  "h-7 shrink-0 rounded-md border border-border bg-white px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"

function currentStyle(editor: Editor | null) {
  if (!editor) return "p"
  if (editor.isActive("blockquote")) return "quote"
  if (editor.isActive("heading", { level: 1 })) return "h1"
  if (editor.isActive("heading", { level: 2 })) return "h2"
  if (editor.isActive("heading", { level: 3 })) return "h3"
  return "p"
}

function applyStyle(editor: Editor | null, kind: string) {
  if (!editor) return
  let chain = editor.chain().focus()
  if (editor.isActive("blockquote") && kind !== "quote") chain = chain.toggleBlockquote()
  if (kind === "quote") {
    if (!editor.isActive("blockquote")) chain = chain.toggleBlockquote()
    chain = chain.setParagraph()
  } else if (kind === "h1") chain = chain.setHeading({ level: 1 })
  else if (kind === "h2") chain = chain.setHeading({ level: 2 })
  else if (kind === "h3") chain = chain.setHeading({ level: 3 })
  else chain = chain.setParagraph()
  chain.run()
}

function shiftIndent(editor: Editor | null, direction: 1 | -1) {
  if (!editor) return
  if (editor.isActive("listItem")) {
    editor.chain().focus()[direction > 0 ? "sinkListItem" : "liftListItem"]("listItem").run()
    return
  }
  if (editor.isActive("taskItem")) {
    editor.chain().focus()[direction > 0 ? "sinkListItem" : "liftListItem"]("taskItem").run()
    return
  }
  editor.chain().focus()[direction > 0 ? "indentText" : "outdentText"]().run()
}

function resizeImage(editor: Editor, percent: number) {
  const width = editor.view.dom.clientWidth
  editor
    .chain()
    .focus()
    .updateAttributes("image", percent === 100 ? { width: null, height: null } : { width: Math.round(width * (percent / 100)), height: null })
    .run()
}
