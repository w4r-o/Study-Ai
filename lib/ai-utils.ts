/**
 * AI utilities for model selection and configuration
 * 
 * This file provides functions to select the appropriate AI model
 * based on the environment configuration.
 */

import { openai } from "@ai-sdk/openai"
import { env } from "./env"
import { generateOpenRouterText } from "./openrouter-api"

/**
 * Generate text using the configured AI model
 * @param prompt The prompt to send to the model
 * @param options Additional options like temperature and maxTokens
 * @returns The generated text
 */
export async function generateAIText(
  prompt: string, 
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  console.log("generateAIText called, MODEL_PROVIDER:", env.MODEL_PROVIDER);
  
  if (env.MODEL_PROVIDER === "openrouter") {
    console.log("Using OpenRouter for text generation");
    try {
      const result = await generateOpenRouterText(prompt, {
        temperature: options.temperature,
        maxTokens: options.maxTokens
      });
      console.log("OpenRouter response received successfully");
      return result;
    } catch (error) {
      console.error("Error using OpenRouter, falling back to OpenAI:", error);
      // Fall back to OpenAI if OpenRouter fails
    }
  }
  
  // Use OpenAI
  console.log("Using OpenAI for text generation");
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not set. Please check your environment variables.");
  }
  
  const { text } = await import("ai").then(ai => ai.generateText({
    model: openai("gpt-3.5-turbo"),
    prompt,
    temperature: options.temperature || 0.7,
    maxTokens: options.maxTokens || 2000,
  }));
  
  console.log("OpenAI response received successfully");
  return text;
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