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
          content: prompt.includes("Analyze these") ? 
            // Topic determination prompt - simplified and more direct
            `You are a mathematics curriculum expert. Analyze the given text and identify the specific mathematical topic.

OUTPUT FORMAT (return EXACTLY this with NO other text):
Mathematics
Unit: [curriculum unit - be specific, no "General"]
Topic: [specific topic - be specific, no "General"]
Subtopic: [specific concept]

Example:
Mathematics
Unit: Quadratic Relations
Topic: Graphing Quadratics
Subtopic: Vertex Form and Transformations` :
            // Quiz generation prompt - more structured
            `Generate a mathematics quiz in this EXACT JSON format:

{
  "title": "Mathematics Quiz",
  "subject": "Mathematics",
  "grade": "11",
  "topic": "Your topic here",
  "questions": [
    {
      "id": "1",
      "type": "multipleChoice",
      "text": "Clear question text",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "answer": "A) Option 1",
      "explanation": "Clear explanation"
    }
  ]
}

Rules:
1. Return ONLY valid JSON
2. Questions must be topic-specific
3. Multiple choice: exactly 4 options labeled A) to D)
4. Short answer: no options array needed`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,  // Lower temperature for more consistent formatting
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

    console.log(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error response:", errorText);
      
      if (response.status === 401) {
        throw new Error("Invalid API key. Please check your environment configuration.");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again in a few minutes.");
      } else if (response.status === 500) {
        throw new Error("OpenRouter service error. Please try again later.");
      }
      
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("OpenRouter API response received");

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid response format from OpenRouter API:", data);
      throw new Error("Invalid response format from OpenRouter API");
    }

    const rawContent = data.choices[0].message.content;
    console.log("\nRaw response content:", rawContent);

    // If this is a topic determination request
    if (prompt.includes("Analyze these")) {
      // For topic determination, expect a simple text response
      const lines: string[] = rawContent
        .split('\n')
        .map((line: string) => line.trim())
        .filter(Boolean);
      
      // Log the raw response for debugging
      console.log("Topic determination response lines:", lines);
      
      if (lines.length < 3) {
        console.error("Not enough lines in response:", lines);
        throw new Error("Invalid response format - missing required fields");
      }

      const subject = lines[0];
      const unit = lines.find((l: string) => l.startsWith("Unit:"))?.replace("Unit:", "").trim();
      const topic = lines.find((l: string) => l.startsWith("Topic:"))?.replace("Topic:", "").trim();
      const subtopic = lines.find((l: string) => l.startsWith("Subtopic:"))?.replace("Subtopic:", "").trim();

      // Validate each field
      if (!subject || subject !== "Mathematics") {
        throw new Error("Invalid subject - must be Mathematics");
      }
      if (!unit || unit.toLowerCase().includes("general")) {
        throw new Error("Invalid unit - must be specific (not General)");
      }
      if (!topic || topic.toLowerCase().includes("general")) {
        throw new Error("Invalid topic - must be specific (not General)");
      }
      if (!subtopic) {
        throw new Error("Missing subtopic");
      }

      console.log("Topic Determination Results:");
      console.log("- Subject:", subject);
      console.log("- Unit:", unit);
      console.log("- Topic:", topic);
      console.log("- Subtopic:", subtopic);

      return JSON.stringify({ subject, unit, topic, subtopic });
    }

    // For quiz generation, try direct JSON parse first
    try {
      // Remove any potential text before or after the JSON
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const possibleJson = jsonMatch[0];
        try {
          const parsed = JSON.parse(possibleJson);
          if (parsed.questions && Array.isArray(parsed.questions)) {
            console.log("Successfully parsed direct JSON response");
            return JSON.stringify(parsed, null, 2);
          }
        } catch (e) {
          console.log("Direct JSON parse failed, will try cleanup...");
        }
      }
    } catch (directError) {
      console.log("Initial JSON extraction failed, will try cleanup...");
    }

    // Clean up the response for JSON parsing
    let cleanContent = rawContent
      .replace(/```json\s*|\s*```/g, '')     // Remove code blocks
      .replace(/\n\s*/g, ' ')                // Normalize whitespace
      .trim();

    // Find the JSON structure
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON structure found in:", cleanContent);
      throw new Error("Invalid response format - expected JSON structure");
    }

    let jsonContent = jsonMatch[0]
      .replace(/,(\s*[}\]])/g, '$1')         // Fix trailing commas
      .replace(/([{,])\s*"(\w+)":/g, '$1"$2":') // Fix property formatting
      .trim();

    try {
      const parsedContent = JSON.parse(jsonContent);
      
      // Validate structure
      if (!parsedContent.questions?.length) {
        throw new Error("Quiz must contain questions array");
      }

      // Clean up questions
      parsedContent.questions = parsedContent.questions.map((q: any, index: number) => {
        if (!q.text || !q.type || (q.type === 'multipleChoice' && (!Array.isArray(q.options) || q.options.length !== 4))) {
          throw new Error(`Question ${index + 1} has invalid format`);
        }

        return {
          id: q.id || String(index + 1),
          type: q.type,
          text: q.text.trim(),
          options: q.type === 'multipleChoice' ? q.options.map((opt: string) => opt.trim()) : [],
          answer: q.answer.trim(),
          explanation: (q.explanation || '').trim()
        };
      });

      console.log(`Successfully parsed quiz with ${parsedContent.questions.length} questions`);
      return JSON.stringify(parsedContent, null, 2);
    } catch (error) {
      console.error("Failed to parse quiz:", error);
      console.error("Attempted content:", jsonContent);
      throw new Error(`Failed to parse quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
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