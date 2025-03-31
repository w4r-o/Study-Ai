/**
 * Root layout
 * 
 * Key Functions:
 * - RootLayout: Wraps all pages with providers
 * 
 * Integrations:
 * - Theme system
 * 
 * Used By:
 * - Next.js app router
 * 
 * Dependencies:
 * - components/theme-provider.tsx
 * - app/globals.css
 */

import type React from "react"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "StudyAI",
  description: "Generate practice tests from your notes",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'