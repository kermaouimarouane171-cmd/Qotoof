import { useState, useEffect, useRef } from 'react'
import { PaperAirplaneIcon, PhoneIcon } from '@heroicons/react/24/solid'
import { messagesApi } from '@/services/favorites'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/utils/logger'

const ChatComponent = ({ deliveryId, orderId, receiverId, receiverName, receiverPhone }) => {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const subscriptionRef = useRef(null)

  useEffect(() => {
    if (!user) return

    const loadMessages = async () => {
      setLoading(true)
      try {
        let data
        if (deliveryId) {
          data = await messagesApi.getDeliveryMessages(deliveryId)
        } else if (orderId) {
          data = await messagesApi.getOrderMessages(orderId)
        }
        setMessages(data || [])
      } catch (error) {
        logger.error('Error loading messages:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMessages()

    // Subscribe to new messages
    if (deliveryId) {
      subscriptionRef.current = messagesApi.subscribeToDelivery(deliveryId, (payload) => {
        setMessages(prev => [...prev, payload.new])
        scrollToBottom()
      })
    } else if (orderId) {
      subscriptionRef.current = messagesApi.subscribeToOrder(orderId, (payload) => {
        setMessages(prev => [...prev, payload.new])
        scrollToBottom()
      })
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [user, deliveryId, orderId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || sending) return

    setSending(true)
    try {
      const message = await messagesApi.send({
        delivery_id: deliveryId || null,
        order_id: orderId || null,
        sender_id: user.id,
        receiver_id: receiverId,
        message: newMessage.trim()
      })

      setMessages(prev => [...prev, message])
      setNewMessage('')
      scrollToBottom()
    } catch (error) {
      logger.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleCall = () => {
    window.location.href = `tel:${receiverPhone}`
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-lg font-bold">
              {receiverName?.[0]}
            </span>
          </div>
          <div>
            <h3 className="font-semibold">{receiverName}</h3>
            <p className="text-xs text-green-100">Online</p>
          </div>
        </div>
        {receiverPhone && (
          <button
            onClick={handleCall}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            title="Call"
          >
            <PhoneIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50" style={{ maxHeight: '400px' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.sender_id === user?.id
            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-green-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-green-100' : 'text-gray-400'
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChatComponent
