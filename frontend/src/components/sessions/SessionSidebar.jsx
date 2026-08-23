import { Logo } from '../layout/Logo'
import { relativeTime, shortId } from '../../lib/format'

/** Left pane: new-chat action plus the session history list. */
export function SessionSidebar({
  sessions,
  loading,
  titles,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
}) {
  return (
    <div className="flex h-full w-[264px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <Logo />
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] font-bold tracking-tight text-white">
            STOCK<span className="text-phos-400">/</span>RESEARCH
          </p>
          <p className="label mt-0.5">AI terminal</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close sidebar"
          className="ml-auto rounded-md p-1.5 text-faint transition-colors hover:bg-hover hover:text-text lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-phos-500/40 bg-phos-500/10 px-3 py-2.5 font-mono text-[12px] font-semibold tracking-wide text-phos-300 transition-all hover:border-phos-400 hover:bg-phos-500/20 hover:shadow-[0_0_24px_-6px_rgba(61,220,132,0.5)]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          NEW SESSION
        </button>
      </div>

      <p className="label px-4 pb-2">History</p>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="space-y-1.5 px-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[52px] animate-pulse rounded-lg bg-raised/60" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12.5px] leading-relaxed text-faint">
            No past sessions yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => {
              const active = s.session_id === activeId
              const title = titles[s.session_id]
              return (
                <li key={s.session_id} className="group relative">
                  <button
                    onClick={() => onSelect(s.session_id)}
                    className={`w-full rounded-lg px-3 py-2.5 pr-9 text-left transition-colors ${
                      active ? 'bg-phos-500/12 ring-1 ring-phos-500/25' : 'hover:bg-hover'
                    }`}
                  >
                    <span
                      className={`block truncate text-[13px] font-medium ${
                        active ? 'text-phos-300' : 'text-text'
                      }`}
                    >
                      {title ?? `Session ${shortId(s.session_id)}`}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] text-faint">
                      <span>{s.message_count} msg</span>
                      <span className="text-line-bright">·</span>
                      <span>{relativeTime(s.last_updated)}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => onDelete(s.session_id)}
                    aria-label="Delete session"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint opacity-0 transition-all hover:bg-down/15 hover:text-down focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-[10.5px] text-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-phos-400 shadow-[0_0_8px_rgba(61,220,132,0.9)]" />
          GEMINI · TAVILY · WIKI
        </div>
      </div>
    </div>
  )
}
