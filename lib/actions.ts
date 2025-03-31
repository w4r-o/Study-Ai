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

// Maximum file size in bytes (20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024

// In-memory store for quizzes during development
const quizStore: { [key: string]: QuizData } = {};

// In-memory store for past quizzes
const pastQuizzesStore: {
  id: string;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  createdAt: string;
  totalQuestions: number;
}[] = [];

interface QuizQuestion {
  id: string;
  text: string;
  type: "multipleChoice" | "shortAnswer";
  category: "Multiple Choice" | "Knowledge" | "Thinking" | "Application" | "Communication";
  options?: string[];
  answer: string;
  explanation?: string;
  rubric?: string; // For short answer questions
}

interface QuizData {
  title: string;
  subject: string;
  grade: string;
  topic: string;
  questions: QuizQuestion[];
  createdAt: number;
  totalQuestions: number;
}

// Helper function to escape LaTeX in JSON
function escapeLatexForJson(text: string) {
  return text.replace(/\\/g, '\\\\');
}

// Helper function to clear quiz store
function clearQuizStore() {
  Object.keys(quizStore).forEach(key => {
    delete quizStore[key];
  });
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
    
    // Clear previous quiz data
    clearQuizStore();
    console.log("Cleared previous quiz data");
    
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
        totalCharacters += text.length;
        console.log(`- Extracted ${text.length} characters`);
        notesText.push(text);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        throw new Error(`Failed to process ${file.name}. Please ensure it's a valid PDF.`);
      }
    }
    
    console.log(`\nTotal characters extracted: ${totalCharacters}`);

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
    
    const prompt = `
    You are a mathematics teacher at York Region District School Board creating a Grade ${grade} test.
    
    CRITICAL: You MUST generate questions according to this exact distribution:
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
        },
        {
          "id": "2",
          "type": "shortAnswer",
          "category": "Knowledge",
          "text": "Knowledge question text",
          "answer": "Expected answer points",
          "rubric": "Clear grading criteria",
          "explanation": "Detailed solution"
        }
      ]
    }

    STRICT REQUIREMENTS:
    1. Generate EXACTLY the specified number of questions for each category
    2. For multiple choice questions:
       - Each option MUST start with A), B), C), or D)
       - Options MUST be unique (no duplicates)
       - Answer MUST match one option exactly
    3. For short answer questions:
       - Include clear grading criteria
       - Specify expected key points
       - Match the question style to its category
    4. Use actual mathematical symbols (≠, ≤, ≥, ∞, ∈, ℝ)
    5. Questions MUST be based on the notes provided
    `;

    let quizText = await generateText(prompt, {
      temperature: 0.3,
      maxTokens: 5000
    });

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
      
      if (quiz.questions.length !== numQuestions) {
        console.error(`Question count mismatch: expected ${numQuestions}, got ${quiz.questions.length}`);
        throw new Error("Generated quiz has incorrect number of questions");
      }

      // Update validation to check category counts
      const questionsByCategory = {
        multipleChoice: quiz.questions.filter(q => q.type === "multipleChoice").length,
        knowledge: quiz.questions.filter(q => q.type === "shortAnswer" && q.category === "Knowledge").length,
        thinking: quiz.questions.filter(q => q.type === "shortAnswer" && q.category === "Thinking").length,
        application: quiz.questions.filter(q => q.type === "shortAnswer" && q.category === "Application").length,
        communication: quiz.questions.filter(q => q.type === "shortAnswer" && q.category === "Communication").length
      };

      if (questionsByCategory.multipleChoice !== multipleChoice ||
          questionsByCategory.knowledge !== knowledge ||
          questionsByCategory.thinking !== thinking ||
          questionsByCategory.application !== application ||
          questionsByCategory.communication !== communication) {
        console.error("Question distribution mismatch:", {
          expected: {
            multipleChoice,
            knowledge,
            thinking,
            application,
            communication
          },
          actual: questionsByCategory
        });
        throw new Error("Generated quiz has incorrect question distribution");
      }

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
    Respond with ONLY ONE of these subjects: Mathematics, Physics, Chemistry, Biology, History, English, Geography, Computer Science
    Do not include any other text, formatting, or punctuation.
    
    Notes:
    ${notesText.substring(0, 2000)}
  `;

  try {
    const response = await generateText(subjectPrompt, {
      temperature: 0.3,
      maxTokens: 100
    });
    
    const subject = response.replace(/['".,]/g, '').trim();
    console.log("Determined subject:", subject);
    
    return subject || "Mathematics";
  } catch (error) {
    console.error("Error determining subject:", error);
    return "Mathematics";
  }
}

/**
 * Determines the specific topic of the notes
 */
async function determineTopic(notesText: string, subject: string): Promise<string> {
  const topicPrompt = `
    You are a YRDSB high school teacher. Analyze these ${subject} notes and determine the specific unit and topic.

    
    Format your response EXACTLY as:
    ${subject}
    Unit: [Find the component of study which forms part of your course an example would be Mathematics > Algebra > Linear Functions]
    Topic: [Specific topic within that unit]
    Subtopic: [Specific concept being covered]
    
    Example responses:
    Mathematics
    Unit: Functions
    Topic: Exponential Functions
    Subtopic: Growth and Decay Applications
    
    Mathematics
    Unit: Algebra
    Topic: Polynomial Functions
    Subtopic: Factoring Trinomials
    
    Requirements: - MUST FOLLOW THESE
    1. Unit MUST be specific like a break down of Functions > Exponential Functions > Growth and Decay Applications like how I did NEVER classify as "General Mathematics" MUST BE SPECIFIC
    2. Topic should be specific but standardized
    3. Subtopic should detail the exact concepts covered
    4. Use official curriculum terminology
    5. Be as specific as possible while remaining accurate
    
    Analyze these notes and respond ONLY in the format shown above:
    
    ${notesText.substring(0, 3000)}
  `;

  try {
    const response = await generateText(topicPrompt, {
      temperature: 0.3,
      maxTokens: 3000
    });
    
    // Clean up response and extract components
    const cleanResponse = response.replace(/['"]/g, '').trim();
    console.log("\nRaw topic determination:", cleanResponse);
    
    // Extract unit, topic, and subtopic using regex
    const unitMatch = cleanResponse.match(/Unit:\s*([^\n]+)/);
    const topicMatch = cleanResponse.match(/Topic:\s*([^\n]+)/);
    const subtopicMatch = cleanResponse.match(/Subtopic:\s*([^\n]+)/);
    
    const unit = unitMatch ? unitMatch[1].trim() : '';
    const topic = topicMatch ? topicMatch[1].trim() : '';
    const subtopic = subtopicMatch ? subtopicMatch[1].trim() : '';
    
    console.log("Extracted components:");
    console.log("- Unit:", unit);
    console.log("- Topic:", topic);
    console.log("- Subtopic:", subtopic);
    
    // If we couldn't extract the components, try keyword extraction
    if (!unit || !topic) {
      console.log("\nFalling back to keyword extraction...");
      const keywords = extractTopicKeywords(notesText, subject);
      if (keywords) {
        console.log("Found keywords:", keywords);
        return keywords;
      }
      return `General ${subject}`;
    }
    
    // Combine components into a descriptive topic
    let fullTopic = unit;
    if (topic && topic !== unit) {
      fullTopic += ` - ${topic}`;
    }
    if (subtopic && subtopic !== topic) {
      fullTopic += ` (${subtopic})`;
    }
    
    console.log("Final topic:", fullTopic);
    return cleanupTopic(fullTopic);
  } catch (error) {
    console.error("Error in topic determination:", error);
    return `General ${subject}`;
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
    // Get quiz from memory store
    const quiz = quizStore[id];
    if (!quiz) {
      console.error("Quiz not found in store for ID:", id);
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
      questionCount: quiz.questions.length,
      firstQuestion: quiz.questions[0]
    });
    
    return quiz;
  } catch (error: any) {
    console.error("Error getting quiz:", error);
    throw new Error(`Failed to get quiz: ${error.message}`);
  }
}

/**
 * Submits quiz answers and generates results
 * @param quizId Quiz ID
 * @param answers User's answers
 * @returns The ID of the quiz result
 */
export async function submitQuizAnswers(quizId: string, answers: Record<string, string>) {
  try {
    // Mock implementation for development
    console.log("Mock quiz submission for ID:", quizId);
    console.log("Answers:", answers);
    
    // Simple explanation generation with DeepSeek can go here in the future
    
    return `mock-result-${Date.now()}`;
  } catch (error: any) {
    console.error("Error submitting quiz:", error);
    throw new Error(`Failed to submit quiz: ${error.message}`);
  }
}

/**
 * Gets quiz results by ID
 * @param resultId Result ID
 * @returns The quiz result data
 */
export async function getQuizResults(resultId: string) {
  try {
    // Mock implementation for development
    console.log("Mock getting quiz results for ID:", resultId);
    return {
      id: resultId,
      quizId: "mock-quiz-id",
      title: "Mock Quiz",
      subject: "Mathematics",
      grade: "11",
      score: 8,
      totalQuestions: 10,
      questions: [],
    };
  } catch (error: any) {
    console.error("Error getting quiz results:", error);
    throw new Error(`Failed to get quiz results: ${error.message}`);
  }
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