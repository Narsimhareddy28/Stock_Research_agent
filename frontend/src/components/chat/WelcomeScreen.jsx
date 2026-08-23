const PROMPTS = [
  { label: "What's Apple's current price?", tag: 'PRICE' },
  { label: 'Should I buy Tesla right now?', tag: 'ADVICE' },
  { label: 'Compare NVIDIA vs AMD', tag: 'COMPARE' },
  { label: "Summarise Microsoft's last earnings", tag: 'EARNINGS' },
]

export function WelcomeScreen({ onPick }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl animate-rise">
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-phos-500">
          <span className="h-1.5 w-1.5 rounded-full bg-phos-400 shadow-[0_0_8px_rgba(61,220,132,0.9)]" />
          SYSTEM READY
        </div>

        <h1 className="mt-4 text-[38px] font-bold leading-[1.08] tracking-tight text-white">
          What do you want to
          <br />
          <span className="phos">research today?</span>
          <span className="ml-1 inline-block h-[30px] w-[10px] translate-y-[3px] bg-phos-400 animate-blink" />
        </h1>

        <p className="mt-4 text-[15px] leading-relaxed text-dim">
          Live market data, pulled from the web and Wikipedia, then analysed for a
          BUY / HOLD / SELL read with sources you can check.
        </p>

        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => onPick(p.label)}
              className="group panel px-3.5 py-3 text-left transition-all hover:border-phos-500/45 hover:bg-raised"
            >
              <span className="label block text-phos-600 group-hover:text-phos-400">{p.tag}</span>
              <span className="mt-1 block text-[13.5px] leading-snug text-text">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
