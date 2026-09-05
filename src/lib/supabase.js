import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

console.log('Supabase URL detectada:', Boolean(supabaseUrl))
console.log('Supabase key detectada:', Boolean(supabasePublishableKey))
console.log('Supabase key length:', supabasePublishableKey?.length)

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)