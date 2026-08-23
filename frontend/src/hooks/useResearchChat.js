import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { normaliseSources, rememberTitle } from '../lib/format'

/**
 * Owns the message list for one session: hydrates from the API and consumes the
 * SSE stream from /analyze/stream.
 */
export function useResearchChat(sessionId, onSent) {
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const abortRef = useRef(null)

  // Load history whenever the active session changes.
  useEffect(() => {
    let cancelled = false
    setMessages([])
    setHydrating(true)

    api
      .getSession(sessionId)
      .then((data) => {
        if (cancelled) return
        const loaded = (data.messages ?? []).map((m) => ({
          id: m.id,
          type: m.type,
          content: m.content,
          timestamp: m.timestamp,
          sources: normaliseSources(m.sources),
          needs_search: Boolean(m.metadata?.needs_search),
          metadata: m.metadata,
        }))
        setMessages(loaded)
      })
      .catch(() => {
        if (!cancelled) setMessages([])
      })
      .finally(() => {
        if (!cancelled) setHydrating(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Abort any in-flight stream when the session changes or we unmount.
  useEffect(() => () => abortRef.current?.abort(), [sessionId])

  const patch = useCallback((id, changes) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)))
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }, [])

  const send = useCallback(
    async (question) => {
      const text = question.trim()
      if (!text || streaming) return

      rememberTitle(sessionId, text)

      const userId = Date.now()
      const aiId = userId + 1

      setMessages((prev) => [
        ...prev,
        { id: userId, type: 'user', content: text, timestamp: new Date().toISOString() },
        {
          id: aiId,
          type: 'ai',
          content: '',
          thinking: '',
          sources: [],
          needs_search: false,
          status: 'Thinking…',
          live: true,
          timestamp: new Date().toISOString(),
        },
      ])

      const controller = new AbortController()
      abortRef.current = controller
      setStreaming(true)

      try {
        const res = await api.analyze(text, sessionId, controller.signal)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Chunks can split mid-event, so keep the tail until the next newline.
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            let event
            try {
              event = JSON.parse(line.slice(6))
            } catch {
              continue
            }

            switch (event.type) {
              case 'status':
                patch(aiId, { status: event.content })
                break
              case 'thinking_start':
                patch(aiId, { thinking: '', status: 'Thinking…', showThinking: true })
                break
              case 'thinking':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiId ? { ...m, thinking: (m.thinking ?? '') + event.content } : m,
                  ),
                )
                break
              case 'thinking_end':
                patch(aiId, { status: 'Analysing…' })
                break
              case 'metadata':
                patch(aiId, { needs_search: event.needs_search, status: 'Writing…' })
                break
              case 'content':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiId ? { ...m, content: m.content + event.content, status: null } : m,
                  ),
                )
                break
              case 'complete':
                patch(aiId, { sources: normaliseSources(event.sources), status: null })
                break
              case 'error':
                throw new Error(event.content)
              default:
                break
            }
          }
        }
        onSent?.()
      } catch (err) {
        if (err.name === 'AbortError') {
          patch(aiId, { status: null, stopped: true })
        } else {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== aiId),
            {
              id: Date.now() + 2,
              type: 'error',
              content: err.message,
              timestamp: new Date().toISOString(),
            },
          ])
        }
      } finally {
        abortRef.current = null
        setStreaming(false)
      }
    },
    [sessionId, streaming, patch, onSent],
  )

  return { messages, streaming, hydrating, send, stop }
}
