/**
 * rendering/stampLayout.ts
 *
 * Computes the film-stamp's font size and anchor position for a given
 * frame size. Used by both FilterStackSvg (live preview) and
 * offscreenRenderer (export) so the two can never disagree, and so the
 * stamp reads consistently across very different image dimensions instead
 * of just using whatever fixed pixel size happened to be tuned against one
 * test photo.
 *
 * Previously the stamp's font size was `shorterSide * 0.52`, clamped to a
 * 19-62px range. Because 0.52 * shorterSide blows past 62 for anything
 * wider than ~120px, that meant almost every real photo — regardless of
 * whether it was 800px or 8000px on its short side — got the exact same
 * fixed 62px stamp. A fixed pixel size looks proportionally huge on a
 * small image and proportionally tiny on a large one, which is the
 * "inconsistent" look. On top of that, the margins (`rightPercent`/
 * `bottomPercent` of width/height) had no relationship to the stamp's own
 * text length, so on a small or unusually-shaped frame the fixed-size text
 * could run past the top edge entirely.
 *
 * The fix: pick a font size as a modest fraction of the shorter side
 * (so it visibly scales across the realistic size range before hitting
 * either clamp), express the margins as multiples of that font size rather
 * than of the frame (so the stamp always sits a "consistent number of its
 * own characters" from the edge), and explicitly check whether the
 * wordmark + date will fit in the available run before finalizing the
 * size — shrinking it if not, rather than letting it run off-frame.
 */

import { STAMP } from "./constants"

export interface StampLayout {
  fontSize: number
  gapPx: number
  rightX: number
  baselineY: number
}

/** Rough monospace width estimate — good enough for a shrink-to-fit check;
 *  exact glyph metrics aren't necessary here, just a consistent estimate
 *  that both the SVG preview and canvas export agree on. */
function estimateMonospaceTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function computeStampLayout(width: number, height: number, dateText: string): StampLayout {
  const shorterSide = Math.min(width, height)
  let fontSize = clamp(shorterSide * STAMP.fontSizeFactor, STAMP.fontSizeMin, STAMP.fontSizeMax)

  // After the 270° rotation, the wordmark + gap + date run vertically up
  // the frame from the bottom-right anchor. Make sure that run always fits
  // between the bottom margin and a safety line near the top, shrinking the
  // font (down to fontSizeMin) if it wouldn't.
  const estimateRunLength = () =>
    estimateMonospaceTextWidth(STAMP.wordmark, fontSize) + fontSize * STAMP.gapEm + estimateMonospaceTextWidth(dateText, fontSize)

  const topSafety = height * STAMP.topSafetyPercent
  let availableRun = Math.max(0, height - fontSize * STAMP.marginBottomEm - topSafety)
  let runLength = estimateRunLength()

  if (runLength > availableRun && availableRun > 0) {
    // Shrink proportionally, then re-check once — the margin itself shrinks
    // along with the font, so a single conservative pass (with a small
    // safety buffer) is enough without an iterative solve.
    const shrinkFactor = (availableRun / runLength) * 0.96
    fontSize = Math.max(STAMP.fontSizeMin, fontSize * shrinkFactor)
    availableRun = Math.max(0, height - fontSize * STAMP.marginBottomEm - topSafety)
    runLength = estimateRunLength()
  }

  const gapPx = fontSize * STAMP.gapEm
  const marginRight = fontSize * STAMP.marginRightEm
  const marginBottom = fontSize * STAMP.marginBottomEm

  // Final defensive clamp: never let the anchor itself land outside the
  // frame, regardless of how extreme the input dimensions are.
  const rightX = clamp(width - marginRight, 0, width)
  const baselineY = clamp(height - marginBottom, 0, height)

  return { fontSize, gapPx, rightX, baselineY }
}
