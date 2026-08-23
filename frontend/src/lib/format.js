/** Hostname of a URL, or null when it isn't parseable. Never throws. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Normalises the two source shapes the API can return into one. */
export function normaliseSource(source, index) {
  const url = typeof source === 'string' ? source : source?.url
  if (!url || !url.trim()) return null
  const host = hostOf(url)
  if (!host) return null
  return { id: index + 1, url, host, title: source?.title ?? host }
}

export function normaliseSources(sources) {
  if (!Array.isArray(sources)) return []
  return sources.map(normaliseSource).filter(Boolean)
}

/** URLs found in free text — the fallback when the API sends no source list. */
export function urlsIn(text) {
  return String(text ?? '').match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g) ?? []
}

const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

export function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, (Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'
  for (const [unit, size] of UNITS) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size)
      return `${n}${unit[0]}${unit === 'month' ? 'o' : ''} ago`
    }
  }
  return 'just now'
}

export function clockTime(iso) {
  const d = iso ? new Date(iso) : new Date()
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function newSessionId() {
  const rand = Math.random().toString(36).slice(2, 11)
  return `user_${Date.now()}_${rand}`
}

/**
 * Sessions have no title column, so we remember each session's opening question
 * locally and fall back to a short id.
 */
const TITLES_KEY = 'research.sessionTitles'

export function readTitles() {
  try {
    return JSON.parse(localStorage.getItem(TITLES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function rememberTitle(sessionId, title) {
  if (!sessionId || !title) return
  try {
    const all = readTitles()
    if (all[sessionId]) return
    all[sessionId] = title.slice(0, 80)
    localStorage.setItem(TITLES_KEY, JSON.stringify(all))
  } catch {
    /* storage may be unavailable — titles just fall back to the id */
  }
}

export function forgetTitle(sessionId) {
  try {
    const all = readTitles()
    delete all[sessionId]
    localStorage.setItem(TITLES_KEY, JSON.stringify(all))
  } catch {
    /* no-op */
  }
}

export function shortId(sessionId) {
  return String(sessionId ?? '').split('_').slice(-1)[0]?.slice(0, 6) ?? '—'
}
