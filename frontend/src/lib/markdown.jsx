/**
 * The model returns lightly-marked-up text, not full markdown. This renders the
 * subset it actually emits: headings, numbered sections, bullets, bold, inline
 * code, and links.
 */

function inline(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s<>"{}|\\^`[\]]+)/g)
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={key} href={part} target="_blank" rel="noopener noreferrer">
          {part.replace(/^https?:\/\//, '').slice(0, 42)}
        </a>
      )
    }
    return part
  })
}

export function renderAnalysis(content) {
  const lines = String(content ?? '').split('\n')

  return lines.map((line, i) => {
    const key = `l${i}`
    const trimmed = line.trim()

    if (!trimmed) return <div key={key} className="h-2" />

    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={key} className="pt-2 font-mono text-[13px] font-bold tracking-[0.1em] uppercase text-phos-400">
          {trimmed.slice(3)}
        </h2>
      )
    }

    if (trimmed.startsWith('### ')) {
      const heading = trimmed.slice(4)
      const call = heading.match(/^recommendation:\s*(buy|hold|sell)\b/i)
      if (call) {
        const verdict = call[1].toUpperCase()
        const tone = {
          BUY: 'border-up/40 bg-up/10 text-up',
          HOLD: 'border-amber/40 bg-amber/10 text-amber',
          SELL: 'border-down/40 bg-down/10 text-down',
        }[verdict]
        return (
          <div key={key} className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${tone}`}>
            <span className="font-mono text-[20px] font-bold tracking-tight">{verdict}</span>
            <span className="h-6 w-px bg-current opacity-30" />
            <span className="label !text-current opacity-80">Recommendation</span>
          </div>
        )
      }
      return (
        <h3 key={key} className="pt-2 text-[16.5px] font-bold tracking-tight text-white">
          {heading}
        </h3>
      )
    }

    // **1. Section:** — the model's numbered section headers
    const numbered = trimmed.match(/^\*\*(\d+)\.\s+([^*]+?):?\*\*$/)
    if (numbered) {
      return (
        <h3 key={key} className="flex items-baseline gap-2 pt-2">
          <span className="font-mono text-[11px] font-bold text-phos-600">
            {String(numbered[1]).padStart(2, '0')}
          </span>
          <span className="text-[15px] font-semibold text-white">{numbered[2]}</span>
        </h3>
      )
    }

    // **Section:** — plain bold header line
    const bold = trimmed.match(/^\*\*([^*]+?):?\*\*$/)
    if (bold) {
      return (
        <h4 key={key} className="pt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-dim">
          {bold[1]}
        </h4>
      )
    }

    // Bullets: "* item" or "- item"
    const bullet = trimmed.match(/^[*-]\s+(.*)$/)
    if (bullet) {
      return (
        <div key={key} className="bullet flex gap-2.5 pl-1">
          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-phos-500" />
          <span className="flex-1">{inline(bullet[1], key)}</span>
        </div>
      )
    }

    // Ordered list: "1. item"
    const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (ordered) {
      return (
        <div key={key} className="bullet flex gap-2.5 pl-1">
          <span className="mt-[1px] font-mono text-[12px] font-semibold text-phos-600">
            {ordered[1]}.
          </span>
          <span className="flex-1">{inline(ordered[2], key)}</span>
        </div>
      )
    }

    return <p key={key}>{inline(trimmed, key)}</p>
  })
}
