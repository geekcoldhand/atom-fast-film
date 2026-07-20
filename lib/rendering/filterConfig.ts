/**
 * rendering/filterConfig.ts
 *
 * Pure function — no DOM, no React. Raw 0-100 slider values in, fully
 * resolved layer config out (opacity, color, gradient stops, blend mode).
 * This is the half of "one engine" that guarantees a slider's *behavior*
 * can never desync between preview and export: there is exactly one place
 * that turns a number into paint parameters, and both call it.
 *
 * Every slider is normalized to 0-1 through `sliderToUnitInterval` before
 * it touches any paint math below. Previously the "Light" tab sliders were
 * normalized this way while the "Color"/"Texture" layer opacities and the
 * shadow-lift vignette multiplied the raw 0-100 value by a tiny factor
 * directly — two different scales for what should be one concept. That
 * split made it easy for a slider's effect to end up far smaller than
 * intended. Everything now goes through the same 0-1 stage.
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

/** Normalizes a raw 0-100 slider value to a clamped 0-1 unit interval. */
function sliderToUnitInterval(rawSliderValue: number): number {
  const unclamped = (rawSliderValue || 0) / 100
  return Math.max(0, Math.min(1, unclamped))
}

/** unit (0-1) * intensityFactor, clamped to opacityCap. */
function unitToCappedOpacity(unitValue: number, intensityFactor: number, opacityCap: number): number {
  return Math.min(opacityCap, unitValue * intensityFactor)
}

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
  const exposureUnit = sliderToUnitInterval(controls.exposure)
  const midtoneContrastUnit = sliderToUnitInterval(controls.midtoneContrast)
  const contrastSoftUnit = sliderToUnitInterval(controls.contrastSoft)
  const shadowLiftUnit = sliderToUnitInterval(controls.shadowLift)
  const blueDepthUnit = sliderToUnitInterval(controls.blueDepth)
  const cyanDepthUnit = sliderToUnitInterval(controls.cyanDepth)
  const reflectionUnit = sliderToUnitInterval(controls.reflection)
  const grainUnit = sliderToUnitInterval(controls.grain)
  const verticalsUnit = sliderToUnitInterval(controls.verticals)

  const brightness =
    BASE_FILTER.exposureMin +
    exposureUnit * BASE_FILTER.exposureRange +
    shadowLiftUnit * BASE_FILTER.shadowLiftRange
  const contrast =
    BASE_FILTER.contrastBase +
    midtoneContrastUnit * BASE_FILTER.contrastRange -
    contrastSoftUnit * BASE_FILTER.contrastSoftRange
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
        opacity: unitToCappedOpacity(blueDepthUnit, BLUE_BASE.opacityFactor, BLUE_BASE.opacityCap),
      },
      cyanLift: {
        color: COLORS.cyanLift,
        blend: CYAN_LIFT.blend,
        opacity: unitToCappedOpacity(cyanDepthUnit, CYAN_LIFT.opacityFactor, CYAN_LIFT.opacityCap),
      },
      reflection: {
        color: COLORS.reflectionLight,
        blend: REFLECTION.blend,
        opacity: unitToCappedOpacity(reflectionUnit, REFLECTION.opacityFactor, REFLECTION.opacityCap),
        stops: REFLECTION.stops.map((s) => ({ ...s })),
      },
      grain: {
        blend: GRAIN.blend,
        opacity: unitToCappedOpacity(grainUnit, GRAIN.opacityFactor, GRAIN.opacityCap),
      },
      verticals: {
        blend: VERTICALS.blend,
        lineColor: VERTICALS.lineColor,
        opacity: unitToCappedOpacity(verticalsUnit, VERTICALS.opacityFactor, VERTICALS.opacityCap),
      },
      shadowControl: {
        color: COLORS.shadowNavy,
        blend: SHADOW_CONTROL.blend,
        // shadowLift REDUCES the vignette (lifts the shadows).
        opacity: Math.max(0, SHADOW_CONTROL.baseOpacity - shadowLiftUnit * SHADOW_CONTROL.liftFactor),
        stops: SHADOW_CONTROL.stops.map((s) => ({ ...s })),
      },
    },
  }
}
