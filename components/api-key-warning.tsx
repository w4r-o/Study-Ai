"use client"

import { useEffect, useState } from "react"

export function ApiKeyWarning() {
  const [apiKeyMissing, setApiKeyMissing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Only run this effect on the client
    async function checkApiKey() {
      try {
        const response = await fetch("/api/check-api-key")
        const data = await response.json()
        setApiKeyMissing(!data.hasOpenAIKey)
      } catch (error) {
        console.error("Error checking API key:", error)
      } finally {
        setLoading(false)
      }
    }

    checkApiKey()
  }, [])

  // Don't render anything during SSR to avoid hydration mismatch
  // Only show the warning after client-side check is complete
  if (loading || !apiKeyMissing) return null

  return (
    <div
      className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-200 px-4 py-3 rounded mb-6"
      role="alert"
    >
      <p className="font-bold">OpenAI API Key Missing</p>
      <p className="text-sm">Please add your OpenAI API key to use the AI features.</p>
    </div>
  )
}

