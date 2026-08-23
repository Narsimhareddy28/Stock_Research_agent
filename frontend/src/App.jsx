import { useEffect, useMemo, useState } from 'react'
import { SessionSidebar } from './components/sessions/SessionSidebar'
import { ChatPane } from './components/chat/ChatPane'
import { Composer } from './components/chat/Composer'
import { ResearchRail } from './components/research/ResearchRail'
import { useSessions } from './hooks/useSessions'
import { useResearchChat } from './hooks/useResearchChat'
import { newSessionId, readTitles, shortId } from './lib/format'

export default function App() {
  const [sessionId, setSessionId] = useState(newSessionId)
  const [input, setInput] = useState('')
  const [focusedId, setFocusedId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [titles, setTitles] = useState(readTitles)

  const { sessions, loading, refresh, remove } = useSessions()
  const { messages, streaming, hydrating, send, stop } = useResearchChat(sessionId, refresh)

  // Titles are cached as sessions are used — re-read after each exchange.
  useEffect(() => {
    setTitles(readTitles())
  }, [messages.length, sessions.length])

  // The rail follows the newest answer unless the reader pinned an older one.
  const focused = useMemo(() => {
    const answers = messages.filter((m) => m.type === 'ai')
    if (focusedId) {
      const pinned = answers.find((m) => m.id === focusedId)
      if (pinned) return pinned
    }
    return answers[answers.length - 1] ?? null
  }, [messages, focusedId])

  const submit = () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setFocusedId(null)
    send(text)
  }

  const startNew = () => {
    stop()
    setSessionId(newSessionId())
    setFocusedId(null)
    setSidebarOpen(false)
  }

  const openSession = (id) => {
    stop()
    setSessionId(id)
    setFocusedId(null)
    setSidebarOpen(false)
  }

  const deleteSession = async (id) => {
    await remove(id)
    if (id === sessionId) startNew()
  }

  return (
    <div className="relative z-10 flex h-screen overflow-hidden">
      {/* Sessions — static on desktop, drawer below lg */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SessionSidebar
          sessions={sessions}
          loading={loading}
          titles={titles}
          activeId={sessionId}
          onSelect={openSession}
          onNew={startNew}
          onDelete={deleteSession}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {(sidebarOpen || railOpen) && (
        <div
          className="fixed inset-0 z-30 bg-void/70 backdrop-blur-sm lg:hidden"
          onClick={() => {
            setSidebarOpen(false)
            setRailOpen(false)
          }}
        />
      )}

      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sessions"
            className="-ml-1 rounded-md p-2 text-faint transition-colors hover:bg-hover hover:text-text lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>

          <div className="flex min-w-0 items-center gap-2 font-mono text-[11.5px]">
            <span className="text-faint">session</span>
            <span className="truncate text-text">{titles[sessionId] ?? shortId(sessionId)}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 font-mono text-[10.5px] text-faint sm:flex">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  streaming ? 'bg-amber animate-blink' : 'bg-phos-400 shadow-[0_0_8px_rgba(61,220,132,0.9)]'
                }`}
              />
              {streaming ? 'STREAMING' : 'IDLE'}
            </span>
            <button
              onClick={() => setRailOpen(true)}
              aria-label="Open research panel"
              className="rounded-md border border-line-bright px-2.5 py-1.5 font-mono text-[10.5px] text-dim transition-colors hover:border-phos-500/40 hover:text-phos-400 xl:hidden"
            >
              RESEARCH
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <ChatPane
            messages={messages}
            hydrating={hydrating}
            focusedId={focusedId}
            onFocus={(id) => {
              setFocusedId(id)
              setRailOpen(true)
            }}
            onPickPrompt={(text) => setInput(text)}
          />
        </main>

        <Composer
          value={input}
          onChange={setInput}
          onSubmit={submit}
          onStop={stop}
          streaming={streaming}
        />
      </div>

      {/* Research rail — static on xl, drawer below */}
      <div
        className={`fixed inset-y-0 right-0 z-40 transition-transform duration-300 xl:static xl:translate-x-0 ${
          railOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <ResearchRail
          message={focused}
          streaming={streaming}
          onClose={() => setRailOpen(false)}
        />
      </div>
    </div>
  )
}
