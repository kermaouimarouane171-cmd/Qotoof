const SUPABASE_ERROR_MAP = [
  {
    pattern: /invalid login credentials/i,
    message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  },
  {
    pattern: /email not confirmed|not confirmed/i,
    message: 'يرجى تأكيد البريد الإلكتروني أولاً',
  },
  {
    pattern: /user already registered|already registered|already exists/i,
    message: 'هذا البريد الإلكتروني مسجل مسبقًا',
  },
  {
    pattern: /password should be at least|password is too weak|weak password/i,
    message: 'كلمة المرور ضعيفة، استخدم 8 أحرف على الأقل',
  },
  {
    pattern: /rate limit|too many requests|too many/i,
    message: 'تم تجاوز عدد المحاولات، يرجى المحاولة لاحقًا',
  },
  {
    pattern: /network|failed to fetch|fetch error/i,
    message: 'تعذر الاتصال بالخادم، تحقق من الشبكة',
  },
]

export const formatSupabaseError = (error, fallback = 'حدث خطأ غير متوقع، حاول مرة أخرى') => {
  const rawMessage = String(error?.message || error || '').trim()

  if (!rawMessage) return fallback

  const match = SUPABASE_ERROR_MAP.find((entry) => entry.pattern.test(rawMessage))
  return match?.message || fallback
}

export default formatSupabaseError
