/**
 * rendering/constants.ts
 *
 * Every tunable number lives here: opacity caps, slider-to-intensity
 * factors, gradient stops, stamp geometry, colors. filterConfig.ts reads
 * these; FilterStackSvg renders whatever filterConfig produces. Tweak a
 * value here and both the live preview and the export change together,
 * because there is only one paint path.
 */

export const COLORS = {
  blueBase: "#0b2a63",
  cyanLift: "#7da5be",
  reflectionLight: "#dff3ff",
  shadowNavy: "#04122e",
  stampInk: "#704c2c",
} as const

/**
 * Brightness/contrast/saturation applied to the base photo via a CSS
 * `filter()` string. Every range below is multiplied by a *normalized*
 * 0-1 slider value (see `sliderToUnitInterval` in filterConfig.ts), so
 * widening a range here is all you need to do to make a slider's effect
 * more or less dramatic.
 */
export const BASE_FILTER = {
  exposureMin: 0.78,
  exposureRange: 0.65, // brightness = exposureMin + exposureUnit * exposureRange
  contrastBase: 1.0,
  contrastRange: 0.7, // + midtoneContrastUnit * contrastRange
  contrastSoftRange: 0.45, // - contrastSoftUnit * contrastSoftRange
  shadowLiftRange: 0.32, // + shadowLiftUnit * shadowLiftRange
  saturateBase: 0.55,
} as const

export const BLUE_BASE = {
  blend: "multiply" as const,
  opacityFactor: 0.6, // opacity = blueDepthUnit * opacityFactor, capped below
  opacityCap: 0.6,
} as const

export const CYAN_LIFT = {
  blend: "screen" as const,
  opacityFactor: 0.7,
  opacityCap: 0.7,
} as const

export const REFLECTION = {
  blend: "screen" as const,
  opacityFactor: 0.8,
  opacityCap: 0.7,
  // Light at the top of the frame fading to nothing.
  stops: [
    { offset: 0, opacity: 1 },
    { offset: 0.45, opacity: 0.25 },
    { offset: 1, opacity: 0 },
  ],
} as const

/**
 * Always-on atmospheric vignette. shadowLift (a "Light" tab slider) REDUCES
 * this opacity, i.e. raising shadowLift lifts/lightens the shadows.
 */
export const SHADOW_CONTROL = {
  blend: "multiply" as const,
  baseOpacity: 0.35,
  liftFactor: 0.35, // opacity = baseOpacity - shadowLiftUnit * liftFactor
  stops: [
    { offset: 0.55, opacity: 0 },
    { offset: 1, opacity: 1 },
  ],
} as const

export const GRAIN = {
  blend: "overlay" as const,
  opacityFactor: 0.9, // opacity = grainUnit * opacityFactor, capped below
  opacityCap: 0.90,
  tilePercent: 18, // pattern tile size as a % of the frame's shorter side
} as const

export const VERTICALS = {
  blend: "soft-light" as const,
  opacityFactor: 1.2,
  opacityCap: 0.75,
  lineColor: "#e8f6ff",
  stripePercent: 0.7, // one stripe cycle as a % of width
  lineFraction: 0.1, // fraction of a cycle the line itself occupies
} as const

export const STAMP = {
  ink: COLORS.stampInk,
  fontFamily: '"Bold Courier New", Courier, monospace',
  fontSizeFactor: 0.52, // fraction of the frame's shorter side
  fontSizeMin: 19,
  fontSizeMax: 62,
  gapEm: 0.7, // gap between wordmark and date, in em
  rightPercent: 0.03, // distance from the right edge, as a fraction of width
  bottomPercent: 0.19, // distance from the bottom edge, as a fraction of height
  rotationDeg: 270,
  wordmark: "AT0M",
} as const

// A single reusable film-grain tile, rendered once via an SVG turbulence
// filter and reused as a repeating pattern (see FilterStackSvg).
const GRAIN_TILE_SVG_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.55" intercept="0.05"/></feComponentTransfer></filter><rect width="120" height="120" filter="url(#n)"/></svg>`

export const GRAIN_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(GRAIN_TILE_SVG_MARKUP)}`
