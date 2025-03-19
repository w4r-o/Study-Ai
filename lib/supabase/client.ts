"use client"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Create a Supabase client for use in the browser
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and key must be defined")
  }

  return createSupabaseClient(supabaseUrl, supabaseKey)
}

