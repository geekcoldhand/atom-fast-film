/**
 * rendering/constants.ts  
 *
 * Every tunable magic number in one place: opacity caps, slider-to-intensity
 * factors, gradient stops, stamp geometry, colors. Nothing outside this file
 * hardcodes a visual constant. filterConfig.ts reads these; FilterStackSvg
 * renders whatever filterConfig produces.
 *
 * These are deliberately kept clear and adjustable for development (§1 layer
 * stack note): tweak values here and both the live preview and the export
 * change together, because there is only one paint path (§2).
 */

export const COLORS = {
  blueBase: "#0b2a63", 
  cyanLift: "#1aa5c9", 
  reflectionLight: "#dff3ff", 
  shadowNavy: "#04122e", 
  stampInk: "#704c2c", 
} as const

export const BASE_FILTER = {
  exposureMin: 0.78,
  exposureRange: 0.5, // brightness = min + t*range
  contrastBase: 1.0,
  contrastRange: 0.55,
  contrastSoftRange: 0.35,
  shadowLiftRange: 0.18,
  saturateBase: 0.55,
} as const

export const BLUE_BASE = {
  blend: "multiply" as const,
  opacityFactor: 0.006, // opacity = blueDepth * factor
  opacityCap: 0.6,
} as const

export const CYAN_LIFT = {
  blend: "screen" as const,
  opacityFactor: 0.007, // opacity = cyanDepth * factor
  opacityCap: 0.7,
} as const

export const REFLECTION = {
  blend: "screen" as const,
  opacityFactor: 0.008,
  opacityCap: 0.7,
  // gradient stops: light at top fading to nothing
  stops: [
    { offset: 0, opacity: 1 },
    { offset: 0.45, opacity: 0.25 },
    { offset: 1, opacity: 0 },
  ],
} as const

export const SHADOW_CONTROL = {
  blend: "multiply" as const,
  baseOpacity: 0.35, // always-on atmospheric darkening
  liftFactor: 0.0035, // shadowLift REDUCES this (lifts shadows)
  stops: [
    { offset: 0.55, opacity: 0 },
    { offset: 1, opacity: 1 },
  ],
} as const

export const GRAIN = {
  blend: "overlay" as const,
  opacityFactor: 0.009, // §1.4: opacity = grain * 0.009
  opacityCap: 0.65, // §1.4: Math.min(0.65, ...)
  tilePercent: 22, // pattern tile size as % of the box 
} as const

export const VERTICALS = {
  blend: "soft-light" as const,
  opacityFactor: 0.012,
  opacityCap: 0.85,
  lineColor: "#e8f6ff",
  stripePercent: 0.7, // one stripe cycle as % of width 
  lineFraction: 0.1, // fraction of a cycle the line occupies
} as const

export const STAMP = {
  ink: COLORS.stampInk,
  fontFamily: '"Bold Courier New", Courier, monospace',
  // font size as a fraction of the box's smaller side, clamped px
  fontSizeFactor: 0.52,
  fontSizeMin: 19,
  fontSizeMax: 62,
  gapEm: 0.7, // gap between wordmark and date
  rightPercent: 0.03, // distance from right edge (fraction of width)
  bottomPercent: 0.19, // distance from bottom edge (fraction of height)
  rotationDeg: 270, 
  wordmark: "AT0M", 
} as const


const GRAIN_TILE = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.55" intercept="0.05"/></feComponentTransfer></filter><rect width="120" height="120" filter="url(#n)"/></svg>`

export const GRAIN_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(GRAIN_TILE)}`
