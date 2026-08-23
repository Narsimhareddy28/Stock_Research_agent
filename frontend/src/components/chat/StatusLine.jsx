/** The live "Thinking… / Analysing… / Writing…" indicator during a stream. */
export function StatusLine({ status }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-phos-400"
            style={{ animation: `blink 1.1s ${i * 0.18}s infinite` }}
          />
        ))}
      </div>
      <span className="font-mono text-[12px] tracking-wide text-phos-400">{status}</span>
      <span className="sweeper h-px flex-1 rounded-full" />
    </div>
  )
}
