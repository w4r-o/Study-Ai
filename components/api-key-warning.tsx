"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ApiKeyWarning() {
  const [apiKeyMissing, setApiKeyMissing] = useState(false)

  useEffect(() => {
    // Check if API key is available
    const checkApiKey = async () => {
      try {
        const response = await fetch("/api/check-api-key")
        const data = await response.json()
        setApiKeyMissing(!data.hasAIKey)
      } catch (error) {
        console.error("Error checking API key:", error)
      }
    }

    checkApiKey()
  }, [])

  if (!apiKeyMissing) {
    return null
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>⚠️ DeepSeek API Key Missing</AlertTitle>
      <AlertDescription className="text-sm">
        Please add your DeepSeek API key to use the AI features.
      </AlertDescription>
    </Alert>
  )
}

