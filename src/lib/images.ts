export type ImageKind = "png" | "jpg" | "gif" | "bmp" | "other"

export function decodeDataUrl(src: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(src)
  if (!match) return null
  const mime = match[1] || "application/octet-stream"
  const data = match[3] || ""
  if (match[2]) {
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return { mime, bytes }
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(data)) }
}

export async function loadImageBytes(src: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
  if (!src) return null
  if (src.startsWith("data:")) return decodeDataUrl(src)
  if (/^(https?:|blob:)/.test(src)) {
    try {
      const response = await fetch(src)
      if (!response.ok) return null
      return {
        mime: response.headers.get("content-type") || "",
        bytes: new Uint8Array(await response.arrayBuffer()),
      }
    } catch {
      return null
    }
  }
  return null
}

export function imageKind(mime: string, bytes: Uint8Array): ImageKind {
  if (mime.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50)) return "png"
  if (mime.includes("jpeg") || mime.includes("jpg") || (bytes[0] === 0xff && bytes[1] === 0xd8)) return "jpg"
  if (mime.includes("gif") || (bytes[0] === 0x47 && bytes[1] === 0x49)) return "gif"
  if (mime.includes("bmp")) return "bmp"
  return "other"
}

export function imagePixelSize(kind: ImageKind, bytes: Uint8Array) {
  if (kind === "png" && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (kind === "gif" && bytes.length >= 10) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) }
  }
  if (kind === "jpg") return jpegSize(bytes)
  return null
}

function jpegSize(bytes: Uint8Array) {
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      }
    }
    if (length < 2) return null
    offset += 2 + length
  }
  return null
}

export function fitPixels(width: number, height: number, maxWidth: number) {
  if (width <= 0 || height <= 0) return { width: maxWidth, height: Math.round(maxWidth * 0.6) }
  if (width <= maxWidth) return { width: Math.round(width), height: Math.round(height) }
  const scale = maxWidth / width
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export async function rasterizeToPng(bytes: Uint8Array, mime: string) {
  if (typeof document === "undefined") return null
  const blob = new Blob([Uint8Array.from(bytes)], { type: mime || "image/png" })
  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("Could not read the picture"))
      element.src = url
    })
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth || 1
    canvas.height = image.naturalHeight || 1
    const context = canvas.getContext("2d")
    if (!context) return null
    context.drawImage(image, 0, 0)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!png) return null
    return new Uint8Array(await png.arrayBuffer())
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
