import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { forgetTitle } from '../lib/format'

/** Loads the session list and keeps it in sync after sends and deletes. */
export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.listSessions()
      setSessions(data.sessions ?? [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const remove = useCallback(async (id) => {
    setSessions((prev) => prev.filter((s) => s.session_id !== id))
    forgetTitle(id)
    try {
      await api.deleteSession(id)
    } catch {
      refresh() // put it back if the server disagreed
    }
  }, [refresh])

  return { sessions, loading, error, refresh, remove }
}
