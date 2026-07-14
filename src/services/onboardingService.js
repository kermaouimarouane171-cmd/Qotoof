import { USER_ROLES } from '@/modules/auth'
import { supabase } from '@/services/supabase'

const ONBOARDING_PATHS = {
  [USER_ROLES.BUYER]: '/onboarding/buyer',
  [USER_ROLES.VENDOR]: '/onboarding/vendor',
  [USER_ROLES.DRIVER]: '/onboarding/driver',
}

const POST_ONBOARDING_PATHS = {
  [USER_ROLES.BUYER]: '/marketplace',
  [USER_ROLES.VENDOR]: '/vendor/digital-contract',
  [USER_ROLES.DRIVER]: '/driver/settings',
}

export const getOnboardingPathForRole = (role) => ONBOARDING_PATHS[role] || '/'

export const getPostOnboardingPath = (role) => POST_ONBOARDING_PATHS[role] || '/'

export const checkOnboardingNeeded = async (userId, role) => {
  if (!userId || role === USER_ROLES.ADMIN) {
    return false
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed, onboarding_step')
    .eq('id', userId)
    .single()

  if (error) {
    throw error
  }

  return !data?.onboarding_completed
}

export const updateOnboardingStep = async (userId, step) => {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: step })
    .eq('id', userId)

  if (error) {
    throw error
  }
}

export const completeOnboarding = async (userId) => {
  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      onboarding_step: 100,
    })
    .eq('id', userId)

  if (error) {
    throw error
  }
}