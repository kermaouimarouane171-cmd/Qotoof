export const isMissingDeletedAtColumnError = (error) => {
  const message = String(error?.message || '').toLowerCase()
  const details = String(error?.details || '').toLowerCase()
  const hint = String(error?.hint || '').toLowerCase()
  const code = String(error?.code || error?.status || '').toLowerCase()

  const hasMissingColumnSignal =
    message.includes('column') && message.includes('deleted_at') && message.includes('does not exist')

  const mentionsDeletedAt =
    message.includes('deleted_at') || details.includes('deleted_at') || hint.includes('deleted_at')

  return hasMissingColumnSignal || (mentionsDeletedAt && code.includes('42703'))
}
