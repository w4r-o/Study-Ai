/**
 * DeepSeek AI integration via OpenRouter API
 */

/**
 * Environment configuration
 */
const config = {
  apiKey: process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
  model: process.env.MODEL_PROVIDER || "deepseek/deepseek-r1-zero:free",
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
 * @param prompt The prompt to send to the model
 * @param options Additional options for the request
 * @returns The generated text
 */
export async function generateText(
  prompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const { temperature = 0.7, maxTokens = 3000 } = options;
  
  console.log("\n=== Starting OpenRouter API Request ===");
  console.log("Configuration:");
  console.log("- API Key:", config.apiKey ? "Set" : "Not set");
  console.log("- Model:", config.model);
  console.log("- Referrer:", config.referrer);
  console.log("- Site:", config.site);
  
  if (!config.apiKey) {
    throw new Error("OpenRouter API key not configured. Please check your environment variables.");
  }

  try {
    const requestBody: OpenRouterRequest = {
      model: config.model,
      messages: [
        { 
          role: "system", 
          content: prompt.includes("determine the academic subject") ?
            // Subject determination prompt
            `You are an expert teacher analyzing educational content.
            Your task is to determine the primary academic subject of the provided text.
            
            RULES:
            1. Choose ONLY ONE subject from: Mathematics, Physics, Chemistry, Biology, History, English, Geography, Computer Science, Healthcare
            2. Respond with ONLY the subject name - no other text
            3. Look for subject-specific terminology and concepts
            4. Consider the overall context and focus
            5. If the content is about medical or health topics, choose Healthcare
            
            Analyze this content:
            ${prompt.replace(/determine the academic subject/i, '').trim()}` :
            prompt.includes("determine the specific unit and topic") ?
            // Topic determination prompt
            `You are an expert teacher analyzing educational content.
            Your task is to determine the specific unit, topic, and subtopic being covered.
            
            RULES:
            1. Use only information directly present in the text
            2. Be as specific as possible while remaining accurate
            3. Never use generic terms like "General" or "Basic"
            4. Use proper terminology for the field
            5. Consider the depth and focus of the content
            
            Format your response EXACTLY as:
            Unit: [Main area of study]
            Topic: [Specific topic within that unit]
            Subtopic: [Specific concept being covered]
            
            Example for Healthcare:
            Unit: Physical Therapy
            Topic: Neuromuscular Conditions
            Subtopic: Treatment Approaches and Assessment
            
            Analyze this content:
            ${prompt.replace(/determine the specific unit and topic/i, '').trim()}` :
            // Quiz generation prompt
            `You are a teacher creating a quiz. ${prompt}`
        },
        { 
          role: "user", 
          content: prompt
        }
      ],
      temperature: temperature,
      max_tokens: maxTokens
    };
    
    console.log("Sending request to OpenRouter API...");
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "HTTP-Referer": config.referrer,
        "X-Title": config.site,
        "User-Agent": "Study AI App/1.0.0",
        "OR-ORGANIZATION": "personal",
        "OR-SITE": config.referrer,
        "OR-APP-NAME": "Study AI App",
        "OR-VERSION": "1.0.0"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error response:", errorText);
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("OpenRouter API response received");

    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Invalid response format from OpenRouter API");
    }

    const rawContent = data.choices[0].message.content.trim();
    console.log("\nRaw response content:", rawContent);

    // Handle different types of responses
    if (prompt.includes("determine the academic subject")) {
      // For subject determination, return the single word response
      return rawContent.split(/[\n\r]+/)[0].trim();
    } 
    else if (prompt.includes("determine the specific unit and topic")) {
      // For topic determination, parse the structured response
      const lines: string[] = rawContent.split(/[\n\r]+/).map((line: string) => line.trim()).filter(Boolean);
      
      const unit = lines.find((l: string) => l.startsWith('Unit:'))?.replace('Unit:', '').trim();
      const topic = lines.find((l: string) => l.startsWith('Topic:'))?.replace('Topic:', '').trim();
      const subtopic = lines.find((l: string) => l.startsWith('Subtopic:'))?.replace('Subtopic:', '').trim();
      
      if (!unit || !topic) {
        throw new Error("Missing required topic determination fields");
      }
      
      return `Unit: ${unit}\nTopic: ${topic}${subtopic ? `\nSubtopic: ${subtopic}` : ''}`;
    }
    else {
      // For quiz generation, expect and validate JSON
      try {
        const startIndex = rawContent.indexOf('{');
        const endIndex = rawContent.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1) {
          throw new Error("No valid JSON structure found in response");
        }

        const jsonContent = rawContent.slice(startIndex, endIndex + 1);
        const parsed = JSON.parse(jsonContent);

        if (!parsed.questions?.length) {
          throw new Error("Invalid quiz structure - missing questions array");
        }

        return jsonContent;
      } catch (error) {
        console.error("Failed to parse quiz JSON:", error);
        throw new Error("Failed to generate valid quiz structure");
      }
    }
  } catch (error) {
    console.error("Error in generateText:", error);
    throw error;
  }
}

/**
 * Check if DeepSeek AI service is properly configured
 * @returns True if DeepSeek is configured, false otherwise
 */
export function isAIConfigured(): boolean {
  const apiKey = process.env.OPENROUTER_API_KEY;
  return !!apiKey && apiKey.startsWith("sk-or-");
} 