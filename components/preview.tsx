"use client"

import { useRef, useState, type DragEvent } from "react"
import { ImagePlus } from "lucide-react"
import { FilterStackSvg } from "@/components/filter-stack-svg"
import type { Controls } from "@/lib/constants/controls"

interface PreviewProps {
  imgSrc: string | null
  size: { w: number; h: number } | null
  controls: Controls
  dateStr: string
  onFile: (file: File) => void
}

export function Preview({ imgSrc, size, controls, dateStr, onFile }: PreviewProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const pickFile = (files: FileList | null) => {
    const file = files?.[0]
    if (file && file.type.startsWith("image/")) onFile(file)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files)
  }

  return (
    <main className="flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
      {imgSrc && size ? (
        <div className="max-h-full w-full max-w-[520px] overflow-hidden rounded-lg shadow-[0_0_60px_-15px_oklch(0.74_0.13_220/0.35)] ring-1 ring-atom-line/60">
          <FilterStackSvg
            imgSrc={imgSrc}
            controls={controls}
            width={size.w}
            height={size.h}
            dateStr={dateStr}
            idSuffix="live"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex aspect-[4/5] w-full max-w-[420px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed transition-colors ${
            dragging
              ? "border-atom-accent bg-atom-accent/10"
              : "border-atom-line bg-atom-surface/40 hover:border-atom-accent/60"
          }`}
        >
          <ImagePlus className="h-10 w-10 text-atom-accent" aria-hidden="true" />
          <div className="text-center">
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-atom-text">Load image</p>
            <p className="mt-1.5 font-mono text-[11px] tracking-[0.1em] text-atom-muted">
              Tap or drop a photo to expose
            </p>
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => pickFile(e.target.files)}
      />
    </main>
  )
}
