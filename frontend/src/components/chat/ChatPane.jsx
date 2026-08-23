import { useEffect, useRef } from 'react'
import { AssistantMessage, ErrorMessage, UserMessage } from './Message'
import { WelcomeScreen } from './WelcomeScreen'

export function ChatPane({ messages, hydrating, focusedId, onFocus, onPickPrompt }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (hydrating) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-raised" />
            <div className="h-3 w-full animate-pulse rounded bg-raised" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-raised" />
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) return <WelcomeScreen onPick={onPickPrompt} />

  return (
    <div className="mx-auto w-full max-w-3xl space-y-7 px-5 py-8 sm:px-6">
      {messages.map((m) =>
        m.type === 'user' ? (
          <UserMessage key={m.id} message={m} />
        ) : m.type === 'error' ? (
          <ErrorMessage key={m.id} message={m} />
        ) : (
          <AssistantMessage
            key={m.id}
            message={m}
            focused={m.id === focusedId}
            onFocus={() => onFocus(m.id)}
          />
        ),
      )}
      <div ref={endRef} />
    </div>
  )
}
