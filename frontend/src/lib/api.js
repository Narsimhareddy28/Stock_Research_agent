// Single place that knows where the backend lives.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function json(path, options) {
  const res = await fetch(`${API_URL}${path}`, options)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  listSessions: () => json('/sessions'),
  getSession: (id) => json(`/sessions/${id}`),
  deleteSession: (id) => json(`/sessions/${id}`, { method: 'DELETE' }),

  /** POSTs a question and returns the streaming Response for SSE parsing. */
  analyze: (question, sessionId, signal) =>
    fetch(`${API_URL}/analyze/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id: sessionId }),
      signal,
    }),
}
