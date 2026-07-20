"use client"

/**
 * lib/export/offscreenRenderer.tsx
 *
 * Renders the export at full resolution using the SAME <FilterStackSvg>
 * component the live preview uses — mounted off-screen at
 * naturalWidth x naturalHeight, serialized with XMLSerializer (genuine SVG,
 * NOT a foreignObject-wrapped DOM capture), and rasterized to a canvas.
 *
 * Why not foreignObject: a canvas that ever received a foreignObject-sourced
 * image is permanently tainted — toDataURL/toBlob throw SecurityError
 * regardless of CORS. Native SVG (rect/pattern/image/text, data: URIs only)
 * never triggers that rule, so this is one renderer expressed once, not a
 * second paint implementation.
 */

import { createRoot } from "react-dom/client"
import { FilterStackSvg } from "@/components/filter-stack-svg"
import { GRAIN_DATA_URI } from "@/lib/rendering/constants"
import type { Controls } from "@/lib/constants/controls"

interface RenderArgs {
  imgSrc: string // MUST be a same-origin data: URI
  controls: Controls
  width: number
  height: number
  dateStr: string
  quality?: number
}

const waitForNextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * The grain layer is a repeating SVG <pattern> whose <image> points at a
 * data: URI containing an SVG turbulence filter (GRAIN_DATA_URI). The first
 * time that data URI is rasterized, the browser has to run the turbulence
 * filter and decode the result; if that hasn't finished by the moment the
 * *outer* export SVG gets serialized and rasterized, the browser can paint
 * the outer <image> as blank rather than waiting — and since the export
 * canvas is pre-filled with the dark navy shadow color before drawImage(),
 * a blank/failed draw shows up as a flat blue-navy frame. This only shows
 * up at grain = 100 because that's the only opacity at which the pattern is
 * fully opaque enough for a failed/blank draw to be visually obvious; the
 * second export succeeds because the browser has since cached the decoded
 * texture. Decoding it explicitly, once, before we ever serialize the
 * export SVG removes the race entirely.
 */
let grainTextureReadyPromise: Promise<void> | null = null
function ensureGrainTextureDecoded(): Promise<void> {
  if (!grainTextureReadyPromise) {
    grainTextureReadyPromise = new Promise<void>((resolve) => {
      const preloadImage = new Image()
      preloadImage.onload = () => {
        // decode() confirms the browser has fully rasterized the bitmap,
        // not just fetched the bytes.
        preloadImage.decode().then(resolve).catch(() => resolve())
      }
      preloadImage.onerror = () => resolve() // don't block export on this
      preloadImage.src = GRAIN_DATA_URI
    })
  }
  return grainTextureReadyPromise
}

let exportCounter = 0

/** Builds the export SVG off-screen and rasterizes it to a JPEG data URL. */
export async function renderExportDataUrl({
  imgSrc,
  controls,
  width,
  height,
  dateStr,
  quality = 0.92,
}: RenderArgs): Promise<string> {
  await ensureGrainTextureDecoded()

  const offscreenHost = document.createElement("div")
  offscreenHost.setAttribute("aria-hidden", "true")
  offscreenHost.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:${height}px;pointer-events:none;opacity:0;`
  document.body.appendChild(offscreenHost)

  const reactRoot = createRoot(offscreenHost)

  // A fresh id suffix per export so overlapping/rapid exports can never
  // collide on <defs> ids (pattern/gradient ids must be unique per document).
  const exportIdSuffix = `export-${Date.now()}-${exportCounter++}`

  try {
    reactRoot.render(
      <FilterStackSvg
        imgSrc={imgSrc}
        controls={controls}
        width={width}
        height={height}
        dateStr={dateStr}
        idSuffix={exportIdSuffix}
      />,
    )

    // Let React commit and the stamp-measuring layout effect settle before
    // we serialize, so getComputedTextLength has already run.
    await waitForNextPaint()
    await waitForNextPaint()

    const svgElement = offscreenHost.querySelector("svg")
    if (!svgElement) throw new Error("Export SVG failed to mount")

    const serializedSvg = new XMLSerializer().serializeToString(svgElement)
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializedSvg)}`

    const rasterImage = new Image()
    rasterImage.crossOrigin = "anonymous"
    await new Promise<void>((resolve, reject) => {
      rasterImage.onload = () => resolve()
      rasterImage.onerror = () => reject(new Error("Failed to load export SVG image"))
      rasterImage.src = svgDataUrl
    })

    if (rasterImage.naturalWidth === 0 || rasterImage.naturalHeight === 0) {
      throw new Error("Export SVG rasterized to an empty image")
    }

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D context unavailable")
    // JPEG has no alpha — fill so any transparent edge is black, not garbage.
    ctx.fillStyle = "#04122e"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(rasterImage, 0, 0, width, height)

    return canvas.toDataURL("image/jpeg", quality)
  } finally {
    reactRoot.unmount()
    offscreenHost.remove()
  }
}
