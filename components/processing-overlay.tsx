export function ProcessingOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-atom-bg/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-atom-line border-t-atom-accent" />
      <p className="font-mono text-xs uppercase tracking-[0.35em] text-atom-muted">Developing</p>
    </div>
  )
}
