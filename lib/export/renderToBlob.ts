/**
 * lib/export/renderToBlob.ts
 *
 * Orchestration only — no rendering logic lives here. The actual export
 * render (native SVG, from the same rendering/filterConfig.ts values the
 * preview uses) happens in offscreenRenderer.tsx (§2.2).
 */

import { renderExportDataUrl } from "./offscreenRenderer"
import type { Controls } from "@/lib/constants/controls"

interface RenderToBlobArgs {
  imgSrc: string
  controls: Controls
  width: number
  height: number
  dateStr: string
}

/** Renders the export via the shared SVG engine and resolves with a Blob. */
export async function renderToBlob(args: RenderToBlobArgs): Promise<Blob> {
  const dataUrl = await renderExportDataUrl(args)
  const res = await fetch(dataUrl)
  return res.blob()
}
