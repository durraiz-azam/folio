import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Folio",
  description: "A word processor for everyday writing. Format a page, then export PDF or Word.",
}

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const fontFaces = [
  ["Tinos", "Tinos-Regular.ttf", 400, "normal"],
  ["Tinos", "Tinos-Bold.ttf", 700, "normal"],
  ["Tinos", "Tinos-Italic.ttf", 400, "italic"],
  ["Tinos", "Tinos-BoldItalic.ttf", 700, "italic"],
  ["Arimo", "Arimo-Regular.ttf", 400, "normal"],
  ["Arimo", "Arimo-Bold.ttf", 700, "normal"],
  ["Arimo", "Arimo-Italic.ttf", 400, "italic"],
  ["Arimo", "Arimo-BoldItalic.ttf", 700, "italic"],
  ["Cousine", "Cousine-Regular.ttf", 400, "normal"],
  ["Cousine", "Cousine-Bold.ttf", 700, "normal"],
  ["Cousine", "Cousine-Italic.ttf", 400, "italic"],
  ["Cousine", "Cousine-BoldItalic.ttf", 700, "italic"],
]
  .map(
    ([family, file, weight, style]) =>
      `@font-face{font-family:"${family}";src:url("${assetBase}/fonts/${file}") format("truetype");font-weight:${weight};font-style:${style};font-display:swap;}`,
  )
  .join("")

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <style>{fontFaces}</style>
      </head>
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider delayDuration={400}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
