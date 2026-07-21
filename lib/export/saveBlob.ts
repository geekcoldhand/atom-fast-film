/**
 * lib/export/saveBlob.ts
 *
 * iOS Safari does not honor the `download` attribute on blob: URLs — a
 * synthetic <a download> click just navigates the tab to the blob instead
 * of saving anything, which looks like a "blank save" even when the blob
 * itself is a perfectly good image. The fix is platform-dependent:
 *
 * - Where the Web Share API supports sharing files (iOS Safari, most
 *   mobile browsers), hand the image to the native share sheet, which has
 *   a real "Save Image" action that writes to Photos.
 * - Everywhere else (desktop browsers), fall back to the classic
 *   synthetic <a download> click.
 */
export async function saveBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type })
navigator.platform
  const canShareFile =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.maxTouchPoints > 0 &&
    navigator.canShare({ files: [file] })

  if (canShareFile) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      // The user dismissing the share sheet throws AbortError — that's a
      // deliberate cancel, not a failure, so don't also fall through to a
      // download the user didn't ask for.
      if ((err as Error)?.name === "AbortError") return
      // Any other share failure: fall through to the download path below.
    }
  }

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
