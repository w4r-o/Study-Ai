// Environment variables with validation
export const env = {
  // Server-side only environment variables (these will be empty strings on the client)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",

  // Client-side accessible environment variables
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
}

// Server-side only code
if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  // Only log warnings in development and only on the server
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set. AI features will not work properly.")
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn(
      "Supabase environment variables are not set. Authentication and database features will not work properly.",
    )
  }
}

