"use client"

import { createClient } from "@/lib/supabase/client"

/**
 * Authentication utilities
 * 
 * Key Functions:
 * - signUp: Creates new user account
 * - signIn: Authenticates existing user
 * - signOut: Ends user session
 * - getCurrentUser: Gets current user info
 * 
 * Integrations:
 * - Supabase Auth
 * - Supabase Database
 * 
 * Used By:
 * - components/user-auth-form.tsx
 * - lib/actions.ts
 * - app/layout.tsx
 * 
 * Dependencies:
 * - lib/supabase/client.ts
 */

class Auth {
  /**
   * Signs up a new user with email and password
   * @param email User's email
   * @param password User's password
   * @returns The user object
   */
  async signUp(email: string, password: string) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    return data.user
  }

  /**
   * Signs in a user with email and password
   * @param email User's email
   * @param password User's password
   * @returns The user object
   */
  async signIn(email: string, password: string) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    return data.user
  }

  /**
   * Signs out the current user
   */
  async signOut() {
    const supabase = createClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }
  }

  /**
   * Gets the current user
   * @returns The current user or null if not signed in
   */
  async getCurrentUser() {
    const supabase = createClient()

    const { data, error } = await supabase.auth.getUser()

    if (error) {
      return null
    }

    return data.user
  }
}

export const auth = new Auth()

export async function signUp(email: string, password: string) {
  return auth.signUp(email, password)
}

export async function signIn(email: string, password: string) {
  return auth.signIn(email, password)
}

export async function signOut() {
  return auth.signOut()
}

export async function getCurrentUser() {
  return auth.getCurrentUser()
}

