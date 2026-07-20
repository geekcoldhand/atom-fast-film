"use client"

import { useState } from "react"
import {
  CONTROL_LABELS,
  CONTROL_RANGES,
  TABS,
  TAB_CONFIG,
  type ControlKey,
  type Controls as ControlsType,
  type Tab,
} from "@/lib/constants/controls"

interface ControlsProps {
  controls: ControlsType
  onChange: (key: ControlKey, value: number) => void
}

export function Controls({ controls, onChange }: ControlsProps) {
  const [tab, setTab] = useState<Tab>(TABS[0])

  return (
    <section className="border-t border-atom-line/60 bg-atom-surface/40" aria-label="Filter controls">
      {/* Tabs */}
      <div className="flex items-stretch gap-1 px-4 pt-3" role="tablist" aria-label="Control groups">
        {TABS.map((t) => {
          const active = t === tab
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-t-md px-3 py-2 font-mono text-[11px] uppercase tracking-[0.25em] transition-colors ${
                active
                  ? "bg-atom-surface text-atom-accent"
                  : "text-atom-muted hover:text-atom-text"
              }`}
            >
              {t}
            </button>
          )
        })}
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-5 bg-atom-surface px-5 py-5">
        {TAB_CONFIG[tab].map((key) => (
          <Slider key={key} controlKey={key} value={controls[key]} onChange={onChange} />
        ))}
      </div>
    </section>
  )
}

function Slider({
  controlKey,
  value,
  onChange,
}: {
  controlKey: ControlKey
  value: number
  onChange: (key: ControlKey, value: number) => void
}) {
  const range = CONTROL_RANGES[controlKey]
  const pct = ((value - range.min) / (range.max - range.min)) * 100

  return (
    <label className="flex flex-col gap-2">
      {/* label row: name on the left, live value on the right */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-atom-text">
          {CONTROL_LABELS[controlKey]}
        </span>
        <span className="font-mono text-xs tabular-nums text-atom-accent">{value}</span>
      </div>

      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(controlKey, Number(e.target.value))}
        aria-label={CONTROL_LABELS[controlKey]}
        className="atom-range h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none"
        style={{
          background: `linear-gradient(to right, var(--atom-accent) ${pct}%, var(--atom-line) ${pct}%)`,
        }}
      />
    </label>
  )
}
