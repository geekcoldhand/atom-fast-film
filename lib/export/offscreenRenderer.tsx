"use client"

/**
 * lib/export/offscreenRenderer.tsx
 *
 * Renders the export directly onto a <canvas> using native Canvas 2D APIs —
 * drawImage, globalCompositeOperation (which accepts the exact same blend
 * mode names as CSS mix-blend-mode: "multiply", "screen", "overlay",
 * "soft-light"), gradients, and ctx.filter for brightness/contrast/
 * saturation. Every value comes from the same buildFilterConfig() the live
 * preview uses, so a slider's *behavior* still can't desync between preview
 * and export — only the paint API differs.
 *
 * WHY NOT REUSE THE SVG (history): the previous version of this file built
 * the export by mounting <FilterStackSvg> off-screen, serializing it with
 * XMLSerializer, and rasterizing the resulting SVG through `new Image()` +
 * drawImage — the same document containing both the base photo and the
 * grain texture as nested `<image href="data:...">` elements. On iPhone
 * Safari this reliably failed on the first export per page load: the two
 * *image* elements silently came back blank while every SVG-native
 * primitive (rects, gradients, filters, text) rendered correctly, producing
 * a plausible-looking but photo-less result — not blank enough for a
 * blank-canvas check to catch, but wrong. This is a known category of
 * WebKit bug (nested raster resources inside an SVG that's itself loaded as
 * an <img> can be dropped on first decode). Painting directly onto canvas
 * sidesteps it entirely: drawImage() on a canvas is a basic, reliable
 * operation with none of the "SVG loaded as an image containing more
 * images" indirection that triggered the bug.
 *
 * The live preview is unaffected by any of this — it still renders
 * <FilterStackSvg> directly in the DOM, which is a different, unaffected
 * code path (confirmed working, including on iPhone, after the tone-filter
 * fix in filter-stack-svg.tsx).
 */

import { buildFilterConfig } from "@/lib/rendering/filterConfig"
import { GRAIN, GRAIN_DATA_URI, STAMP, VERTICALS } from "@/lib/rendering/constants"
import type { Controls } from "@/lib/constants/controls"

interface RenderArgs {
  imgSrc: string // MUST be a same-origin data: URI
  controls: Controls
  width: number
  height: number
  dateStr: string
  quality?: number
}

/** Loads and fully decodes an image from a data: URI. */
function loadImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().then(
          () => resolve(image),
          () => resolve(image), // decode() failing isn't fatal — onload already fired
        )
      } else {
        resolve(image)
      }
    }
    image.onerror = () => reject(new Error("Failed to load image"))
    image.src = dataUri
  })
}

/**
 * The grain tile SVG (a single <filter>+<rect>, no nested <image>) is safe
 * to rasterize via the img-src route — the WebKit failure mode above is
 * specific to SVGs that themselves embed OTHER raster images. It's also a
 * fixed constant, so we only ever need to build it once per page load.
 */
let grainTileCanvasPromise: Promise<HTMLCanvasElement> | null = null
function getGrainTileCanvas(): Promise<HTMLCanvasElement> {
  if (!grainTileCanvasPromise) {
    grainTileCanvasPromise = loadImage(GRAIN_DATA_URI).then((image) => {
      const tile = document.createElement("canvas")
      tile.width = image.naturalWidth || 120
      tile.height = image.naturalHeight || 120
      const tileCtx = tile.getContext("2d")
      if (tileCtx) tileCtx.drawImage(image, 0, 0)
      return tile
    })
  }
  return grainTileCanvasPromise
}

/** Draws `image` into the target rect using cover-fit (fills the rect,
 *  cropping overflow, centered) — equivalent to preserveAspectRatio
 *  "xMidYMid slice" on an SVG <image>. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = Math.max(targetWidth / naturalWidth, targetHeight / naturalHeight)
  const drawWidth = naturalWidth * scale
  const drawHeight = naturalHeight * scale
  const drawX = targetX + (targetWidth - drawWidth) / 2
  const drawY = targetY + (targetHeight - drawHeight) / 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(targetX, targetY, targetWidth, targetHeight)
  ctx.clip()
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  ctx.restore()
}

/** Fills the whole canvas with a color/gradient under a given blend mode +
 *  opacity — the canvas equivalent of one of FilterStackSvg's <rect> layers. */
function paintLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fillStyle: string | CanvasGradient | CanvasPattern,
  blend: GlobalCompositeOperation,
  opacity: number,
) {
  if (opacity <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = blend
  ctx.globalAlpha = opacity
  ctx.fillStyle = fillStyle
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

/** Builds a CanvasGradient matching an objectBoundingBox linear gradient
 *  (top to bottom) with per-stop opacity, same shape as REFLECTION.stops. */
function buildVerticalGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
  color: string,
  stops: readonly { offset: number; opacity: number }[],
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  for (const stop of stops) {
    gradient.addColorStop(stop.offset, withAlpha(color, stop.opacity))
  }
  return gradient
}

/** Builds a CanvasGradient matching an objectBoundingBox radial gradient
 *  (cx=0.5, cy=0.5, r=0.75), same shape as SHADOW_CONTROL.stops. Uses a
 *  scaled coordinate space so the ellipse matches a non-square frame the
 *  same way SVG's objectBoundingBox radial gradients do. */
function paintRadialLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  stops: readonly { offset: number; opacity: number }[],
  blend: GlobalCompositeOperation,
  opacity: number,
) {
  if (opacity <= 0) return
  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.scale(width / 2, height / 2)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.75)
  for (const stop of stops) {
    gradient.addColorStop(stop.offset, withAlpha(color, stop.opacity))
  }
  ctx.globalCompositeOperation = blend
  ctx.globalAlpha = opacity
  ctx.fillStyle = gradient
  ctx.fillRect(-1, -1, 2, 2)
  ctx.restore()
}

