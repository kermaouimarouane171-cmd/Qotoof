const readValue = (value) => (typeof value === 'string' ? value.trim() : '')

export const sentryDsnLooksIssued = (value) => /^https?:\/\/[^\s@]+@[^\s/]+\/\d+$/i.test(readValue(value))

export const supabaseUrlLooksIssued = (value) => {
  const normalized = readValue(value)

  if (!normalized) {
    return false
  }

  try {
    const url = new URL(normalized)
    return url.protocol === 'https:' && /\.supabase\.co$/i.test(url.hostname)
  } catch {
    return false
  }
}

export const supabaseAnonKeyLooksIssued = (value) => {
  const normalized = readValue(value)
  return normalized.length >= 100 && normalized.startsWith('eyJ') && !/\s/.test(normalized)
}

export const recaptchaSiteKeyLooksIssued = (value) => /^6[LP][A-Za-z0-9_-]{20,}$/u.test(readValue(value))

export const optionalClientTokenLooksIssued = (value, minimumLength = 20) => {
  const normalized = readValue(value)
  return normalized.length >= minimumLength && !/\s/.test(normalized)
}
