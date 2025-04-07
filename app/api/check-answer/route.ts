import { NextResponse } from 'next/server';
import { generateText } from '@/lib/openrouter-api';

// Helper function to normalize LaTeX expressions
function normalizeLatex(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .trim();
}

// Helper function to format feedback with LaTeX
function formatFeedback(text: string): string {
  // Convert basic mathematical operations to LaTeX
  return text
    .replace(/\*/g, '\\cdot ')
    .replace(/(\d+)\/(\d+)/g, '\\frac{$1}{$2}')
    .replace(/([\d.]+)(\^|\*\*)([\d.]+)/g, '$1^{$3}')
    .replace(/sqrt\((.*?)\)/g, '\\sqrt{$1}')
    .replace(/pi/g, '\\pi')
    .replace(/theta/g, '\\theta')
    .replace(/mu/g, '\\mu')
    .replace(/alpha/g, '\\alpha')
    .replace(/beta/g, '\\beta')
    .replace(/delta/g, '\\Delta')
    .replace(/sum/g, '\\sum')
    .replace(/int/g, '\\int');
}

export async function POST(request: Request) {
  try {
    const { questionId, studentAnswer, correctAnswer, questionType } = await request.json();

    if (!questionId || !studentAnswer || !correctAnswer || !questionType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For multiple choice questions, use exact matching
    if (questionType === 'multipleChoice') {
      const isCorrect = studentAnswer.trim() === correctAnswer.trim();
      return NextResponse.json({
        score: isCorrect ? 1 : 0,
        correct: isCorrect,
        feedback: isCorrect 
          ? "Correct! Well done!" 
          : "Incorrect. Please review the options and try again."
      });
    }

    // For short answer questions, use AI evaluation
    const prompt = `
    You are a physics teacher evaluating a student's answer.
    
    Question: ${questionId}
    Student's Answer: ${studentAnswer}
    Correct Answer: ${correctAnswer}
    
    Evaluate the student's answer based on these criteria:
    1. Core concept understanding
    2. Use of proper terminology
    3. Completeness of explanation
    4. Mathematical accuracy (if applicable)
    
    Provide a JSON response in this exact format:
    {
      "score": number between 0 and 1,
      "correct": boolean,
      "feedback": "string explaining the evaluation"
    }
    
    Guidelines:
    - Score 1.0: Perfect answer with all key points
    - Score 0.8-0.9: Minor omissions or imprecise terminology
    - Score 0.6-0.7: Missing some key points but shows understanding
    - Score 0.4-0.5: Partial understanding with significant gaps
    - Score 0.0-0.3: Major misconceptions or missing key concepts
    
    Be lenient with minor omissions (like missing μ symbol) if the core concept is understood.
    `;

    const result = await generateText(prompt, {
      temperature: 0.3,
      maxTokens: 1000,
      responseFormat: "json"
    });

    // Clean up the response to ensure it's valid JSON
    const cleanResult = result.replace(/```json\n|\n```|```/g, '').trim();
    
    try {
      const response = JSON.parse(cleanResult);
      
      if (typeof response.score !== 'number' || typeof response.correct !== 'boolean' || !response.feedback) {
        throw new Error('Invalid AI response format');
      }

      return NextResponse.json(response);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Fallback to basic text matching if AI evaluation fails
      const isCorrect = studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
      return NextResponse.json({
        score: isCorrect ? 1 : 0,
        correct: isCorrect,
        feedback: isCorrect 
          ? "Correct! Well done!" 
          : "Incorrect. Please review the material and try again."
      });
    }
  } catch (error: any) {
    console.error('Error in check-answer route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check answer' },
      { status: 500 }
    );
  }
} 