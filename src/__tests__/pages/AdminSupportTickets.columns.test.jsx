import fs from 'fs'
import path from 'path'

const supportTicketsPath = path.resolve(__dirname, '../../pages/admin/SupportTickets.jsx')
const supportTicketsSource = fs.readFileSync(supportTicketsPath, 'utf-8')

describe('Admin SupportTickets — does not reference ghost columns in Supabase queries', () => {
  test('does not select admin_response from support_tickets', () => {
    expect(supportTicketsSource).not.toContain('admin_response')
  })

  test('selects only safe columns from support_tickets', () => {
    expect(supportTicketsSource).toContain(
      "'id, user_id, subject, description, status, priority, created_at, updated_at'"
    )
  })
})
