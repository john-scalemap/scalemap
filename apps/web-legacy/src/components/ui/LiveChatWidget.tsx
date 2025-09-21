'use client'

import { useState, useRef, useEffect } from 'react'

import { useError } from '@/contexts/ErrorContext'

interface ChatMessage {
  id: string
  type: 'user' | 'agent' | 'system'
  message: string
  timestamp: Date
  author?: string
}

interface ChatSession {
  id: string
  status: 'waiting' | 'connected' | 'ended'
  agent?: string
  startTime: Date
}

export default function LiveChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [session, setSession] = useState<ChatSession | null>(null)
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    submitted: false
  })
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { showError, showSuccess } = useError()

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const startChat = async () => {
    if (!userInfo.name || !userInfo.email) {
      showError('Please provide your name and email to start chatting.')
      return
    }

    try {
      // In a real implementation, this would connect to a chat service
      const newSession: ChatSession = {
        id: `chat-${Date.now()}`,
        status: 'waiting',
        startTime: new Date()
      }

      setSession(newSession)
      setUserInfo(prev => ({ ...prev, submitted: true }))

      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        type: 'system',
        message: 'Thanks for contacting ScaleMap! We\'re connecting you with the next available agent...',
        timestamp: new Date()
      }

      setMessages([welcomeMessage])

      // Simulate agent connection
      setTimeout(() => {
        const agentMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          type: 'agent',
          message: `Hi ${userInfo.name}! I'm Sarah from ScaleMap support. How can I help you today?`,
          timestamp: new Date(),
          author: 'Sarah'
        }

        setMessages(prev => [...prev, agentMessage])
        setSession(prev => prev ? {
          ...prev,
          status: 'connected',
          agent: 'Sarah'
        } : null)
      }, 3000)

    } catch (error) {
      showError('Failed to start chat session. Please try again.')
    }
  }

  const sendMessage = async () => {
    if (!currentMessage.trim() || !session) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      message: currentMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setIsTyping(true)

    // Simulate agent response
    setTimeout(() => {
      const responses = [
        "Thanks for your question! Let me look into that for you.",
        "I understand your concern. Can you provide a bit more detail about the issue?",
        "That's a great question! Here's what I can tell you...",
        "I'd be happy to help you with that. Let me check our documentation.",
        "Thanks for reaching out! Is there anything specific you'd like to know about ScaleMap?"
      ]

      const randomResponse = responses[Math.floor(Math.random() * responses.length)]

      const agentMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        type: 'agent',
        message: randomResponse,
        timestamp: new Date(),
        author: session.agent
      }

      setMessages(prev => [...prev, agentMessage])
      setIsTyping(false)
    }, 2000 + Math.random() * 3000)
  }

  const endChat = () => {
    if (session) {
      const endMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        type: 'system',
        message: 'Chat session ended. Thank you for contacting ScaleMap!',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, endMessage])
      setSession(prev => prev ? { ...prev, status: 'ended' } : null)
      showSuccess('Chat session ended. We hope we were able to help!')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 z-50"
        aria-label="Open live chat"
      >
        <span className="text-xl">💬</span>
      </button>
    )
  }

  return (
    <div className={`fixed bottom-6 right-6 bg-white border border-gray-200 rounded-lg shadow-xl z-50 transition-all duration-200 ${
      isMinimized ? 'h-14' : 'h-96 w-80'
    }`}>
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span className="text-lg">💬</span>
          <div>
            <h3 className="font-semibold">Live Chat</h3>
            {session?.status === 'connected' && (
              <p className="text-xs opacity-90">Connected to {session.agent}</p>
            )}
            {session?.status === 'waiting' && (
              <p className="text-xs opacity-90">Waiting for agent...</p>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white hover:text-gray-200"
            aria-label={isMinimized ? 'Expand chat' : 'Minimize chat'}
          >
            {isMinimized ? '□' : '−'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-gray-200"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Chat Content */}
      {!isMinimized && (
        <div className="flex flex-col h-80">
          {/* User Info Form */}
          {!userInfo.submitted && (
            <div className="p-4 border-b">
              <h4 className="font-medium mb-3">Start a conversation</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Your name"
                  value={userInfo.name}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  placeholder="Your email"
                  value={userInfo.email}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={startChat}
                  disabled={!userInfo.name || !userInfo.email}
                  className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Chat
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {userInfo.submitted && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : message.type === 'agent'
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-yellow-100 text-yellow-800 text-center'
                      }`}
                    >
                      {message.author && (
                        <p className="text-xs opacity-75 mb-1">{message.author}</p>
                      )}
                      <p>{message.message}</p>
                      <p className="text-xs opacity-75 mt-1">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 px-3 py-2 rounded-lg text-sm">
                      <span className="text-gray-500">Agent is typing...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t">
                {session?.status === 'connected' && (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!currentMessage.trim()}
                      className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                )}
                {session?.status === 'connected' && (
                  <button
                    onClick={endChat}
                    className="text-red-600 text-xs mt-2 hover:text-red-700"
                  >
                    End Chat
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}