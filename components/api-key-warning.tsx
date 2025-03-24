"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ExclamationTriangleIcon } from "@radix-ui/react-icons"

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
      <ExclamationTriangleIcon className="h-4 w-4" />
      <AlertTitle>AI API Key Missing</AlertTitle>
      <AlertDescription className="text-sm">
        Please add your AI API key to use the AI features.
      </AlertDescription>
    </Alert>
  )
}

