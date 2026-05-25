const attempts = new Map()

export function checkLoginRate(email) {
  const count = attempts.get(email) || 0
  if (count >= 5) {
    throw new Error('Rate limit exceeded')
  }
  attempts.set(email, count + 1)
}

export function clearAttempts(email) {
  attempts.delete(email)
}
