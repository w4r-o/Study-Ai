import { NextResponse } from "next/server"
import { isAIConfigured } from "@/lib/ai-utils"

export async function GET() {
  // This code only runs on the server
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY

  return NextResponse.json({
    hasAIKey: isAIConfigured(),
    hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
}

