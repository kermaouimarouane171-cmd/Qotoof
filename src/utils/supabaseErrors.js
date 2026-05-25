export const isMissingDeletedAtColumnError = (error) => {
  const message = String(error?.message || '').toLowerCase()
  return error?.code === '42703' && message.includes('deleted_at')
}
