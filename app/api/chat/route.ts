import { NextResponse } from 'next/server';
import { generateText } from '@/lib/openrouter-api';
import { getQuiz } from '@/lib/actions';

export async function POST(req: Request) {
  try {
    const { messages, quizId } = await req.json();

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
    }

    // Get quiz context if quizId is provided
    let quizContext = '';
    if (quizId) {
      try {
        const quiz = await getQuiz(quizId);
        quizContext = `
Current Quiz Context:
Title: ${quiz.title}
Subject: ${quiz.subject}
Topic: ${quiz.topic}
Grade: ${quiz.grade}

Questions Overview:
${quiz.questions.map((q: any, i: number) => 
  `${i + 1}. ${q.text}
   Type: ${q.type}
   Category: ${q.category}
   ${q.explanation ? `Explanation: ${q.explanation}` : ''}`
).join('\n\n')}
`;
      } catch (error) {
        console.error('Error getting quiz context:', error);
      }
    }

    // Create the full prompt with context
    const prompt = `You are a knowledgeable and helpful tutor assisting a student with their quiz.

${quizContext}

Previous conversation:
${messages.slice(0, -1).map((m: any) => `${m.role}: ${m.content}`).join('\n')}

Student's Question: ${lastMessage.content}

Provide a clear, helpful response that:
1. Uses the quiz context to give relevant explanations
2. Explains concepts step by step
3. Uses examples when helpful
4. Encourages understanding rather than just giving answers
5. References specific questions or topics from the quiz when relevant

Your response should be friendly and encouraging while maintaining academic rigor.`;

    // Generate the chat response
    const response = await generateText(prompt, { 
      responseFormat: "text",
      temperature: 0.7
    });

    return NextResponse.json({ response: response.trim() });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
} 