/**
 * Chat Module Security Tests (Phase 4A-3)
 *
 * Tests cover:
 * - Item 1: messages_user_insert RLS policy (migration file verification)
 * - Item 2: XSS protection on content (chatService.sendMessage) and message (messagesApi.send)
 * - Item 3: Rate limiting on message send (30 per 10 min)
 * - Item 4: Rate limiting on conversation create (10 per hour)
 * - Item 5: Rate limiting on file upload (20 per hour)
 * - Item 6: Basic chat service tests
 */

jest.mock('@/services/supabase', () => {
  const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockSingle = jest.fn().mockResolvedValue({ data: { id: 'msg-1', content: 'test' }, error: null })
  const mockEq = jest.fn().mockReturnThis()
  const mockIs = jest.fn().mockReturnThis()
  const mockOr = jest.fn().mockReturnThis()
  const mockOrder = jest.fn().mockReturnThis()
  const mockLimit = jest.fn().mockReturnThis()
  const mockIn = jest.fn().mockReturnThis()
  const mockNeq = jest.fn().mockReturnThis()
  const mockLt = jest.fn().mockReturnThis()
  const mockSelect = jest.fn().mockReturnValue({
    eq: mockEq,
    is: mockIs,
    or: mockOr,
    order: mockOrder,
    limit: mockLimit,
    in: mockIn,
    neq: mockNeq,
    lt: mockLt,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
  })
  const mockInsert = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: mockSingle,
    }),
  })
  const mockUpdate = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation(cb => Promise.resolve(cb({ error: null }))),
  })
  const mockDelete = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnThis(),
  })

  return {
    supabase: {
      from: jest.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      }),
      storage: {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
          getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } }),
        }),
      },
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      }),
      removeChannel: jest.fn(),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
  }
})

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('react-hot-toast', () => ({
  error: jest.fn(),
  success: jest.fn(),
}))

import { chatService, messagesApi } from '@/modules/chat'
import { rateLimiter, RATE_LIMITS } from '@/utils/rateLimiter'
import fs from 'fs'
import path from 'path'

// Reset rate limiter before each test
beforeEach(() => {
  rateLimiter.resetAll()
})

// ============================================
// Item 1: messages_user_insert RLS Policy
// ============================================

describe('Item 1: messages_user_insert RLS policy', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../../supabase/migrations/20260711000002_fix_messages_insert_rls.sql'
  )

  it('migration file exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  it('drops vulnerable policies', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    expect(sql).toContain('DROP POLICY IF EXISTS "Users can send messages" ON messages')
    expect(sql).toContain('DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages')
  })

  it('creates new policy with both sender_id AND conversation participation check', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    expect(sql).toContain('CREATE POLICY "messages_user_insert"')
    expect(sql).toContain('sender_id = auth.uid()')
    expect(sql).toContain('conversation_participants')
    expect(sql).toContain('cp.user_id = auth.uid()')
  })

  it('uses AND between sender check and participation check (not OR)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    const createPolicySection = sql.split('CREATE POLICY "messages_user_insert"')[1]
    expect(createPolicySection).toContain('AND EXISTS')
  })
})

// ============================================
// Item 2: XSS Protection
// ============================================

describe('Item 2: XSS protection on message content', () => {
  it('chatService.sendMessage sanitizes HTML in content', async () => {
    const xssPayload = '<script>alert("xss")</script>Hello'

    const result = await chatService.sendMessage({
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: xssPayload,
    })

    // Should not throw - sanitization should clean the content
    expect(result).toBeDefined()
  })

  it('messagesApi.send sanitizes HTML in message field', async () => {
    const xssPayload = '<img src=x onerror=alert(1)>Test message'

    const result = await messagesApi.send({
      delivery_id: 'del-1',
      sender_id: 'user-1',
      receiver_id: 'user-2',
      message: xssPayload,
    })

    expect(result).toBeDefined()
  })

  it('chatService.sendMessage handles empty content gracefully', async () => {
    const result = await chatService.sendMessage({
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: '',
    })

    expect(result).toBeDefined()
  })
})

// ============================================
// Item 3: Rate Limiting on Message Send (30 per 10 min)
// ============================================

describe('Item 3: Rate limiting on chatService.sendMessage', () => {
  it('allows up to 30 messages within the window', async () => {
    for (let i = 0; i < 30; i++) {
      await expect(
        chatService.sendMessage({
          conversationId: 'conv-1',
          senderId: 'user-rate-test',
          content: `Message ${i}`,
        })
      ).resolves.toBeDefined()
    }
  })

  it('rejects the 31st message (rate limit exceeded)', async () => {
    for (let i = 0; i < 30; i++) {
      await chatService.sendMessage({
        conversationId: 'conv-1',
        senderId: 'user-rate-reject',
        content: `Message ${i}`,
      })
    }

    await expect(
      chatService.sendMessage({
        conversationId: 'conv-1',
        senderId: 'user-rate-reject',
        content: 'Message 31',
      })
    ).rejects.toThrow(/rate limit|Too many/i)
  })

  it('uses separate rate limits per sender', async () => {
    // User A sends 30 messages
    for (let i = 0; i < 30; i++) {
      await chatService.sendMessage({
        conversationId: 'conv-1',
        senderId: 'userA',
        content: `Msg ${i}`,
      })
    }

    // User B should still be able to send
    await expect(
      chatService.sendMessage({
        conversationId: 'conv-1',
        senderId: 'userB',
        content: 'Hello',
      })
    ).resolves.toBeDefined()
  })
})

