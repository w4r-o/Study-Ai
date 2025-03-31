// Environment variables with validation
export const env = {
  // Server-side only environment variables (these will be empty strings on the client)
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "", // OpenRouter API key
}

// Server-side only code
if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  // Only log warnings in development and only on the server
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("OPENROUTER_API_KEY is not set. AI features will not work properly.")
  }
}

// Check if required environment variables are set
function checkEnvVars() {
  console.log("Checking DeepSeek API key...");
  
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("OPENROUTER_API_KEY is not set. AI features will not work properly.");
  } else {
    console.log(`DeepSeek API key is set and starts with: "${process.env.OPENROUTER_API_KEY.substring(0, 10)}..."`);
  }
}

// Call the checkEnvVars function to verify environment variables
checkEnvVars();

