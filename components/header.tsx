"use client"

import { Download, Loader2 } from "lucide-react"

interface HeaderProps {
  hasImage: boolean
  processing: boolean
  onSave: () => void
}

export function Header({ hasImage, processing, onSave }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-atom-line/60 px-5 py-3.5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-lg font-semibold tracking-[0.3em] text-atom-text">AT0M</span>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-atom-muted sm:inline">
          Cyanotype
        </span>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={!hasImage || processing}
        className="inline-flex items-center gap-2 rounded-full border border-atom-accent/60 bg-atom-accent/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-atom-accent transition-colors hover:bg-atom-accent/20 disabled:cursor-not-allowed disabled:border-atom-line/40 disabled:bg-transparent disabled:text-atom-muted/50"
        aria-label="Save developed image"
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        Save
      </button>
    </header>
  )
}
