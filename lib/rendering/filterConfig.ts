/**
 * rendering/filterConfig.ts 
 *
 * Pure function — no DOM, no React. Raw 0–100 slider values in, fully
 * resolved layer config out (opacity, color, gradient stops, blend mode).
 * This is the half of "one engine" that guarantees a slider's *behavior*
 * can never desync between preview and export: there is exactly one place
 * that turns a number into paint parameters, and both call it.
 */

import {
  BASE_FILTER,
  BLUE_BASE,
  COLORS,
  CYAN_LIFT,
  GRAIN,
  REFLECTION,
  SHADOW_CONTROL,
  VERTICALS,
} from "./constants"
import type { Controls } from "@/lib/constants/controls"

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const t = (v: number) => clamp01((v || 0) / 100) // slider 0–100 → 0–1

export interface GradientStop {
  offset: number
  opacity: number
}

export interface SolidLayer {
  color: string
  opacity: number
  blend: string
}

export interface GradientLayer {
  color: string
  opacity: number
  blend: string
  stops: GradientStop[]
}

export interface FilterConfig {
  /** CSS filter string applied to the base <image>. */
  baseFilter: string
  layers: {
    blueBase: SolidLayer
    cyanLift: SolidLayer
    reflection: GradientLayer
    grain: { opacity: number; blend: string }
    verticals: { opacity: number; blend: string; lineColor: string }
    shadowControl: GradientLayer
  }
}

export function buildFilterConfig(controls: Controls): FilterConfig {
  const exposure = t(controls.exposure)
  const midtoneContrast = t(controls.midtoneContrast)
  const contrastSoft = t(controls.contrastSoft)
  const shadowLift = t(controls.shadowLift)

  const brightness =
    BASE_FILTER.exposureMin +
    exposure * BASE_FILTER.exposureRange +
    shadowLift * BASE_FILTER.shadowLiftRange
  const contrast =
    BASE_FILTER.contrastBase +
    midtoneContrast * BASE_FILTER.contrastRange -
    contrastSoft * BASE_FILTER.contrastSoftRange
  const saturate = BASE_FILTER.saturateBase

  const baseFilter = `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(
    3,
  )}) saturate(${saturate.toFixed(3)})`

  return {
    baseFilter,
    layers: {
      blueBase: {
        color: COLORS.blueBase,
        blend: BLUE_BASE.blend,
        opacity: Math.min(BLUE_BASE.opacityCap, (controls.blueDepth || 0) * BLUE_BASE.opacityFactor),
      },
      cyanLift: {
        color: COLORS.cyanLift,
        blend: CYAN_LIFT.blend,
        opacity: Math.min(CYAN_LIFT.opacityCap, (controls.cyanDepth || 0) * CYAN_LIFT.opacityFactor),
      },
      reflection: {
        color: COLORS.reflectionLight,
        blend: REFLECTION.blend,
        opacity: Math.min(
          REFLECTION.opacityCap,
          (controls.reflection || 0) * REFLECTION.opacityFactor,
        ),
        stops: REFLECTION.stops.map((s) => ({ ...s })),
      },
      grain: {
        blend: GRAIN.blend,
        // §1.4: Math.min(0.65, grain * 0.009)
        opacity: Math.min(GRAIN.opacityCap, (controls.grain || 0) * GRAIN.opacityFactor),
      },
      verticals: {
        blend: VERTICALS.blend,
        lineColor: VERTICALS.lineColor,
        opacity: Math.min(
          VERTICALS.opacityCap,
          (controls.verticals || 0) * VERTICALS.opacityFactor,
        ),
      },
      shadowControl: {
        color: COLORS.shadowNavy,
        blend: SHADOW_CONTROL.blend,
        // shadowLift REDUCES the vignette (lifts the shadows)
        opacity: Math.max(
          0,
          SHADOW_CONTROL.baseOpacity - (controls.shadowLift || 0) * SHADOW_CONTROL.liftFactor,
        ),
        stops: SHADOW_CONTROL.stops.map((s) => ({ ...s })),
      },
    },
  }
}
