export function fileSlug(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "document"
}

export function downloadBytes(data: Blob | Uint8Array, filename: string, mime: string) {
  const blob = data instanceof Blob ? data : bytesToBlob(data, mime)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function bytesToBlob(data: Uint8Array, mime: string) {
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  return new Blob([copy], { type: mime })
}

export function editedLabel(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

export function modLabel() {
  if (typeof navigator === "undefined") return "Ctrl"
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"
}
