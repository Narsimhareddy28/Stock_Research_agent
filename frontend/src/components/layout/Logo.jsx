export function Logo({ size = 30 }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg border border-phos-500/30 bg-phos-500/10"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-[62%] w-[62%]">
        <path
          d="M6 21.5 12.5 15l4 4L26 9.5"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-phos-400"
        />
        <path
          d="M20 9.5h6v6"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-phos-400"
        />
      </svg>
    </span>
  )
}