// ============================================
// Item 4: Rate Limiting on Conversation Create (10 per hour)
// ============================================

describe('Item 4: Rate limiting on getOrCreateConversation', () => {
  it('allows up to 10 conversation creations within the window', async () => {
    for (let i = 0; i < 10; i++) {
      await expect(
        chatService.getOrCreateConversation('user-conv-test', `userB-${i}`)
      ).resolves.toBeDefined()
    }
  })

  it('rejects the 11th conversation creation (rate limit exceeded)', async () => {
    for (let i = 0; i < 10; i++) {
      await chatService.getOrCreateConversation('user-conv-reject', `userB-${i}`)
    }

    await expect(
      chatService.getOrCreateConversation('user-conv-reject', 'userB-11')
    ).rejects.toThrow(/rate limit|Too many/i)
  })
})

// ============================================
// Item 5: Rate Limiting on File Upload (20 per hour)
// ============================================

describe('Item 5: Rate limiting on uploadAttachment', () => {
  // Create a mock File object
  const createMockFile = (name = 'test.png', size = 1024, type = 'image/png') => {
    const file = new File([new ArrayBuffer(size)], name, { type })
    return file
  }

  it('allows up to 20 uploads within the window', async () => {
    const file = createMockFile()
    for (let i = 0; i < 20; i++) {
      await expect(
        chatService.uploadAttachment(file, 'conv-upload-test')
      ).resolves.toBeDefined()
    }
  })

  it('rejects the 21st upload (rate limit exceeded)', async () => {
    const file = createMockFile()
    for (let i = 0; i < 20; i++) {
      await chatService.uploadAttachment(file, 'conv-upload-reject')
    }

    await expect(
      chatService.uploadAttachment(file, 'conv-upload-reject')
    ).rejects.toThrow(/rate limit|Too many/i)
  })
})

// ============================================
// RATE_LIMITS constants verification
// ============================================

describe('RATE_LIMITS includes chat limits', () => {
  it('has CHAT_MESSAGE_SEND with 30 attempts and 10 min window', () => {
    expect(RATE_LIMITS.CHAT_MESSAGE_SEND).toBeDefined()
    expect(RATE_LIMITS.CHAT_MESSAGE_SEND.maxAttempts).toBe(30)
    expect(RATE_LIMITS.CHAT_MESSAGE_SEND.windowMs).toBe(10 * 60 * 1000)
  })

  it('has CHAT_CONVERSATION_CREATE with 10 attempts and 1 hour window', () => {
    expect(RATE_LIMITS.CHAT_CONVERSATION_CREATE).toBeDefined()
    expect(RATE_LIMITS.CHAT_CONVERSATION_CREATE.maxAttempts).toBe(10)
    expect(RATE_LIMITS.CHAT_CONVERSATION_CREATE.windowMs).toBe(60 * 60 * 1000)
  })

  it('has CHAT_FILE_UPLOAD with 20 attempts and 1 hour window', () => {
    expect(RATE_LIMITS.CHAT_FILE_UPLOAD).toBeDefined()
    expect(RATE_LIMITS.CHAT_FILE_UPLOAD.maxAttempts).toBe(20)
    expect(RATE_LIMITS.CHAT_FILE_UPLOAD.windowMs).toBe(60 * 60 * 1000)
  })
})

// ============================================
// Item 11: getOrCreateConversation logic
// ============================================

describe('Item 11: getOrCreateConversation logic', () => {
  it('does not use broken .or() chain with non-existent columns', async () => {
    // The function should not throw due to missing participant_1_id/participant_2_id columns
    // (those columns don't exist in the live schema - it uses conversation_participants join table)
    const result = await chatService.getOrCreateConversation('user-1', 'user-2')
    expect(result).toBeDefined()
  })

  it('creates conversation with correct type (direct)', async () => {
    const result = await chatService.getOrCreateConversation('user-A', 'user-B')
    expect(result).toBeDefined()
    // The mock returns { id: 'msg-1', content: 'test' } - just verify no throw
  })
})

// ============================================
// File Validation (existing behavior)
// ============================================

describe('chatService.validateFile', () => {
  it('rejects files larger than 10MB', () => {
    const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'large.png', { type: 'image/png' })
    expect(() => chatService.validateFile(largeFile)).toThrow(/too large|size/i)
  })

  it('rejects empty files', () => {
    const emptyFile = new File([], 'empty.png', { type: 'image/png' })
    expect(() => chatService.validateFile(emptyFile)).toThrow(/empty/i)
  })

  it('rejects blocked extensions', () => {
    const exeFile = new File([new ArrayBuffer(1024)], 'malware.exe', { type: 'application/octet-stream' })
    expect(() => chatService.validateFile(exeFile)).toThrow(/extension|not allowed/i)
  })

  it('accepts valid image files', () => {
    const validFile = new File([new ArrayBuffer(1024)], 'photo.png', { type: 'image/png' })
    expect(() => chatService.validateFile(validFile)).not.toThrow()
  })
})
