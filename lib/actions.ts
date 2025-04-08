/**
 * Server-side actions for quiz generation
 * 
 * Key Functions:
 * - createQuiz: Generates quiz from PDF notes
 * - getQuiz: Retrieves quiz by ID
 * - submitQuizAnswers: Processes quiz submissions
 * - getQuizResults: Retrieves quiz results
 * - getPastQuizzes: Gets user's quiz history
 * 
 * Integrations:
 * - DeepSeek AI via OpenRouter
 * - Supabase Database
 * 
 * Used By:
 * - components/file-upload.tsx
 * - components/past-materials.tsx
 * 
 * Dependencies:
 * - lib/pdf-utils.ts
 * - lib/server-auth.ts
 * - lib/supabase/server.ts
 */

"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/server-auth"
import { extractTextFromPDF } from "@/lib/pdf-utils"
import { generateText, isAIConfigured } from "@/lib/openrouter-api"
import { QuizResult, QuizQuestion as QuizQuestionType } from "./types"

// Maximum file size in bytes (20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024

// Quiz storage with persistence
let quizStore: { [key: string]: QuizData } = {};
let pastQuizzesStore: {
  id: string;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  createdAt: string;
  totalQuestions: number;
}[] = [];

// Load quiz data from file if it exists
function loadQuizData() {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.join(process.cwd(), '.quiz-data.json');
    
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      quizStore = data.quizzes || {};
      pastQuizzesStore = data.pastQuizzes || [];
      console.log('Loaded quiz data:', {
        quizCount: Object.keys(quizStore).length,
        pastQuizCount: pastQuizzesStore.length
      });
    }
  } catch (error) {
    console.error('Error loading quiz data:', error);
  }
}

// Save quiz data to file
function saveQuizData() {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.join(process.cwd(), '.quiz-data.json');
    
    fs.writeFileSync(dataPath, JSON.stringify({
      quizzes: quizStore,
      pastQuizzes: pastQuizzesStore
    }, null, 2));
    
    console.log('Saved quiz data:', {
      quizCount: Object.keys(quizStore).length,
      pastQuizCount: pastQuizzesStore.length
    });
  } catch (error) {
    console.error('Error saving quiz data:', error);
  }
}

// Initialize quiz data on module load
loadQuizData();

interface QuizQuestion {
  id: string;
  text: string;
  type: "multipleChoice" | "shortAnswer";
  category: "Multiple Choice" | "Knowledge" | "Thinking" | "Application" | "Communication";
  options?: string[];
  answer: string;
  explanation?: string;
  rubric?: string;
}

interface QuizResults {
  id: string;
  quizId: string;
  answers: {
    [questionId: string]: {
      score: number;
      isCorrect: boolean;
      feedback: string;
      userAnswer: string;
    };
  };
  overall: {
    score: number;
    feedback: string;
    reviewTopics: string[];
    strengths: string[];
  };
  submittedAt: string;
}

interface QuizData {
  title: string;
  subject: string;
  grade: string;
  topic: string;
  questions: QuizQuestion[];
  createdAt: number;
  totalQuestions: number;
  results?: QuizResults;
}

// Helper function to escape LaTeX in JSON
function escapeLatexForJson(text: string) {
  return text.replace(/\\/g, '\\\\');
}

// Helper function to clear quiz store
function clearQuizStore() {
  quizStore = {};
  pastQuizzesStore = [];
  saveQuizData();
}

