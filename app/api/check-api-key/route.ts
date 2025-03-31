import { NextResponse } from "next/server"

export async function GET() {
  // Directly check if API key exists and has the correct format
  const apiKey = process.env.OPENROUTER_API_KEY;
  const hasValidApiKey = !!apiKey && apiKey.startsWith("sk-or-");
  
  console.log(`API check: API key exists: ${!!apiKey}, Is valid format: ${hasValidApiKey}`);
  
  return NextResponse.json({
    hasAIKey: hasValidApiKey,
    hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
}

