import { renderAnalysis } from '../../lib/markdown'
import { clockTime } from '../../lib/format'
import { StatusLine } from './StatusLine'

export function UserMessage({ message }) {
  return (
    <div className="flex animate-rise justify-end">
      <div className="max-w-[85%] rounded-xl rounded-br-sm border border-line-bright bg-raised px-4 py-2.5">
        <p className="text-[14.5px] leading-relaxed text-white">{message.content}</p>
        <p className="mt-1 text-right font-mono text-[10px] text-faint">
          {clockTime(message.timestamp)}
        </p>
      </div>
    </div>
  )
}

export function ErrorMessage({ message }) {
  return (
    <div className="flex animate-rise justify-center">
      <div className="flex max-w-md items-start gap-2.5 rounded-lg border border-down/30 bg-down/8 px-4 py-3">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-down" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-down">
            Request failed
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-text/80">{message.content}</p>
        </div>
      </div>
    </div>
  )
}

export function AssistantMessage({ message, focused, onFocus }) {
  const sourceCount = message.sources?.length ?? 0

  return (
    <div className="animate-rise">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-phos-400">
          ANALYST
        </span>
        {message.needs_search && (
          <span className="rounded border border-phos-500/30 bg-phos-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wider text-phos-400">
            LIVE DATA
          </span>
        )}
        {message.stopped && (
          <span className="rounded border border-amber/30 bg-amber/10 px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wider text-amber">
            STOPPED
          </span>
        )}
        {sourceCount > 0 && (
          <button
            onClick={onFocus}
            className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wider transition-colors ${
              focused
                ? 'border-phos-500/40 bg-phos-500/12 text-phos-300'
                : 'border-line-bright text-faint hover:border-phos-500/40 hover:text-phos-400'
            }`}
          >
            {sourceCount} SOURCE{sourceCount === 1 ? '' : 'S'}
          </button>
        )}
      </div>

      <div className="border-l-2 border-line pl-4">
        {message.status && <StatusLine status={message.status} />}

        {message.thinking && message.showThinking && (
          <details className="mb-3 rounded-lg border border-line bg-panel/60" open>
            <summary className="label cursor-pointer list-none px-3 py-2 hover:text-dim">
              ▸ Reasoning trace
            </summary>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap px-3 pb-3 font-mono text-[11.5px] leading-relaxed text-faint">
              {message.thinking}
            </p>
          </details>
        )}

        {message.content && (
          <div className="analysis">
            {renderAnalysis(message.content)}
          </div>
        )}

        {!message.content && !message.status && !message.thinking && (
          <p className="font-mono text-[12px] text-faint">No response returned.</p>
        )}
      </div>
    </div>
  )
}
