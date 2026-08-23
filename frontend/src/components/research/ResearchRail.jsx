import { clockTime } from '../../lib/format'

function Step({ label, state }) {
  const dot =
    state === 'done'
      ? 'bg-phos-400 shadow-[0_0_8px_rgba(61,220,132,0.8)]'
      : state === 'active'
        ? 'bg-amber animate-blink'
        : 'bg-line-bright'
  return (
    <li className="flex items-center gap-2.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span
        className={`font-mono text-[11px] tracking-wide ${
          state === 'idle' ? 'text-faint' : 'text-text'
        }`}
      >
        {label}
      </span>
    </li>
  )
}

function Section({ title, count, children }) {
  return (
    <div className="border-b border-line px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <p className="label">{title}</p>
        {count != null && (
          <span className="font-mono text-[10px] text-faint">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * Right pane: everything about the focused answer — pipeline state, the sources
 * it cited, and its reasoning trace. Keeps the transcript itself uncluttered.
 */
export function ResearchRail({ message, streaming, onClose }) {
  const sources = message?.sources ?? []
  const hasAnswer = Boolean(message?.content)

  const live = Boolean(message?.live)

  const steps = [
    { label: 'ROUTE QUESTION', state: message ? 'done' : 'idle' },
    {
      label: message?.needs_search ? 'FETCH LIVE DATA' : 'SEARCH (SKIPPED)',
      state: message ? 'done' : 'idle',
    },
    {
      label: 'REASON',
      state: !message ? 'idle' : message.thinking ? 'done' : message.status ? 'active' : 'done',
    },
    {
      label: 'COMPOSE ANSWER',
      state: hasAnswer && !streaming ? 'done' : streaming ? 'active' : 'idle',
    },
  ]

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-4">
        <div>
          <p className="font-mono text-[12px] font-bold tracking-[0.12em] text-white">RESEARCH</p>
          <p className="label mt-0.5">
            {message ? `Answer · ${clockTime(message.timestamp)}` : 'Awaiting query'}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close research panel"
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-hover hover:text-text xl:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title={live ? 'Pipeline' : 'Run summary'}>
          {message == null || live ? (
            <ul className="space-y-2">
              {steps.map((s) => (
                <Step key={s.label} {...s} />
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] leading-relaxed text-faint">
                Restored from history — step timings weren’t recorded.
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    message.needs_search ? 'bg-phos-400' : 'bg-line-bright'
                  }`}
                />
                <span className="font-mono text-[11px] text-text">
                  {message.needs_search ? 'USED LIVE DATA' : 'NO EXTERNAL SEARCH'}
                </span>
              </div>
            </div>
          )}
        </Section>

        <Section title="Sources" count={sources.length || null}>
          {sources.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-faint">
              {message?.needs_search === false && hasAnswer
                ? 'Answered from the model’s own knowledge — no external sources fetched.'
                : 'No sources yet.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sources.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2.5 rounded-lg border border-line bg-void/50 px-2.5 py-2 transition-colors hover:border-phos-500/40 hover:bg-raised"
                  >
                    <span className="mt-px font-mono text-[10px] font-bold text-phos-600">
                      {String(s.id).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-text group-hover:text-phos-300">
                        {s.host}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-faint">
                        {s.url.replace(/^https?:\/\//, '')}
                      </span>
                    </span>
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-3 w-3 shrink-0 text-faint group-hover:text-phos-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M7 17 17 7M8 7h9v9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {message?.thinking && (
          <Section title="Reasoning trace">
            <p className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-faint">
              {message.thinking}
            </p>
          </Section>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        <p className="font-mono text-[10px] leading-relaxed text-faint">
          Research output only. Not financial advice.
        </p>
      </div>
    </div>
  )
}
