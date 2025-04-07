import { NextResponse } from 'next/server';
import { submitQuizAnswers } from '@/lib/actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quizId, answers } = body;

    if (!quizId || !answers) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const results = await submitQuizAnswers(quizId, answers);
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error submitting quiz:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit quiz' },
      { status: 500 }
    );
  }
} 