/**
 * DeepSeek AI integration via OpenRouter API
 */

/**
 * Environment configuration
 */
const config = {
  apiKey: process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
  model: "deepseek/deepseek-chat-v3-0324:free",
  referrer: process.env.OPENROUTER_REFERRER || "http://localhost:3005",
  site: process.env.OPENROUTER_SITE || "Study AI App"
};

// Validate configuration
if (!config.apiKey) {
  console.error("OpenRouter API key not found in environment variables");
  console.error("Please set OPENROUTER_API_KEY or NEXT_PUBLIC_OPENROUTER_API_KEY");
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: "text" | "json_object";
  };
}

interface OpenRouterMessage {
  role: string;
  content: string;
}

interface OpenRouterChoice {
  message: OpenRouterMessage;
  finish_reason?: string;
  index?: number;
}

interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
  created: number;
  model: string;
  object: string;
}

interface QuizQuestion {
  id: string;
  type: 'multipleChoice' | 'shortAnswer';
  text: string;
  options?: string[];
  answer: string;
  explanation: string;
}

interface Quiz {
  title: string;
  subject: string;
  grade: string;
  topic: string;
  questions: QuizQuestion[];
}

/**
 * Generate text using DeepSeek via OpenRouter API with retry functionality
 */
export async function generateText(
  prompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "text" | "json";
    maxRetries?: number;
  } = {}
): Promise<string> {
  const { 
    temperature = 0.7, 
    maxTokens = 3000, 
    responseFormat = "text",
    maxRetries = 3 
  } = options;
  
  console.log("\n=== Starting OpenRouter API Request ===");
  console.log("Configuration:");
  console.log("- API Key:", config.apiKey ? "Set" : "Not set");
  console.log("- Model:", config.model);
  console.log("- Referrer:", config.referrer);
  console.log("- Site:", config.site);
  console.log("- Max Tokens:", maxTokens);
  console.log("- Max Retries:", maxRetries);

  if (!config.apiKey) {
    throw new Error("OpenRouter API key not configured. Please check your environment variables.");
  }

  // Prepare request body
  const requestBody: OpenRouterRequest = {
    model: config.model,
    messages: [
      { 
        role: "system", 
        content: `You are a helpful AI teacher. ${prompt}`
      }
    ],
    temperature: temperature,
    max_tokens: maxTokens,
    response_format: {
      type: responseFormat === "json" ? "json_object" : "text"
    }
  };

  // Retry with exponential backoff
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount <= maxRetries) {
    try {
      console.log(`Sending request to OpenRouter API... (Attempt ${retryCount + 1}/${maxRetries + 1})`);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
          "HTTP-Referer": config.referrer,
          "X-Title": config.site
        },
        body: JSON.stringify(requestBody)
      });

      // Handle rate limiting (429) with retry
      if (response.status === 429) {
        // Extract retry-after header if available, otherwise use exponential backoff
        const retryAfter = response.headers.get('retry-after') 
          ? parseInt(response.headers.get('retry-after') || '1') 
          : Math.pow(2, retryCount);
        
        const waitTime = retryAfter * 1000; // convert to milliseconds
        console.warn(`Rate limited by OpenRouter. Retrying in ${waitTime/1000} seconds...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retryCount++;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter API error response (${response.status}):`, errorText);
        
        // For other non-OK responses, retry with backoff
        if (retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.warn(`Request failed with status ${response.status}. Retrying in ${waitTime/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
          continue;
        }
        
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }

      const data: OpenRouterResponse = await response.json();
      console.log("OpenRouter API response received successfully");

      if (!data.choices?.[0]?.message?.content) {
        console.error("Invalid response format:", data);
        throw new Error("Invalid response format from OpenRouter API");
      }

      const content = data.choices[0].message.content.trim();
      
      if (responseFormat === "json") {
        try {
          // Extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON object found in response");
          }
          return jsonMatch[0];
        } catch (error) {
          console.error("Error parsing JSON response:", error);
          throw new Error("Failed to parse JSON response");
        }
      }

      return content;
    } catch (error: any) {
      lastError = error;
      
      // Only retry if we haven't hit the max retries yet
      if (retryCount < maxRetries) {
        const waitTime = Math.pow(2, retryCount) * 1000;
        console.warn(`Error: ${error.message}. Retrying in ${waitTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retryCount++;
      } else {
        console.error("Max retries reached. Giving up.");
        break;
      }
    }
  }

  // If we've exhausted retries and still have an error, throw it
  if (lastError) {
    throw lastError;
  }

  // This should never happen as we either return a result or throw an error above
  throw new Error("Unknown error occurred during API request");
}

/**
 * Check if DeepSeek AI service is properly configured
 */
export function isAIConfigured(): boolean {
  return !!config.apiKey && config.apiKey.startsWith("sk-or-");
} 