/**
 * AI utilities for model selection and configuration
 * 
 * This file provides functions to select the appropriate AI model
 * based on the environment configuration.
 */

import { openai } from "@ai-sdk/openai"
import { openrouter } from "@ai-sdk/openrouter"
import { env } from "./env"

/**
 * Get the appropriate AI model based on environment configuration
 * @param modelName The model name to use (defaults to appropriate values based on provider)
 * @returns The configured AI model
 */
export function getAIModel(modelName?: string) {
  // If using OpenRouter
  if (env.MODEL_PROVIDER === "openrouter") {
    return openrouter({
      model: modelName || "deepseek/deepseek-r1-zero:free",
      apiKey: env.OPENROUTER_API_KEY,
    })
  }
  
  // Default to OpenAI
  return openai(modelName || "gpt-3.5-turbo")
}

/**
 * Check if AI services are properly configured
 * @returns True if AI services are configured, false otherwise
 */
export function isAIConfigured(): boolean {
  if (env.MODEL_PROVIDER === "openrouter") {
    return !!env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.startsWith("sk-or-")
  }
  
  return !!env.OPENAI_API_KEY && env.OPENAI_API_KEY.startsWith("sk-")
} 