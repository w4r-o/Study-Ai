import { NextResponse } from "next/server"

export async function GET() {
  // This code only runs on the server
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY

  return NextResponse.json({
    hasOpenAIKey,
    hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
}

