/**
 * constants/controls.ts
 *
 * The UI-facing single source of truth for the control set (§4).
 * DEFAULT_CONTROLS, TABS, and per-slider min/max/step + display labels.
 *
 * This is the counterpart to rendering/constants.ts — anything the *UI*
 * needs to know about a slider lives here; anything the *paint* needs to
 * know lives in rendering/constants.ts. A control has to be registered in
 * exactly the places listed in §4.1 to exist end to end.
 */

export type ControlKey =
  | "blueDepth"
  | "cyanDepth"
  | "contrastSoft"
  | "exposure"
  | "shadowLift"
  | "midtoneContrast"
  | "grain"
  | "reflection"
  | "verticals"

export type Controls = Record<ControlKey, number>

/** §1 — the 9 kept controls (12 → 9, see §4.1). */
export const DEFAULT_CONTROLS: Controls = {
  // Color controls
  blueDepth: 5,
  cyanDepth: 41,
  contrastSoft: 0,

  // Tone controls
  exposure: 5,
  shadowLift: 50,
  midtoneContrast: 20,

  // Effects controls
  grain: 20,
  reflection: 0,
  verticals: 10,
}

/** §1 verbatim. */
export const TABS = ["Color", "Light", "Texture"] as const
export type Tab = (typeof TABS)[number]

export const CONTROL_RANGES: Record<ControlKey, { min: number; max: number; step: number }> = {
  blueDepth: { min: 0, max: 100, step: 1 },
  cyanDepth: { min: 0, max: 100, step: 1 },
  contrastSoft: { min: 0, max: 100, step: 1 },
  exposure: { min: 0, max: 100, step: 1 },
  shadowLift: { min: 0, max: 100, step: 1 },
  midtoneContrast: { min: 0, max: 100, step: 1 },
  grain: { min: 0, max: 100, step: 1 },
  reflection: { min: 0, max: 100, step: 1 },
  verticals: { min: 0, max: 100, step: 1 },
}

export const CONTROL_LABELS: Record<ControlKey, string> = {
  blueDepth: "Blue Depth",
  cyanDepth: "Cyan Depth",
  contrastSoft: "Soft Contrast",
  exposure: "Exposure",
  shadowLift: "Shadow Lift",
  midtoneContrast: "Midtone Contrast",
  grain: "Grain",
  reflection: "Reflection",
  verticals: "Verticals",
}

/** Which sliders live under which tab. */
export const TAB_CONFIG: Record<Tab, ControlKey[]> = {
  Color: ["blueDepth", "cyanDepth", "contrastSoft"],
  Light: ["exposure", "shadowLift", "midtoneContrast"],
  Texture: ["grain", "reflection", "verticals"],
}
