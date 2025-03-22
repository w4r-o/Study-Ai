/**
 * Supabase server client configuration
 * 
 * Key Functions:
 * - createClient: Creates Supabase client instance
 * 
 * Integrations:
 * - Supabase
 * - Next.js cookies
 * 
 * Used By:
 * - lib/actions.ts
 * - lib/auth.ts
 * - API routes
 * 
 * Dependencies:
 * - @supabase/supabase-js
 * - next/headers
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// Create a Supabase client for use in server components and server actions
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and key must be defined")
  }

  const cookieStore = cookies()

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value
      },
    },
  })
}