function withAlpha(hexColor: string, alpha: number): string {
  const value = parseInt(hexColor.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function paintGrainLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grainTileCanvas: HTMLCanvasElement,
  tileSize: number,
  blend: GlobalCompositeOperation,
  opacity: number,
) {
  if (opacity <= 0) return
  // Scale the (fixed-resolution) grain tile canvas to the target tile size
  // via an intermediate canvas, then tile it with createPattern.
  const scaledTile = document.createElement("canvas")
  scaledTile.width = Math.max(1, Math.round(tileSize))
  scaledTile.height = Math.max(1, Math.round(tileSize))
  const scaledCtx = scaledTile.getContext("2d")
  if (!scaledCtx) return
  scaledCtx.drawImage(grainTileCanvas, 0, 0, scaledTile.width, scaledTile.height)

  const pattern = ctx.createPattern(scaledTile, "repeat")
  if (!pattern) return
  paintLayer(ctx, width, height, pattern, blend, opacity)
}

function paintVerticalsLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lineColor: string,
  blend: GlobalCompositeOperation,
  opacity: number,
) {
  if (opacity <= 0) return
  const stripeWidth = (width * VERTICALS.stripePercent) / 100
  const lineWidth = Math.max(0.5, stripeWidth * VERTICALS.lineFraction)

  const tile = document.createElement("canvas")
  tile.width = Math.max(1, Math.round(stripeWidth))
  tile.height = 1
  const tileCtx = tile.getContext("2d")
  if (!tileCtx) return
  tileCtx.fillStyle = lineColor
  tileCtx.fillRect(0, 0, lineWidth, 1)

  const pattern = ctx.createPattern(tile, "repeat")
  if (!pattern) return
  paintLayer(ctx, width, height, pattern, blend, opacity)
}

function paintStamp(ctx: CanvasRenderingContext2D, width: number, height: number, dateStr: string | undefined) {
  const dateText = dateStr ?? ""
  if (!dateText) return

  const shorterSide = Math.min(width, height)
  const fontSize = Math.min(STAMP.fontSizeMax, Math.max(STAMP.fontSizeMin, shorterSide * STAMP.fontSizeFactor))
  const gapPx = fontSize * STAMP.gapEm
  const rightX = width - width * STAMP.rightPercent
  const baselineY = height - height * STAMP.bottomPercent

  ctx.save()
  ctx.translate(rightX, baselineY)
  ctx.rotate((STAMP.rotationDeg * Math.PI) / 180)
  ctx.textAlign = "right"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = STAMP.ink

  ctx.font = `${fontSize}px ${STAMP.fontFamily}`
  const dateTextWidth = ctx.measureText(dateText).width

  ctx.font = `500 ${fontSize}px ${STAMP.fontFamily}`
  ctx.fillText(STAMP.wordmark, -dateTextWidth - gapPx, 0)

  ctx.font = `${fontSize}px ${STAMP.fontFamily}`
  ctx.fillText(dateText, 0, 0)
  ctx.restore()
}

/** Renders the export and resolves with a JPEG data URL. */
export async function renderExportDataUrl({
  imgSrc,
  controls,
  width,
  height,
  dateStr,
  quality = 0.92,
}: RenderArgs): Promise<string> {
  const config = buildFilterConfig(controls)

  const [photoImage, grainTileCanvas] = await Promise.all([loadImage(imgSrc), getGrainTileCanvas()])

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context unavailable")

  // Base photo, with brightness/contrast/saturation applied via Canvas 2D's
  // native `filter`, which (unlike CSS filter on an SVG element) has always
  // been reliable across engines including mobile Safari.
  ctx.save()
  ctx.filter = `brightness(${config.tone.brightness}) contrast(${config.tone.contrast}) saturate(${config.tone.saturate})`
  drawImageCover(ctx, photoImage, photoImage.naturalWidth, photoImage.naturalHeight, 0, 0, width, height)
  ctx.restore()

  paintLayer(ctx, width, height, config.layers.blueBase.color, config.layers.blueBase.blend as GlobalCompositeOperation, config.layers.blueBase.opacity)
  paintLayer(ctx, width, height, config.layers.cyanLift.color, config.layers.cyanLift.blend as GlobalCompositeOperation, config.layers.cyanLift.opacity)

  paintLayer(
    ctx,
    width,
    height,
    buildVerticalGradient(ctx, height, config.layers.reflection.color, config.layers.reflection.stops),
    config.layers.reflection.blend as GlobalCompositeOperation,
    config.layers.reflection.opacity,
  )

  const rawGrainTileSize = (width * GRAIN.tilePercent) / 100
  const grainTileSize = Number.isFinite(rawGrainTileSize) && rawGrainTileSize > 0 ? rawGrainTileSize : 1
  paintGrainLayer(
    ctx,
    width,
    height,
    grainTileCanvas,
    grainTileSize,
    config.layers.grain.blend as GlobalCompositeOperation,
    config.layers.grain.opacity,
  )

  paintVerticalsLayer(
    ctx,
    width,
    height,
    config.layers.verticals.lineColor,
    config.layers.verticals.blend as GlobalCompositeOperation,
    config.layers.verticals.opacity,
  )

  paintRadialLayer(
    ctx,
    width,
    height,
    config.layers.shadowControl.color,
    config.layers.shadowControl.stops,
    config.layers.shadowControl.blend as GlobalCompositeOperation,
    config.layers.shadowControl.opacity,
  )

  paintStamp(ctx, width, height, dateStr)

  return canvas.toDataURL("image/jpeg", quality)
}