// Helper function to convert LaTeX commands to actual symbols
function convertLatexToSymbols(text: string): string {
  const replacements: [RegExp, string][] = [
    [/\\neq/g, '≠'],
    [/\\leq/g, '≤'],
    [/\\geq/g, '≥'],
    [/\\infty/g, '∞'],
    [/\\in/g, '∈'],
    [/\\subset/g, '⊂'],
    [/\\supset/g, '⊃'],
    [/\\cup/g, '∪'],
    [/\\cap/g, '∩'],
    [/\\emptyset/g, '∅'],
    [/\\pm/g, '±'],
    [/\\times/g, '×'],
    [/\\div/g, '÷'],
    [/\\cdot/g, '·'],
    [/\\rightarrow/g, '→'],
    [/\\leftarrow/g, '←'],
    [/\\Rightarrow/g, '⇒'],
    [/\\Leftarrow/g, '⇐'],
    [/\\xer/g, 'ℝ'],  // For domain x ∈ ℝ
    [/\\yer/g, 'ℝ'],  // For range y ∈ ℝ
    [/\\mathbb{R}/g, 'ℝ'],
    [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'],
    [/\\theta/g, 'θ'],
    [/\\pi/g, 'π']
  ];

  let result = text;
  for (const [pattern, symbol] of replacements) {
    result = result.replace(pattern, symbol);
  }
  return result;
}

/**
 * Creates a new quiz based on uploaded notes
 * @param formData Form data containing notes, grade, and question distribution
 * @returns The ID of the created quiz
 */
export async function createQuiz(formData: FormData): Promise<string> {
  try {
    console.log("\n=== Starting Quiz Generation ===");
    console.log("Timestamp:", new Date().toISOString());
    
    // Get and validate form data
    const notesFiles = formData.getAll("notes") as File[];
    const grade = formData.get("grade")?.toString() || "11";
    
    // Get question distribution
    const multipleChoice = parseInt(formData.get("multipleChoice")?.toString() || "0", 10);
    const knowledge = parseInt(formData.get("knowledge")?.toString() || "0", 10);
    const thinking = parseInt(formData.get("thinking")?.toString() || "0", 10);
    const application = parseInt(formData.get("application")?.toString() || "0", 10);
    const communication = parseInt(formData.get("communication")?.toString() || "0", 10);

    // Calculate total questions
    const numQuestions = multipleChoice + knowledge + thinking + application + communication;
    
    // Validate question counts
    if (numQuestions === 0) {
      throw new Error("Please specify the number of questions for at least one category");
    }
    
    if (numQuestions > 50) {
      throw new Error("Total number of questions cannot exceed 50");
    }

    // Log question distribution
    console.log(`Question Distribution:
- Multiple Choice: ${multipleChoice}
- Knowledge: ${knowledge}
- Thinking: ${thinking}
- Application: ${application}
- Communication: ${communication}
- Total Questions: ${numQuestions}`);

    if (notesFiles.length === 0) {
      throw new Error("No notes files were uploaded");
    }

    // Extract text from PDF files with more content
    const notesText: string[] = [];
    let totalCharacters = 0;
    
    for (const file of notesFiles) {
      try {
        console.log(`\nProcessing file: ${file.name}`);
        const text = await extractTextFromPDF(file);
        if (!text || text.trim().length === 0) {
          throw new Error("No text could be extracted from the PDF. Please ensure the PDF contains readable text and try again.");
        }
        totalCharacters += text.length;
        console.log(`- Extracted ${text.length} characters`);
        notesText.push(text);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        throw new Error(`Failed to process ${file.name}. ${error instanceof Error ? error.message : 'Please ensure it\'s a valid PDF with readable text.'}`);
      }
    }
    
    console.log(`\nTotal characters extracted: ${totalCharacters}`);
    
    if (totalCharacters === 0) {
      throw new Error("No text could be extracted from any of the uploaded files. Please ensure your PDFs contain readable text and try again.");
    }

    // Determine subject from notes content
    console.log("\nDetermining subject...");
    const subject = await determineSubject(notesText.join("\n"));
    console.log(`- Determined subject: ${subject}`);

    // Determine specific topic with more context
    console.log("\nDetermining topic...");
    const topic = await determineTopic(notesText.join("\n"), subject);
    console.log(`- Determined topic: ${topic}`);
    console.log(`\nGenerating ${numQuestions} questions for ${subject} > ${topic} (Grade ${grade})`);

    // Generate quiz using DeepSeek with increased tokens
    console.log("\nGenerating quiz with DeepSeek...");
    const fullNotesText = notesText.join("\n").substring(0, 3000);
    
    console.log("Preparing quiz generation prompt...");
    const prompt = `
    You are a Highschool teacher at York Region District School Board creating a Grade ${grade} test.
    
    CRITICAL: You MUST generate COMPLETELY NEW questions according to this exact distribution:
    1. Multiple Choice Questions: ${multipleChoice} questions
       - Focus on basic concept understanding and recall
       - Each must have exactly 4 options (A, B, C, D)
    
    2. Knowledge Questions: ${knowledge} questions
       - Short answer format
       - Test recall and basic understanding
       - Focus on definitions, formulas, and basic concepts
    
    3. Thinking Questions: ${thinking} questions
       - Short answer format
       - Test problem-solving and analytical skills
       - Include multi-step problems and reasoning
    
    4. Application Questions: ${application} questions
       - Short answer format
       - Test real-world applications
       - Include word problems and practical scenarios
    
    5. Communication Questions: ${communication} questions
       - Short answer format
       - Test explanation and justification
       - Ask students to explain their reasoning or process
    
    Total: ${numQuestions} questions
    
    Base all questions on these notes:
    ${fullNotesText}
    
    Response Format (MUST be valid JSON):
    {
      "title": "Grade ${grade} ${topic} Quiz",
      "subject": "${subject}",
      "grade": "${grade}",
      "topic": "${topic}",
      "questions": [
        {
          "id": "1",
          "type": "multipleChoice",
          "category": "Multiple Choice",
          "text": "Question text here",
          "options": [
            "A) First option",
            "B) Second option",
            "C) Third option",
            "D) Fourth option"
          ],
          "answer": "A) First option",
          "explanation": "Step-by-step explanation"
        }
      ]
    }`;

    console.log("Making quiz generation request...");
    console.log("Prompt length:", prompt.length);
    
    let quizText;
    try {
      quizText = await generateText(prompt, {
        temperature: 0.3,
        maxTokens: 3000
      });
      console.log("Quiz generation response received!");
      console.log("Response length:", quizText.length);
    } catch (error) {
      console.error("Error in quiz generation request:", error);
      throw new Error("Failed to generate quiz questions. Please try again.");
    }

    // Process quiz response
    console.log("\nProcessing quiz response...");
    try {
      // Clean up the response
      quizText = quizText.trim();
      if (quizText.includes('```')) {
        quizText = quizText.replace(/```json\n|\n```|```/g, '').trim();
      }

      // Find JSON boundaries
      const startIndex = quizText.indexOf('{');
      const endIndex = quizText.lastIndexOf('}');
      
      if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
        throw new Error("Invalid JSON format in response");
      }
      
      // Extract and parse JSON
      quizText = quizText.slice(startIndex, endIndex + 1);
      const quiz = JSON.parse(quizText) as QuizData;
      
      // Validate quiz structure
      if (!quiz.title || !quiz.subject || !quiz.grade || !Array.isArray(quiz.questions)) {
        throw new Error("Invalid quiz structure");
      }
      
      // Ensure we have at least some questions
      if (quiz.questions.length === 0) {
        throw new Error("No questions generated");
      }

      // Log the actual question count for debugging
      console.log(`Generated ${quiz.questions.length} questions (expected ${numQuestions})`);

      // Update validation to check category counts
      const questionsByCategory = {
        multipleChoice: quiz.questions.filter(q => q.type === "multipleChoice").length,
        knowledge: quiz.questions.filter(q => q.type === "shortAnswer" && q.category === "Knowledge").length,
        thinking: quiz.questions.filter(q => q.type === "shortAnswer" && q.category === "Thinking").length,
        application: quiz.questions.filter(q => q.type === "shortAnswer" && q.category === "Application").length,
        communication: quiz.questions.filter(q => q.type === "shortAnswer" && q.category === "Communication").length
      };

      console.log("Questions by category:", questionsByCategory);

      // Convert LaTeX commands to actual symbols
      quiz.questions = quiz.questions.map(q => ({
        ...q,
        text: convertLatexToSymbols(q.text),
        options: q.options?.map(convertLatexToSymbols),
        answer: convertLatexToSymbols(q.answer),
        explanation: q.explanation ? convertLatexToSymbols(q.explanation) : undefined,
        rubric: q.rubric ? convertLatexToSymbols(q.rubric) : undefined
      }));

      // Create quiz ID and store
      const quizId = `quiz-${Date.now()}`;
      console.log(`\nStoring quiz with ID: ${quizId}`);
      
      quizStore[quizId] = {
        ...quiz,
        createdAt: Date.now(),
        topic: topic,
        subject: subject,
        grade: grade,
        totalQuestions: quiz.questions.length
      };
      
      // Store in past materials
      pastQuizzesStore.push({
        id: quizId,
        title: quiz.title,
        subject: subject,
        grade: grade,
        topic: topic,
        createdAt: new Date().toISOString(),
        totalQuestions: quiz.questions.length
      });
      
      // Save data to file
      saveQuizData();
      
      console.log("=== Quiz Generation Complete ===\n");
      return quizId;
      
    } catch (error) {
      console.error("\nError processing quiz response:", error);
      throw new Error("Failed to generate quiz. Please try again.");
    }
  } catch (error) {
    console.error("\n=== Quiz Generation Failed ===");
    console.error(error);
    throw error;
  }
}

/**
 * Determines the subject of the notes using DeepSeek
 */
async function determineSubject(notesText: string): Promise<string> {
  const subjectPrompt = `
    Based on these notes, determine the academic subject.
    You MUST respond with ONLY ONE of these exact words (no other text or punctuation):
    Mathematics
    Physics
    Chemistry
    Biology
    History
    English
    Geography
    Computer Science
    Healthcare
    
    Notes:
    ${notesText.substring(0, 1000)}
  `;

  try {
    console.log("Making subject determination request...");
    const response = await generateText(subjectPrompt, {
      temperature: 0.1, // Lower temperature for more consistent responses
      maxTokens: 50
    });
    
    console.log("Raw subject response:", response);
    
    // Clean up the response - remove quotes, periods, newlines and extra whitespace
    const subject = response.replace(/['".,\n\r]/g, '').trim();
    console.log("Cleaned subject:", subject);
    
    // Validate that we got one of the expected subjects
    const validSubjects = [
      'Mathematics',
      'Physics',
      'Chemistry',
      'Biology',
      'History',
      'English',
      'Geography',
      'Computer Science',
      'Healthcare'
    ];
    
    const matchedSubject = validSubjects.find(
      valid => valid.toLowerCase() === subject.toLowerCase()
    );
    
    if (!matchedSubject) {
      console.error("Invalid subject returned:", subject);
      throw new Error("Could not determine a valid subject from notes");
    }
    
    return matchedSubject;
  } catch (error) {
    console.error("Error determining subject:", error);
    throw error;
  }
}

/**
 * Determines the specific topic of the notes
 */
async function determineTopic(notesText: string, subject: string): Promise<string> {
  const topicPrompt = `
    You are a teacher analyzing these ${subject} notes.
    Provide a concise topic classification in this exact format:
    Unit: [Main area]
    Topic: [Specific topic]
    
    Example:
    Unit: Functions
    Topic: Exponential Growth
    
    Notes:
    ${notesText.substring(0, 1000)}
  `;

  try {
    console.log("Making topic determination request...");
    const response = await generateText(topicPrompt, {
      temperature: 0.3,
      maxTokens: 200
    });
    
    console.log("Raw topic response:", response);
    // Clean up response and extract components
    const cleanResponse = response.replace(/['"]/g, '').trim();
    console.log("\nCleaned topic response:", cleanResponse);
    
    // Extract unit and topic using regex
    const unitMatch = cleanResponse.match(/Unit:\s*([^\n]+)/);
    const topicMatch = cleanResponse.match(/Topic:\s*([^\n]+)/);
    
    const unit = unitMatch ? unitMatch[1].trim() : '';
    const topic = topicMatch ? topicMatch[1].trim() : '';
    
    if (!unit || !topic) {
      console.log("\nFalling back to keyword extraction...");
      const keywords = extractTopicKeywords(notesText, subject);
      if (!keywords) {
        throw new Error("Could not determine topic from notes");
      }
      console.log("Found keywords:", keywords);
      return keywords;
    }
    
    // Combine into final topic
    const fullTopic = `${unit} - ${topic}`;
    console.log("Final topic:", fullTopic);
    return cleanupTopic(fullTopic);
  } catch (error) {
    console.error("Error in topic determination:", error);
    throw error;
  }
}

/**
 * Get example topics for a given subject
 */
function getTopicExamples(subject: string): string {
  const examples: Record<string, string[]> = {
    Mathematics: [
      "Exponential Functions",
      "Quadratic Functions",
      "Trigonometry",
      "Linear Functions",
      "Polynomial Functions"
    ],
    Physics: [
      "Kinematics",
      "Forces and Motion",
      "Energy and Work",
      "Waves",
      "Electricity"
    ],
    Chemistry: [
      "Chemical Bonding",
      "Stoichiometry",
      "Acids and Bases",
      "Organic Chemistry",
      "Thermodynamics"
    ],
    Biology: [
      "Cell Biology",
      "Genetics",
      "Evolution",
      "Ecology",
      "Human Body Systems"
    ],
    History: [
      "World War II",
      "Industrial Revolution",
      "Cold War",
      "Ancient Civilizations",
      "Renaissance"
    ],
    English: [
      "Shakespeare",
      "Poetry Analysis",
      "Essay Writing",
      "Literary Devices",
      "Novel Study"
    ],
    Geography: [
      "Climate Change",
      "Physical Geography",
      "Human Geography",
      "Resource Management",
      "Urban Development"
    ],
    "Computer Science": [
      "Programming Fundamentals",
      "Data Structures",
      "Algorithms",
      "Web Development",
      "Database Design"
    ]
  };

  return (examples[subject] || ["General Topics"]).join(", ");
}

/**
 * Extract topic keywords from notes text
 */
function extractTopicKeywords(notesText: string, subject: string): string {
  if (subject === "Mathematics") {
    // Look for mathematical concepts first
    const mathConcepts = [
      "function", "equation", "expression", "polynomial",
      "exponential", "logarithm", "trigonometry", "geometry",
      "probability", "statistics", "vector", "matrix",
      "derivative", "integral", "calculus", "algebra"
    ];
    
    const words = notesText.toLowerCase().split(/\s+/);
    for (const concept of mathConcepts) {
      if (words.includes(concept)) {
        // Found a math concept, look for related terms
        const conceptIndex = words.indexOf(concept);
        const surroundingWords = words.slice(Math.max(0, conceptIndex - 3), conceptIndex + 4);
        return surroundingWords
          .filter(word => word.length > 3)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }
    }
  }
  
  // If no math concepts found, try general topic indicators
  const indicators = [
    "Chapter", "Unit", "Topic", "Section",
    "Lesson", "Introduction to", "Understanding"
  ];
  
  const lines = notesText.split('\n');
  for (const line of lines) {
    for (const indicator of indicators) {
      if (line.includes(indicator)) {
        const topic = line
          .replace(indicator, '')
          .replace(/[:\-\d]/g, '')
          .trim();
        if (topic.length > 3) {
          return topic;
        }
      }
    }
  }
  
  return '';
}

/**
 * Clean up a topic string
 */
function cleanupTopic(topic: string): string {
  return topic
    // Remove unit/chapter numbers
    .replace(/^(unit|chapter|section|lesson)\s*\d+/i, '')
    // Remove grade levels
    .replace(/grade\s*\d+/i, '')
    // Remove common prefixes
    .replace(/^(introduction to|understanding|basics of)/i, '')
    // Remove extra whitespace
    .trim()
    // Capitalize first letter of each word
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Gets a quiz by ID
 * @param id Quiz ID
 * @returns The quiz data
 */
export async function getQuiz(id: string) {
  console.log("Getting quiz with ID:", id);
  
  try {
    // Reload quiz data to ensure we have the latest
    loadQuizData();
    
    // Get quiz from store
    const quiz = quizStore[id];
    if (!quiz) {
      console.error("Quiz not found in store for ID:", id);
      console.log("Available quiz IDs:", Object.keys(quizStore));
      throw new Error("Quiz not found");
    }
    
    // Validate quiz structure before returning
    if (!quiz.questions || !Array.isArray(quiz.questions)) {
      console.error("Invalid quiz structure - missing questions array:", quiz);
      throw new Error("Invalid quiz structure");
    }

    // Ensure each question has required fields
    quiz.questions = quiz.questions.map((q: Partial<QuizQuestion>, index: number) => ({
      id: q.id || (index + 1).toString(),
      text: q.text || "",
      type: q.type || "multipleChoice",
      category: q.category || (q.type === "multipleChoice" ? "Multiple Choice" : "Knowledge"),
      options: Array.isArray(q.options) ? q.options : [],
      answer: q.answer || "",
      explanation: q.explanation || ""
    }));
    
    // Log quiz details for debugging
    console.log("Retrieved quiz data:", {
      title: quiz.title,
      topic: quiz.topic,
      createdAt: new Date(quiz.createdAt).toISOString(),
      questionCount: quiz.questions.length
    });
    
    return quiz;
  } catch (error: any) {
    console.error("Error getting quiz:", error);
    throw new Error(`Failed to get quiz: ${error.message}`);
  }
}

/**
 * Evaluates all quiz answers together using AI
 */
async function evaluateQuizAnswers(quizId: string, answers: Record<string, any>, quiz: QuizData): Promise<QuizResults> {
  try {
    console.log('\nEvaluating quiz answers...');
    const results: QuizResults = {
      id: `result-${Date.now()}`,
      quizId: quizId,
      answers: {},
      overall: {
        score: 0,
        feedback: '',
        reviewTopics: [],
        strengths: []
      },
      submittedAt: new Date().toISOString()
    };

    // Evaluate each answer
    for (const question of quiz.questions) {
      const answer = answers[question.id];
      
      // Handle missing or empty answers
      if (!answer || answer.trim() === '') {
        results.answers[question.id] = {
          isCorrect: false,
          feedback: 'No answer provided',
          score: 0,
          userAnswer: ''
        };
        continue;
      }

      // Check answer based on type
      if (question.type === 'multipleChoice') {
        const isCorrect = answer === question.answer;
        results.answers[question.id] = {
          isCorrect,
          feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${question.answer}`,
          score: isCorrect ? 1 : 0,
          userAnswer: answer
        };
      } else {
        // For short answer questions, use AI evaluation
        const evaluation = await checkAnswer(question.id, answer);
        results.answers[question.id] = {
          isCorrect: evaluation.isCorrect,
          feedback: evaluation.feedback,
          score: evaluation.score,
          userAnswer: answer
        };
      }
    }

    // Calculate overall score
    const totalQuestions = quiz.questions.length;
    const totalScore = Object.values(results.answers).reduce((sum, answer) => sum + answer.score, 0);
    results.overall.score = Math.round((totalScore / totalQuestions) * 100);

    // Generate overall feedback
    results.overall.feedback = generateOverallFeedback(results);
    results.overall.reviewTopics = identifyReviewTopics(results, quiz);
    results.overall.strengths = identifyStrengths(results, quiz);

    console.log('Evaluation complete:', {
      totalQuestions,
      totalScore,
      overallScore: results.overall.score
    });

    return results;
  } catch (error) {
    console.error('Error evaluating answers:', error);
    throw error;
  }
}

function generateOverallFeedback(results: QuizResults): string {
  const score = results.overall.score;
  if (score >= 90) return 'Excellent work! You have a strong understanding of the material.';
  if (score >= 70) return 'Good job! You have a solid grasp of most concepts.';
  if (score >= 50) return 'You have a basic understanding, but there are areas for improvement.';
  return 'You may want to review the material and try again.';
}

function identifyReviewTopics(results: QuizResults, quiz: QuizData): string[] {
  const reviewTopics: string[] = [];
  for (const [questionId, answer] of Object.entries(results.answers)) {
    if (!answer.isCorrect) {
      const question = quiz.questions.find(q => q.id === questionId);
      if (question) {
        reviewTopics.push(question.text || 'General concepts');
      }
    }
  }
  return [...new Set(reviewTopics)]; // Remove duplicates
}

function identifyStrengths(results: QuizResults, quiz: QuizData): string[] {
  const strengths: string[] = [];
  for (const [questionId, answer] of Object.entries(results.answers)) {
    if (answer.isCorrect) {
      const question = quiz.questions.find(q => q.id === questionId);
      if (question) {
        strengths.push(question.text || 'General concepts');
      }
    }
  }
  return [...new Set(strengths)]; // Remove duplicates
}

/**
 * Submits quiz answers and generates results
 */
export async function submitQuizAnswers(quizId: string, answers: { [key: string]: string }): Promise<QuizResults> {
  try {
    const quiz = quizStore[quizId];
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    // Validate answers format
    console.log('\nValidating answers...');
    if (!answers || typeof answers !== 'object') {
      console.error('Invalid answers format:', answers);
      throw new Error('Invalid answers format');
    }

    // Fill in missing answers with empty strings and log them
    const missingAnswers = quiz.questions
      .filter(q => !answers[q.id])
      .map(q => q.id);
    
    if (missingAnswers.length > 0) {
      console.warn('Missing answers for questions:', missingAnswers);
      // Fill in missing answers with empty strings
      missingAnswers.forEach(questionId => {
        answers[questionId] = "";
      });
    }

    console.log('\nStarting answer evaluation...');
    // Evaluate all answers together
    const results = await evaluateQuizAnswers(quizId, answers, quiz);
    console.log('Evaluation complete:', {
      resultId: results.id,
      overallScore: results.overall.score,
      answersEvaluated: Object.keys(results.answers).length
    });

    // Save the results
    quiz.results = results;
    saveQuizData();

    return results;
  } catch (error: any) {
    console.error("Error submitting quiz answers:", error);
    throw new Error(`Failed to submit quiz answers: ${error.message}`);
  }
}

/**
 * Gets quiz results by ID
 * @param resultId Result ID
 * @returns The quiz result data
 */
export async function getQuizResults(resultId: string): Promise<QuizResult> {
  const quiz = quizStore[resultId];
  if (!quiz || !quiz.results) {
    throw new Error("Quiz results not found");
  }

  const questions = quiz.questions.map(q => ({
    id: q.id,
    text: q.text,
    type: (q.type === "multipleChoice" ? "multipleChoice" : 
           q.category === "Knowledge" ? "knowledge" :
           q.category === "Thinking" ? "thinking" :
           q.category === "Application" ? "application" :
           "communication") as QuizQuestionType["type"],
    options: q.options,
    correctAnswer: q.answer,
    userAnswer: quiz.results?.answers[q.id]?.userAnswer || "",
    isCorrect: quiz.results?.answers[q.id]?.isCorrect || false,
    explanation: q.explanation || ""
  }));

  return {
    id: quiz.results.id,
    quizId: resultId,
    title: quiz.title,
    subject: quiz.subject,
    grade: quiz.grade,
    score: quiz.results.overall.score,
    totalQuestions: quiz.totalQuestions,
    questions: questions,
    feedback: quiz.results.overall.feedback,
    strengths: quiz.results.overall.strengths,
    areasForImprovement: quiz.results.overall.reviewTopics,
    createdAt: new Date(quiz.createdAt).toISOString()
  };
}

/**
 * Gets past quizzes for the current user
 * @returns List of past quizzes
 */
export async function getPastQuizzes() {
  try {
    return pastQuizzesStore;
  } catch (error: any) {
    console.error("Error getting past quizzes:", error);
    throw new Error(`Failed to get past quizzes: ${error.message}`);
  }
}

async function checkAnswer(questionId: string, answer: string): Promise<{ isCorrect: boolean; feedback: string; score: number }> {
  try {
    console.log(`Checking answer for question ${questionId}...`);
    
    // Get the question data
    const quiz = await getQuiz(questionId.split('-')[0]); // Extract quizId from questionId
    const question = quiz.questions.find(q => q.id === questionId);
    
    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    // Construct prompt for AI evaluation
    const prompt = `
    You are an expert ${quiz.subject} teacher evaluating a student's answer.
    
    Question: ${question.text}
    Expected Answer: ${question.answer}
    Student's Answer: ${answer}
    
    Evaluate the answer and provide a JSON response in this format:
    {
      "isCorrect": boolean,
      "feedback": "string explaining why the answer is correct or incorrect",
      "score": number between 0 and 1
    }`;

    // Get AI evaluation
    const response = await generateText(prompt, {
      temperature: 0.3,
      maxTokens: 500,
      responseFormat: "json"
    });

    // Parse the response
    const cleanResponse = response.replace(/```json\n|\n```|```/g, '').trim();
    const evaluation = JSON.parse(cleanResponse);

    // Validate the response
    if (typeof evaluation.isCorrect !== 'boolean' || 
        typeof evaluation.feedback !== 'string' || 
        typeof evaluation.score !== 'number') {
      throw new Error('Invalid evaluation response format');
    }

    return evaluation;
  } catch (error) {
    console.error('Error checking answer:', error);
    // Return a default evaluation in case of error
    return {
      isCorrect: false,
      feedback: 'Error evaluating answer. Please try again.',
      score: 0
    };
  }
}

export async function checkAnswerAction(questionId: string, studentAnswer: string, correctAnswer: string, questionType: string) {
  try {
    console.log(`Checking answer for question ${questionId}...`);
    
    if (questionType === 'multipleChoice') {
      const isCorrect = studentAnswer === correctAnswer;
      return {
        score: isCorrect ? 1 : 0,
        correct: isCorrect,
        feedback: isCorrect ? 'Correct!' : 'Incorrect. Try again!'
      };
    } else {
      // For short answer questions, use AI evaluation
      const prompt = `
      You are an expert teacher evaluating a student's answer.
      
      Question: ${questionId}
      Expected Answer: ${correctAnswer}
      Student's Answer: ${studentAnswer}
      
      Evaluate the answer and provide a JSON response in this format:
      {
        "score": number between 0 and 1,
        "correct": boolean,
        "feedback": "string explaining why the answer is correct or incorrect"
      }`;

      const response = await generateText(prompt, {
        temperature: 0.3,
        maxTokens: 500,
        responseFormat: "json"
      });

      const cleanResponse = response.replace(/```json\n|\n```|```/g, '').trim();
      return JSON.parse(cleanResponse);
    }
  } catch (error) {
    console.error('Error checking answer:', error);
    return {
      score: 0,
      correct: false,
      feedback: 'Error evaluating answer. Please try again.'
    };
  }
}