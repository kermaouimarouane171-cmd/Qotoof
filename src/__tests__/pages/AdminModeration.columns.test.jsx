import fs from 'fs'
import path from 'path'

const moderationPath = path.resolve(__dirname, '../../pages/admin/Moderation.jsx')
const moderationSource = fs.readFileSync(moderationPath, 'utf-8')

describe('Admin Moderation — does not reference ghost columns in Supabase queries', () => {
  test('does not reference action_taken in user_reports', () => {
    expect(moderationSource).not.toContain('action_taken')
  })

  test('does not reference admin_notes in user_reports', () => {
    expect(moderationSource).not.toContain('admin_notes')
  })

  test('does not reference suspension_duration_hours in user_reports', () => {
    expect(moderationSource).not.toContain('suspension_duration_hours')
  })

  test('does not reference reviewed_by or reviewed_at in user_reports', () => {
    expect(moderationSource).not.toContain('reviewed_by')
    expect(moderationSource).not.toContain('reviewed_at')
  })

  test('uses resolution_notes in user_reports updates', () => {
    expect(moderationSource).toContain('resolution_notes')
  })

  test('uses resolved_by and resolved_at in user_reports updates', () => {
    expect(moderationSource).toContain('resolved_by')
    expect(moderationSource).toContain('resolved_at')
  })

  test('still references safe core columns', () => {
    expect(moderationSource).toContain('user_reports')
    expect(moderationSource).toContain('status')
    expect(moderationSource).toContain('description')
    expect(moderationSource).toContain('evidence_urls')
    expect(moderationSource).toContain('reporter_id')
    expect(moderationSource).toContain('reported_user_id')
    expect(moderationSource).toContain('report_type')
  })
})
