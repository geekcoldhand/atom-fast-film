/**
 * lib/export/saveBlob.ts 
 *
 * For desktop saves a blob as a file via a synthetic <a download> click — NOT
 * navigator.share. Creates an object URL, clicks a temporary anchor,
 * removes it, then revokes the URL after a delay so the download can start.
 */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // Give the browser time to begin the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
