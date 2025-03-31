/**
 * Server-side authentication utilities
 */

import { createClient } from "@/lib/supabase/server"

/**
 * Gets the current user on the server side
 * @returns The current user or null if not signed in
 */
export async function getCurrentUser() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error("Auth error:", error.message)
      return null
    }
    
    return data.user
  } catch (error) {
    console.error("Error in getCurrentUser:", error)
    return null
  }
} 