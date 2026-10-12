import { FONT_FILES } from "@/lib/constants"

export type FontFaceFiles = {
  regular: Uint8Array
  bold: Uint8Array
  italic: Uint8Array
  boldItalic: Uint8Array
}

export type FontFiles = Record<"serif" | "sans" | "mono", FontFaceFiles>

let cached: Promise<FontFiles> | null = null

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

async function readFont(path: string) {
  const response = await fetch(`${assetBase}${path}`)
  if (!response.ok) throw new Error(`Could not load ${path}`)
  return new Uint8Array(await response.arrayBuffer())
}

export function loadFonts() {
  if (!cached) {
    cached = (async () => {
      const entries = await Promise.all(
        (Object.keys(FONT_FILES) as Array<keyof typeof FONT_FILES>).map(async (family) => {
          const files = FONT_FILES[family]
          const [regular, bold, italic, boldItalic] = await Promise.all([
            readFont(`/fonts/${files.regular}`),
            readFont(`/fonts/${files.bold}`),
            readFont(`/fonts/${files.italic}`),
            readFont(`/fonts/${files.boldItalic}`),
          ])
          return [family, { regular, bold, italic, boldItalic }] as const
        }),
      )
      return Object.fromEntries(entries) as FontFiles
    })()
  }
  return cached
}

export async function loadFontsFromDirectory(read: (filename: string) => Promise<Uint8Array>) {
  const entries = await Promise.all(
    (Object.keys(FONT_FILES) as Array<keyof typeof FONT_FILES>).map(async (family) => {
      const files = FONT_FILES[family]
      const [regular, bold, italic, boldItalic] = await Promise.all([
        read(files.regular),
        read(files.bold),
        read(files.italic),
        read(files.boldItalic),
      ])
      return [family, { regular, bold, italic, boldItalic }] as const
    }),
  )
  return Object.fromEntries(entries) as FontFiles
}
