import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sessions, setSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Load messages from database for current session
  useEffect(() => {
    const loadSessionMessages = async () => {
      try {
        const response = await fetch(`http://localhost:8000/sessions/${currentSessionId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.messages && data.messages.length > 0) {
            // Convert database messages to frontend format
            const convertedMessages = data.messages.map(msg => ({
              id: msg.id,
              type: msg.type,
              content: msg.content,
              timestamp: msg.timestamp,
              sources: msg.sources && msg.sources.length > 0 ? msg.sources
                .filter(url => url && url.trim()) // Filter out empty URLs
                .map((url, i) => {
                  try {
                    return {
                      id: i + 1,
                      url: url,
                      title: new URL(url).hostname,
                      display: `Source ${i + 1}: ${new URL(url).hostname}`
                    }
                  } catch (error) {
                    console.warn('Invalid URL from database:', url)
                    return null
                  }
                })
                .filter(source => source !== null) : [], // Remove null sources
              metadata: msg.metadata
            }))
            setMessages(convertedMessages)
          }
        }
      } catch (error) {
        console.warn('Failed to load session from database:', error)
        // Fallback to localStorage if database fails
        const savedMessages = localStorage.getItem('stockChatMessages')
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages))
        }
      }
    }

    loadSessionMessages()
  }, [currentSessionId])

  // Load all sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await fetch('http://localhost:8000/sessions')
        if (response.ok) {
          const data = await response.json()
          setSessions(data.sessions || [])
        }
      } catch (error) {
        console.warn('Failed to load sessions:', error)
      }
    }

    loadSessions()
  }, [])

  // Save messages to localStorage (fallback)
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('stockChatMessages', JSON.stringify(messages))
    }
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setLoading(true)

    // Create AI message placeholder for streaming
    const aiMessageId = Date.now() + 1
    const aiMessage = {
      id: aiMessageId,
      type: 'ai',
      content: '',
      needs_search: false,
      sources: [],
      timestamp: new Date().toISOString(),
      status: 'Thinking...'
    }

    setMessages(prev => [...prev, aiMessage])

    try {
      // Graph handles conversation context automatically with MemorySaver
      const response = await fetch('http://localhost:8000/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: currentInput,
          session_id: currentSessionId  // Current session ID
          // conversation_context removed - graph handles memory automatically
        }),
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'status') {
                // Update status
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, status: data.content }
                    : msg
                ))
              } else if (data.type === 'thinking_start') {
                // Start thinking mode
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, thinking: '', status: 'Thinking...', showThinking: true }
                    : msg
                ))
              } else if (data.type === 'thinking') {
                // Append thinking content
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, thinking: (msg.thinking || '') + data.content }
                    : msg
                ))
              } else if (data.type === 'thinking_end') {
                // End thinking mode
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, status: 'Now analyzing...' }
                    : msg
                ))
              } else if (data.type === 'metadata') {
                // Update metadata
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, needs_search: data.needs_search, status: 'Generating response...' }
                    : msg
                ))
              } else if (data.type === 'content') {
                // Append content chunk
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: msg.content + data.content, status: undefined }
                    : msg
                ))
              } else if (data.type === 'complete') {
                // Mark as complete with sources
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, sources: data.sources, status: undefined }
                    : msg
                ))
              } else if (data.type === 'error') {
                throw new Error(data.content)
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError)
            }
          }
        }
      }

    } catch (err) {
      // Remove the streaming message and add error
      setMessages(prev => prev.filter(msg => msg.id !== aiMessageId))
      
      const errorMessage = {
        id: Date.now() + 2,
        type: 'error',
        content: `Error: ${err.message}`,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const formatMessage = (content) => {
    return content.split('\n').map((line, i) => {
      // Handle headers (## Header)
      if (line.startsWith('## ')) {
        return (
          <h2 key={i} className="text-xl font-bold text-blue-400 mt-4 mb-2">
            {line.replace('## ', '')}
          </h2>
        )
      }
      
      // Handle subheaders (### Header)
      if (line.startsWith('### ')) {
        return (
          <h3 key={i} className="text-lg font-semibold text-blue-300 mt-3 mb-2">
            {line.replace('### ', '')}
          </h3>
        )
      }
      
      // Handle numbered sections (**1. Section:**)
      if (line.match(/^\*\*\d+\.\s+[^*]+:\*\*$/)) {
        const text = line.replace(/^\*\*/, '').replace(/:\*\*$/, ':')
        return (
          <h3 key={i} className="text-lg font-semibold text-blue-400 mt-4 mb-2 flex items-center">
            <span className="mr-2">📊</span>
            {text}
          </h3>
        )
      }
      
      // Handle bullet points
      if (line.startsWith('* ')) {
        const text = line.substring(2)
        return (
          <div key={i} className="flex items-start ml-4 mb-1">
            <span className="text-blue-400 mr-2 mt-1">•</span>
            <span>{formatInlineMarkdown(text)}</span>
          </div>
        )
      }
      
      // Handle bold section headers (**Section:**)
      if (line.match(/^\*\*[^*]+:\*\*$/)) {
        const text = line.replace(/^\*\*/, '').replace(/:\*\*$/, ':')
        return (
          <h4 key={i} className="font-semibold text-green-400 mt-3 mb-1">
            {text}
          </h4>
        )
      }
      
      // Handle regular lines with possible inline markdown
      if (line.trim()) {
        return (
          <div key={i} className="mb-2 leading-relaxed">
            {formatInlineMarkdown(line)}
          </div>
        )
      }
      
      // Empty lines
      return <div key={i} className="mb-2"></div>
    })
  }

  const formatInlineMarkdown = (text) => {
    // Handle bold text (**text**)
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        )
      }
      return part
    })
  }

  const extractSources = (content) => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
    return content.match(urlRegex) || []
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header with Session Management */}
      <header className="px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📈</span>
            <span className="text-xl font-bold">Stock Research AI</span>
          </div>
          <div className="flex items-center space-x-4">
            {/* Session Selector */}
            <div className="flex items-center space-x-2">
              <select
                value={currentSessionId}
                onChange={(e) => {
                  setCurrentSessionId(e.target.value)
                  setMessages([]) // Clear current messages
                }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white"
              >
                <option value={currentSessionId}>Current Session</option>
                {sessions.map((session) => (
                  <option key={session.session_id} value={session.session_id}>
                    {session.session_id} ({session.message_count} messages)
                  </option>
                ))}
              </select>
            </div>
            
            <span className="text-sm text-gray-400">
              {messages.length > 0 ? `${messages.length} messages` : 'Ready'}
            </span>
            
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([])
                  localStorage.removeItem('stockChatMessages')
                }}
                className="text-sm text-gray-400 hover:text-white px-3 py-1 rounded-lg hover:bg-gray-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Messages or Welcome */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !loading ? (
            // Welcome Screen - Simple
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="max-w-2xl">
                <h1 className="text-5xl font-bold mb-4">
                  What stock do you want to research?
                </h1>
                <p className="text-xl text-gray-400 mb-8">
                  Get AI-powered analysis with live market data and investment insights.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">📊 Live Data</span>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">🤖 AI Analysis</span>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">💡 Investment Insights</span>
                </div>
              </div>
            </div>
          ) : (
            // Messages
            <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
              {messages.map((message) => (
                <div key={message.id}>
                  {message.type === 'user' ? (
                    // User Message
                    <div className="flex justify-end">
                      <div className="bg-gray-800 text-white rounded-2xl px-4 py-3 max-w-2xl">
                        {message.content}
                      </div>
                    </div>
                  ) : message.type === 'error' ? (
                    // Error Message
                    <div className="flex justify-center">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-center max-w-md">
                        ⚠️ {message.content}
                      </div>
                    </div>
                                     ) : (
                     // AI Message
                     <div className="flex justify-start">
                       <div className=" rounded-2xl px-4 py-3 max-w-4xl">
                         <div className="flex items-center space-x-2 mb-3 text-sm">
                           <span className="text-blue-400 font-regular"> Stock Research AI</span>
                           {message.needs_search && (
                             <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                               📊 Live Data
                             </span>
                           )}
                         </div>

                         {/* Show status while streaming */}
                         {message.status && (
                           <div className="flex items-center space-x-2 mb-3 text-blue-400">
                             <div className="flex space-x-1">
                               <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                               <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                               <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                             </div>
                             <span className="text-sm">{message.status}</span>
                           </div>
                         )}

                         {/* Show thinking process */}
                         {message.thinking && message.showThinking && (
                           <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                             <div className="flex items-center space-x-2 mb-2">
                               <div className="flex space-x-1">
                                 <div className="w-2 h-2 bg-blue-400/60 rounded-full animate-pulse"></div>
                                 <div className="w-2 h-2 bg-blue-400/60 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                                 <div className="w-2 h-2 bg-blue-400/60 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                               </div>
                               <span className="text-sm text-blue-400/70 font-medium">Thinking...</span>
                             </div>
                             <div className="text-gray-400/60 text-sm leading-relaxed font-mono">
                               {message.thinking}
                               <span className="inline-block w-2 h-4 bg-gray-400/60 ml-1 animate-pulse"></span>
                             </div>
                           </div>
                         )}

                         {/* Message content */}
                         {message.content && (
                           <div className="text-gray-100 leading-relaxed">
                             {formatMessage(message.content)}
                             {/* Show cursor while streaming */}
                             {message.status && !message.status.includes('complete') && (
                               <span className="inline-block w-2 h-5 bg-blue-400 ml-1 animate-pulse"></span>
                             )}
                           </div>
                         )}

                         {/* Sources */}
                         {message.sources && message.sources.length > 0 && (
                           <div className="mt-4 pt-3 border-t border-gray-700">
                             <div className="text-sm text-gray-400 mb-2">📚 Sources:</div>
                             <div className="space-y-1">
                               {message.sources.slice(0, 3).map((source, i) => {
                                 // Handle both new structured format and old string format
                                 const url = typeof source === 'string' ? source : source.url;
                                 const display = typeof source === 'string' ? new URL(url).hostname : source.display;
                                 
                                 try {
                                   return (
                                     <a
                                       key={i}
                                       href={url}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="block text-blue-400 hover:text-blue-300 text-sm truncate"
                                     >
                                       {display}
                                     </a>
                                   );
                                 } catch (error) {
                                   console.warn('Invalid URL:', url);
                                   return null;
                                 }
                               })}
                             </div>
                           </div>
                         )}

                         {/* Fallback for legacy sources format */}
                         {!message.sources && extractSources(message.content).length > 0 && (
                           <div className="mt-4 pt-3 border-t border-gray-700">
                             <div className="text-sm text-gray-400 mb-2">📚 Sources:</div>
                             <div className="space-y-1">
                               {extractSources(message.content).slice(0, 3).map((url, i) => {
                                 try {
                                   return (
                                     <a
                                       key={i}
                                       href={url}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="block text-blue-400 hover:text-blue-300 text-sm truncate"
                                     >
                                       {new URL(url).hostname}
                                     </a>
                                   );
                                 } catch (error) {
                                   console.warn('Invalid URL:', url);
                                   return null;
                                 }
                               })}
                             </div>
                           </div>
                         )}
                       </div>
                     </div>
                   )}
                </div>
              ))}

              {/* Loading - now handled by streaming status in messages */}

              <div ref={messagesEndRef} />
            </div>
          )}
      </div>

        {/* Simple Input */}
        <div className="border-t border-gray-800 px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about any stock... (e.g., 'What's Apple's current price?')"
                disabled={loading}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                {loading ? '...' : 'Send'}
        </button>
            </form>
            
            {/* Simple Tips */}
            <div className="mt-3 text-center">
              <div className="text-xs text-gray-500">
                Try: 
                <button onClick={() => setInput("What's Apple stock price?")} className="mx-1 text-blue-400 hover:text-blue-300">"Apple price"</button> • 
                <button onClick={() => setInput("Should I buy Tesla?")} className="mx-1 text-blue-400 hover:text-blue-300">"Tesla advice"</button> • 
                <button onClick={() => setInput("Compare NVIDIA vs AMD")} className="mx-1 text-blue-400 hover:text-blue-300">"Stock comparison"</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
