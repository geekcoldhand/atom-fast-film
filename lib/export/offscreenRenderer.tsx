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
 *
 * MOBILE SAFARI NOTE: the very first export after a fresh page load can
 * come back as a flat, empty frame (only the canvas's navy pre-fill shows),
 * and this reproduces even with grain untouched — it's not specific to any
 * one layer. The pattern (fails once, succeeds immediately after) points to
 * WebKit not having finished decoding/rasterizing the embedded photo (and,
 * for the grain layer, its nested turbulence-filter texture) by the moment
 * the outer SVG gets serialized and reloaded as a flat <img>. We mitigate
 * this two ways below: (1) explicitly decode() every embedded image before
 * ever serializing, and (2) verify the rasterized canvas actually has photo
 * content in it and transparently retry once if it doesn't, since we can't
 * fully guarantee (1) covers every WebKit timing quirk.
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

const CANVAS_PREFILL_COLOR = "#04122e"

const waitForNextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/** Loads and decodes a data: URI, resolving even if decode() isn't supported
 *  or the load fails — this is a best-effort warm-up, never a hard gate. */
function preloadAndDecode(dataUri: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const image = new Image()
    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().then(resolve).catch(() => resolve())
      } else {
        resolve()
      }
    }
    image.onerror = () => resolve()
    image.src = dataUri
  })
}

// The grain texture is a fixed constant, so its decode only needs warming
// once per page load rather than once per export.
let grainTextureReadyPromise: Promise<void> | null = null
function ensureGrainTextureDecoded(): Promise<void> {
  if (!grainTextureReadyPromise) {
    grainTextureReadyPromise = preloadAndDecode(GRAIN_DATA_URI)
  }
  return grainTextureReadyPromise
}

let exportCounter = 0

/** Renders the FilterStackSvg tree off-screen and rasterizes it into the
 *  given canvas. Returns false (without throwing) if the raster came back
 *  as an unpainted blank frame, so the caller can decide whether to retry. */
async function renderOnceToCanvas(args: RenderArgs, canvas: HTMLCanvasElement): Promise<boolean> {
  const { imgSrc, controls, width, height, dateStr } = args

  const offscreenHost = document.createElement("div")
  offscreenHost.setAttribute("aria-hidden", "true")
  offscreenHost.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:${height}px;pointer-events:none;opacity:0;`
  document.body.appendChild(offscreenHost)

  const reactRoot = createRoot(offscreenHost)

  // A fresh id suffix per attempt so overlapping/retried exports can never
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
      return false
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D context unavailable")
    // JPEG has no alpha — fill so any transparent edge is black, not garbage.
    ctx.fillStyle = CANVAS_PREFILL_COLOR
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(rasterImage, 0, 0, width, height)

    return canvasLooksPainted(ctx, width, height)
  } finally {
    reactRoot.unmount()
    offscreenHost.remove()
  }
}

/** Samples a small grid of pixels and checks whether they're all exactly
 *  the pre-fill color — i.e. drawImage effectively drew nothing. A real
 *  photo essentially never matches this dark navy across every sample
 *  point, so this is a cheap, reliable "did the export actually paint"
 *  check without needing to know anything about the photo's content. */
function canvasLooksPainted(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const prefill = hexToRgb(CANVAS_PREFILL_COLOR)
  const samplePoints: Array<[number, number]> = [
    [width * 0.1, height * 0.1],
    [width * 0.5, height * 0.5],
    [width * 0.9, height * 0.9],
    [width * 0.1, height * 0.9],
    [width * 0.9, height * 0.1],
  ]

  for (const [x, y] of samplePoints) {
    const [r, g, b] = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
    const matchesPrefill = Math.abs(r - prefill.r) <= 2 && Math.abs(g - prefill.g) <= 2 && Math.abs(b - prefill.b) <= 2
    if (!matchesPrefill) return true // found real image content
  }
  return false // every sample point was the untouched background — blank export
}

function hexToRgb(hex: string) {
  const value = parseInt(hex.slice(1), 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

/** Builds the export SVG off-screen and rasterizes it to a JPEG data URL. */
export async function renderExportDataUrl({
  imgSrc,
  controls,
  width,
  height,
  dateStr,
  quality = 0.92,
}: RenderArgs): Promise<string> {
  // Warm up decoding for both embedded raster resources before we ever
  // serialize the export SVG.
  await Promise.all([ensureGrainTextureDecoded(), preloadAndDecode(imgSrc)])

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const maxAttempts = 3
  let paintedSuccessfully = false
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    paintedSuccessfully = await renderOnceToCanvas({ imgSrc, controls, width, height, dateStr, quality }, canvas)
    if (paintedSuccessfully) break
    // Give the browser a beat to finish whatever decode work it was still
    // doing, then try the whole render again.
    await waitForNextPaint()
  }

  if (!paintedSuccessfully) {
    throw new Error("Export rendered a blank frame after multiple attempts")
  }

  return canvas.toDataURL("image/jpeg", quality)
}
