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
 * Generate text using DeepSeek via OpenRouter API
 */
export async function generateText(
  prompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "text" | "json";
  } = {}
): Promise<string> {
  const { 
    temperature = 0.7, 
    maxTokens = 3000, 
    responseFormat = "text"
  } = options;
  
  console.log("\n=== Starting OpenRouter API Request ===");
  console.log("Configuration:");
  console.log("- API Key:", config.apiKey ? "Set" : "Not set");
  console.log("- Model:", config.model);
  console.log("- Temperature:", temperature);
  console.log("- Max Tokens:", maxTokens);
  console.log("- Response Format:", responseFormat);
  
  if (!config.apiKey) {
    throw new Error("OpenRouter API key not configured. Please check your environment variables.");
  }

  // Prepare request body
  const requestBody: OpenRouterRequest = {
    model: config.model,
    messages: [
      { 
        role: "system", 
        content: "You are a helpful AI teacher."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: temperature,
    max_tokens: maxTokens
  };

  // Only add response_format for JSON requests
  if (responseFormat === "json") {
    requestBody.response_format = {
      type: "json_object"
    };
  }

  try {
    console.log("Sending request to OpenRouter API...");
    
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API error response (${response.status}):`, errorText);
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("OpenRouter API response received");

    if (!data.choices?.[0]?.message?.content) {
      console.error("Invalid response format:", data);
      throw new Error("Invalid response format from OpenRouter API");
    }

    const content = data.choices[0].message.content.trim();
    
    if (responseFormat === "json") {
      try {
        // For JSON responses, try to parse the content
        const jsonContent = content.replace(/```json\n|\n```|```/g, '').trim();
        const startIndex = jsonContent.indexOf('{');
        const endIndex = jsonContent.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1) {
          throw new Error("No valid JSON found in response");
        }
        
        const jsonStr = jsonContent.slice(startIndex, endIndex + 1);
        // Validate JSON by parsing it
        JSON.parse(jsonStr);
        return jsonStr;
      } catch (error) {
        console.error("Failed to parse JSON response:", content);
        throw new Error("Invalid JSON response from API");
      }
    }

    return content;
  } catch (error: any) {
    console.error("Error in OpenRouter API request:", error);
    throw error;
  }
}

/**
 * Check if AI is configured
 */
export function isAIConfigured(): boolean {
  return Boolean(config.apiKey);
} 