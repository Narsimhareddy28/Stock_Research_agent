import { useEffect, useRef } from 'react'

/** The prompt input. Enter sends, Shift+Enter makes a new line. */
export function Composer({ value, onChange, onSubmit, onStop, streaming }) {
  const ref = useRef(null)

  // Grow with the content, up to a ceiling.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [value])

  const submit = (e) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div className="border-t border-line bg-void/80 px-4 py-3.5 backdrop-blur-xl sm:px-6">
      <form onSubmit={submit} className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-xl border border-line-bright bg-panel p-2 transition-colors focus-within:border-phos-500/50 focus-within:shadow-[0_0_30px_-12px_rgba(61,220,132,0.55)]">
          <span className="pb-2.5 pl-2 font-mono text-[13px] font-bold text-phos-500">&gt;</span>
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e)
            }}
            placeholder="Ask about any stock — price, outlook, comparison…"
            className="max-h-[168px] flex-1 resize-none bg-transparent py-2 text-[14.5px] text-text placeholder:text-faint focus:outline-none"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 rounded-lg border border-line-bright px-3.5 py-2 font-mono text-[12px] font-semibold text-dim transition-colors hover:border-down/50 hover:text-down"
            >
              <span className="h-2.5 w-2.5 rounded-[2px] bg-current" />
              STOP
            </button>
          ) : (
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-phos-400 px-4 py-2 font-mono text-[12px] font-bold text-void transition-all hover:bg-phos-300 hover:shadow-[0_0_24px_-6px_rgba(61,220,132,0.8)] disabled:cursor-not-allowed disabled:bg-line-bright disabled:text-faint disabled:shadow-none"
            >
              SEND
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-2 text-center font-mono text-[10px] text-faint">
          ENTER to send · SHIFT+ENTER for a new line · Not financial advice
        </p>
      </form>
    </div>
  )
}
