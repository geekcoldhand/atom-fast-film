"use client"

/**
 * lib/export/offscreenRenderer.tsx  
 *
 * Renders the export at full resolution using the SAME <FilterStackSvg>
 * component the live preview uses — mounted off-screen at
 * naturalWidth × naturalHeight, serialized with XMLSerializer (genuine SVG,
 * NOT a foreignObject-wrapped DOM capture), and rasterized to a canvas.
 *
 * Why not foreignObject: a canvas that ever received a foreignObject-sourced
 * image is permanently tainted (§3.1) — toDataURL/toBlob throw SecurityError
 * regardless of CORS. Native SVG (rect/pattern/image/text, data: URIs only)
 * never triggers that rule, and mix-blend-mode / filter() composite through
 * the same GPU pipeline whether driven from CSS or SVG — so this is one
 * renderer expressed once, not a second paint implementation.
 */

import { createRoot } from "react-dom/client"
import { FilterStackSvg } from "@/components/filter-stack-svg"
import type { Controls } from "@/lib/constants/controls"

interface RenderArgs {
  imgSrc: string // MUST be a same-origin data: URI (§3.1)
  controls: Controls
  width: number
  height: number
  dateStr: string
  quality?: number
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/** Builds the export SVG off-screen and rasterizes it to a JPEG data URL. */
export async function renderExportDataUrl({
  imgSrc,
  controls,
  width,
  height,
  dateStr,
  quality = 0.92,
}: RenderArgs): Promise<string> {
  const host = document.createElement("div")
  host.setAttribute("aria-hidden", "true")
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:${height}px;pointer-events:none;opacity:0;`
  document.body.appendChild(host)

  const root = createRoot(host)

  try {
    root.render(
      <FilterStackSvg
        imgSrc={imgSrc}
        controls={controls}
        width={width}
        height={height}
        dateStr={dateStr}
        idSuffix="export"
      />,
    )

    // Let React commit + the stamp-measuring layout effect settle before we
    // serialize, so getComputedTextLength has run (§2.5).
    await nextFrame()
    await nextFrame()

    const svgEl = host.querySelector("svg")
    if (!svgEl) throw new Error("Export SVG failed to mount")

    const svgString = new XMLSerializer().serializeToString(svgEl)
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

    const rasterImg = new Image()
    rasterImg.crossOrigin = "anonymous"
    await new Promise<void>((resolve, reject) => {
      rasterImg.onload = () => resolve()
      rasterImg.onerror = () => reject(new Error("Failed to load export SVG image"))
      rasterImg.src = svgUrl
    })

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D context unavailable")
    // JPEG has no alpha — fill so any transparent edge is black, not garbage.
    ctx.fillStyle = "#04122e"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(rasterImg, 0, 0, width, height)

    return canvas.toDataURL("image/jpeg", quality)
  } finally {
    root.unmount()
    host.remove()
  }
}
