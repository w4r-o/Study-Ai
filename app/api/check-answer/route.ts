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
    const { questionId, questionText, studentAnswer, correctAnswer, questionType } = await request.json();

    if (!questionId || !studentAnswer || !correctAnswer || !questionType || !questionText) {
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
    You are a YRDSB teacher evaluating a student's answer. Review the student's answer below and assess their understanding of the concept. Focus on the key ideas rather than an exact word-for-word match with the correct answer. Evaluate whether the response demonstrates a reasonable grasp of the topic, and provide constructive feedback if there are misunderstandings or missing elements.

    Question: ${questionText}
    Student's Answer: ${studentAnswer}
    Expected Answer: ${correctAnswer}
    
    Evaluate the student's answer based on these criteria:
    1. Semantic understanding - Does the answer demonstrate understanding of the core concept, even if using different wording?
    2. Key points - Are the main ideas present, even if expressed differently?
    3. Accuracy - Is the information factually correct?
    
    Provide a JSON response in this exact format:
    {
      "score": number between 0 and 1,
      "correct": boolean,
      "feedback": "string explaining the evaluation"
    }
    
    Guidelines:
    - Score 1.0: Shows clear understanding of the concept, even if worded differently
    - Score 0.8-0.9: Good understanding with minor gaps or slightly imprecise explanation
    - Score 0.6-0.7: Basic understanding present but could be more complete
    - Score 0.4-0.5: Some understanding but significant gaps
    - Score 0.0-0.3: Major misunderstandings or incorrect concepts
    
    Focus on whether they understand the concept rather than exact wording matches.
    Be lenient with variations in terminology if the core understanding is demonstrated.
    Consider synonyms and alternative valid ways of expressing the same concept.

    Important: Your response MUST be valid JSON. Do not include any markdown formatting or code blocks.
    `;

    let result;
    try {
      result = await generateText(prompt, {
        temperature: 0.3,
        maxTokens: 1000,
        responseFormat: "json"
      });
    } catch (error) {
      console.error('Error generating AI response:', error);
      // Fallback to more lenient text matching if AI fails
      const normalizedStudent = studentAnswer.trim().toLowerCase();
      const normalizedCorrect = correctAnswer.trim().toLowerCase();
      const isExactMatch = normalizedStudent === normalizedCorrect;
      const containsKeywords = normalizedCorrect.split(' ').some((word: string) => 
        word.length > 3 && normalizedStudent.includes(word)
      );

      return NextResponse.json({
        score: isExactMatch ? 1 : (containsKeywords ? 0.5 : 0),
        correct: isExactMatch,
        feedback: isExactMatch 
          ? "Correct! Well done!" 
          : (containsKeywords 
              ? "Partially correct. Your answer contains some key elements but could be more complete." 
              : "Incorrect. Please review the material and try again.")
      });
    }

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
      // Log the raw response for debugging
      console.error('Raw AI response:', result);
      console.error('Cleaned response:', cleanResult);
      
      // Fallback to more lenient text matching
      const normalizedStudent = studentAnswer.trim().toLowerCase();
      const normalizedCorrect = correctAnswer.trim().toLowerCase();
      const isExactMatch = normalizedStudent === normalizedCorrect;
      const containsKeywords = normalizedCorrect.split(' ').some((word: string) => 
        word.length > 3 && normalizedStudent.includes(word)
      );

      return NextResponse.json({
        score: isExactMatch ? 1 : (containsKeywords ? 0.5 : 0),
        correct: isExactMatch,
        feedback: isExactMatch 
          ? "Correct! Well done!" 
          : (containsKeywords 
              ? "Partially correct. Your answer contains some key elements but could be more complete." 
              : "Incorrect. Please review the material and try again.")
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