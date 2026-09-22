import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://kotdnztdioyozldwygah.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
export const isConfigured = Boolean(url && key)
export const supabase = isConfigured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null
