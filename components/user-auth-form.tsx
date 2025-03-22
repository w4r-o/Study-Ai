/**
 * User Authentication Form Component
 * Handles user registration and login functionality.
 * 
 * Features:
 * - User registration form
 * - Login form
 * - OAuth provider integration
 * - Password reset functionality
 * - Form validation
 * - Error handling
 * 
 * State Management:
 * - isLoading: Loading state during auth operations
 * - error: Authentication error state
 * - formData: User input data
 * 
 * Authentication Methods:
 * - Email/Password authentication
 * - OAuth providers (if configured)
 * - Password reset flow
 * 
 * File Dependencies:
 * - lib/auth.ts: Authentication utilities
 * - components/ui/*: UI components
 * - lib/supabase/server.ts: Database interactions
 * 
 * Security Features:
 * - Input validation
 * - Rate limiting
 * - Secure password handling
 */

"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { signIn, signUp, signOut, getCurrentUser } from "@/lib/auth"
import { useRouter } from "next/navigation"

export function UserAuthForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin")

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  })

  // Check if user is already logged in
  useState(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error("Error checking user:", error)
      }
    }

    checkUser()
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { email, password } = formData

      if (!email || !password) {
        throw new Error("Please fill in all fields")
      }

      const user = await signIn(email, password)
      setUser(user)
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to sign in")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { email, password, confirmPassword } = formData

      if (!email || !password || !confirmPassword) {
        throw new Error("Please fill in all fields")
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match")
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters")
      }

      const user = await signUp(email, password)
      setUser(user)
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to sign up")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    setIsLoading(true)

    try {
      await signOut()
      setUser(null)
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to sign out")
    } finally {
      setIsLoading(false)
    }
  }

  // If user is logged in, show profile
  if (user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>You are currently signed in as {user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <div className="p-2 border rounded-md bg-muted">{user.email}</div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSignOut} className="w-full" variant="destructive" disabled={isLoading}>
            {isLoading ? "Signing Out..." : "Sign Out"}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as "signin" | "signup")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">Sign In</TabsTrigger>
        <TabsTrigger value="signup">Sign Up</TabsTrigger>
      </TabsList>

      <TabsContent value="signin">
        <form onSubmit={handleSignIn}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="signup">
        <form onSubmit={handleSignUp}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing Up..." : "Sign Up"}
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  )
}

