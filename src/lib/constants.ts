import type { FontKey, MarginPreset, PageSize } from "@/lib/types"

export const FONT_STACKS: Record<FontKey, string> = {
  serif: '"Tinos", "Times New Roman", Times, serif',
  sans: '"Arimo", Arial, Helvetica, sans-serif',
  mono: '"Cousine", "Courier New", Courier, monospace',
}

export const FONT_OPTIONS: { key: FontKey; label: string }[] = [
  { key: "serif", label: "Serif" },
  { key: "sans", label: "Sans" },
  { key: "mono", label: "Mono" },
]

export const DOCX_FONTS: Record<FontKey, string> = {
  serif: "Times New Roman",
  sans: "Arial",
  mono: "Courier New",
}

export const FONT_FILES = {
  serif: {
    regular: "Tinos-Regular.ttf",
    bold: "Tinos-Bold.ttf",
    italic: "Tinos-Italic.ttf",
    boldItalic: "Tinos-BoldItalic.ttf",
  },
  sans: {
    regular: "Arimo-Regular.ttf",
    bold: "Arimo-Bold.ttf",
    italic: "Arimo-Italic.ttf",
    boldItalic: "Arimo-BoldItalic.ttf",
  },
  mono: {
    regular: "Cousine-Regular.ttf",
    bold: "Cousine-Bold.ttf",
    italic: "Cousine-Italic.ttf",
    boldItalic: "Cousine-BoldItalic.ttf",
  },
} as const

export const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72]

export const LINE_SPACINGS = [
  { value: 1, label: "Single" },
  { value: 1.15, label: "1.15" },
  { value: 1.5, label: "1.5" },
  { value: 2, label: "Double" },
]

export const TEXT_COLORS = [
  { name: "Black", value: "#1c1915" },
  { name: "Slate", value: "#5c5852" },
  { name: "Red", value: "#9f2d20" },
  { name: "Orange", value: "#b54708" },
  { name: "Green", value: "#17663a" },
  { name: "Blue", value: "#1849a9" },
  { name: "Purple", value: "#5925dc" },
]

export const HIGHLIGHTS = [
  { name: "Yellow", value: "#fde68a" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
]

export const PAGE_POINTS: Record<PageSize, { width: number; height: number; label: string }> = {
  letter: { width: 612, height: 792, label: "Letter" },
  a4: { width: 595.28, height: 841.89, label: "A4" },
}

export const MARGIN_POINTS: Record<MarginPreset, number> = {
  narrow: 36,
  normal: 72,
  wide: 90,
}

export const MARGIN_LABEL: Record<MarginPreset, string> = {
  narrow: "Narrow",
  normal: "Normal",
  wide: "Wide",
}

export function pageCss(size: PageSize) {
  return size === "a4"
    ? { width: "210mm", height: "297mm" }
    : { width: "8.5in", height: "11in" }
}

export function marginCss(margin: MarginPreset) {
  if (margin === "narrow") return "0.5in"
  if (margin === "wide") return "1.25in"
  return "1in"
}

export function pageHeightPx(size: PageSize) {
  return size === "a4" ? (297 / 25.4) * 96 : 11 * 96
}

export function pageWidthPx(size: PageSize) {
  return size === "a4" ? (210 / 25.4) * 96 : 8.5 * 96
}

export function fontKeyFromFamily(family?: string | null): FontKey {
  const value = (family || "").toLowerCase()
  if (value.includes("arimo") || value.includes("arial") || value.includes("helvetica") || value.includes("sans")) {
    return "sans"
  }
  if (value.includes("cousine") || value.includes("courier") || value.includes("mono")) {
    return "mono"
  }
  return "serif"
}

export function parseFontSize(value?: string | null, fallback = 12) {
  if (!value) return fallback
  const amount = Number.parseFloat(value)
  if (!Number.isFinite(amount) || amount <= 0) return fallback
  if (value.trim().endsWith("px")) return Math.round(amount * 0.75 * 10) / 10
  return amount
}

export function nearestLineSpacing(value: number) {
  return LINE_SPACINGS.find((item) => Math.abs(item.value - value) < 0.02)?.value ?? 1.15
}
