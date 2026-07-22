"use client"

/**
 * components/date-editor.tsx
 *
 * Lets the person see (and, if needed, correct) the date that gets burned
 * into the film stamp. Defaults to the photo's own EXIF capture date;
 * falls back to today when a photo has no EXIF (screenshots, re-saved/
 * downloaded images, HEIC, metadata stripped by a messaging app, etc.), and
 * either way the person can override it by hand.
 */

import { useState } from "react"
import { Calendar } from "lucide-react"

export type DateSource = "exif" | "manual" | "today"

interface DateEditorProps {
  date: Date
  source: DateSource
  onChange: (date: Date) => void
}

const SOURCE_LABEL: Record<DateSource, string> = {
  exif: "From photo",
  manual: "Custom date",
  today: "Today",
}

function toDateInputValue(date: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function fromDateInputValue(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

export function DateEditor({ date, source, onChange }: DateEditorProps) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={toDateInputValue(date)}
        onBlur={(e) => {
          const parsed = fromDateInputValue(e.target.value)
          if (parsed) onChange(parsed)
          setIsEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") setIsEditing(false)
        }}
        aria-label="Stamp date"
        className="rounded-md border border-atom-line/60 bg-atom-surface px-2 py-1 font-mono text-[11px] text-atom-text outline-none focus:border-atom-accent/60"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-atom-muted transition-colors hover:text-atom-text"
      aria-label="Edit stamp date"
    >
      <Calendar className="h-3 w-3" aria-hidden="true" />
      {SOURCE_LABEL[source]}
    </button>
  )
}
