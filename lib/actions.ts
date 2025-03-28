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
 * - OpenAI API
 * - Supabase Database
 * 
 * Used By:
 * - components/file-upload.tsx
 * - components/past-materials.tsx
 * 
 * Dependencies:
 * - lib/pdf-utils.ts
 * - lib/auth.ts
 * - lib/supabase/server.ts
 */

"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { extractTextFromPDF } from "@/lib/pdf-utils"
import { getAIModel, isAIConfigured } from "@/lib/ai-utils"

// Maximum file size in bytes (20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024

/**
 * Creates a new quiz based on uploaded notes
 * @param formData Form data containing notes, grade, and question distribution
 * @returns The ID of the created quiz
 */
export async function createQuiz(formData: FormData): Promise<string> {
  try {
    // Get the current user
    const user = await auth.getCurrentUser()

    // For development/testing, create a mock user if not logged in
    if (!user) {
      console.log("No authenticated user found, using mock user for development")
      // Mock user ID for development
      const mockUserId = "mock-user-id"

      // Check for notes files
      const notesFiles = formData.getAll("notes") as File[]
      if (notesFiles.length === 0) {
        throw new Error("No notes files were uploaded")
      }

      // Check grade is valid (must be one of 9, 10, 11, 12)
      const grade = formData.get("grade") as string
      if (!["9", "10", "11", "12"].includes(grade)) {
        throw new Error("Invalid grade selected. Please select a grade between 9 and 12.")
      }

      // Check files for size limits
      for (const file of notesFiles) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `File ${file.name} exceeds the maximum file size of 20MB. Please upload a smaller file.`,
          )
        }
      }

      const pastTestFile = formData.get("pastTest") as File
      if (pastTestFile && pastTestFile.size > MAX_FILE_SIZE) {
        throw new Error(
          `Past test file ${pastTestFile.name} exceeds the maximum file size of 20MB. Please upload a smaller file.`,
        )
      }

      // Extract text from PDF files
      const notesText: string[] = []
      for (const file of notesFiles) {
        try {
          const text = await extractTextFromPDF(file)
          notesText.push(text)
        } catch (error) {
          throw new Error(`Failed to extract text from ${file.name}. Please ensure it's a valid PDF.`)
        }
      }

      let pastTestText = ""
      if (pastTestFile) {
        try {
          pastTestText = await extractTextFromPDF(pastTestFile)
          console.log("chatgpt has read the past test pdf")
        } catch (error) {
          throw new Error(`Failed to extract text from past test file. Please ensure it's a valid PDF.`)
        }
      }

      // Parse question distribution
      const distributionString = formData.get("questionDistribution") as string
      const questionDistribution = JSON.parse(distributionString)

      // Check if AI is properly configured
      if (!isAIConfigured()) {
        throw new Error("AI service is not configured. Please check your environment variables.")
      }

      // Configure OpenAI
      const configuration = {
        apiKey: process.env.OPENAI_API_KEY,
      }

      // Determine subject using AI
      const subject = await determineSubject(notesText.join("\n"))

      // Generate quiz questions
      const totalQuestions =
        questionDistribution.multipleChoice +
        questionDistribution.knowledge +
        questionDistribution.thinking +
        questionDistribution.application +
        questionDistribution.communication

      const quizPrompt = `
        Create a practice test based on the following notes for a Grade ${grade} student studying ${subject} and the YRDSB cirriculum for the grade.
        
        Notes:
        ${notesText.join("\n")}
        
        ${pastTestFile ? `Past Test for Reference:\n${pastTestText}` : ""}
        
        Generate a quiz with exactly ${totalQuestions} questions with the following distribution:
        - Multiple Choice: ${questionDistribution.multipleChoice}
        - Knowledge: ${questionDistribution.knowledge}
        - Thinking: ${questionDistribution.thinking}
        - Application: ${questionDistribution.application}
        - Communication: ${questionDistribution.communication}
        
        Format the response as a JSON object with the following structure:
        {
          "title": "Quiz title based on the content",
          "questions": [
            {
              "type": "multiple_choice",
              "question": "Question text",
              "options": ["A", "B", "C", "D"],
              "correctAnswer": "A",
              "explanation": "Why this is the correct answer"
            }
          ]
        }
      `

      try {
        const response = await generateText({
          model: getAIModel(),
          prompt: quizPrompt,
          temperature: 0.7,
          maxTokens: 2000,
        })

        if (!response || !response.text) {
          throw new Error("Failed to generate quiz. No response from AI.")
        }

        // Parse and validate the response
        try {
          const quiz = JSON.parse(response.text)
          if (!quiz.title || !quiz.questions || !Array.isArray(quiz.questions)) {
            throw new Error("Invalid quiz format generated. Please try again.")
          }

          // Validate question count
          if (quiz.questions.length !== totalQuestions) {
            throw new Error(`Expected ${totalQuestions} questions but got ${quiz.questions.length}. Please try again.`)
          }

          return quiz.id
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Failed to parse quiz response: ${error.message}`)
          }
          throw new Error("Failed to parse quiz response. Please try again.")
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to generate quiz using AI: ${error.message}`)
        }
        throw new Error("Failed to generate quiz using AI. Please try again.")
      }
    } else {
      // Regular flow for authenticated users
      // Extract notes from PDF files
      const notesFiles = formData.getAll("notes") as File[]
      const pastTestFile = formData.get("pastTest") as File | null
      const grade = formData.get("grade") as string
      const questionDistribution = JSON.parse(formData.get("questionDistribution") as string)

      // Validate grade level
      if (!["9", "10", "11", "12"].includes(grade)) {
        throw new Error("Invalid grade level. Please select a grade between 9 and 12.")
      }

      // Validate file sizes
      for (const file of notesFiles) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File "${file.name}" is too large. Maximum file size is 20MB.`)
        }
      }

      if (pastTestFile && pastTestFile.size > MAX_FILE_SIZE) {
        throw new Error(`Past test file "${pastTestFile.name}" is too large. Maximum file size is 20MB.`)
      }

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API key is not configured. Please add it to your environment variables.")
      }

      // Extract text from PDFs
      const notesText = await Promise.all(
        notesFiles.map(async (file) => {
          const text = await extractTextFromPDF(file)
          return text
        })
      )

      // Extract text from past test if provided
      let pastTestText = ""
      if (pastTestFile) {
        pastTestText = await extractTextFromPDF(pastTestFile)
      }

      // Determine subject using AI
      const subject = await determineSubject(notesText.join("\n"))

      // Generate quiz questions
      const totalQuestions =
        questionDistribution.multipleChoice +
        questionDistribution.knowledge +
        questionDistribution.thinking +
        questionDistribution.application +
        questionDistribution.communication

      // Create quiz prompt
      const quizPrompt = `
        Create a practice test based on the following notes for a Grade ${grade} student studying ${subject}.
        
        Notes:
        ${notesText.join("\n")}
        
        ${pastTestFile ? `Past Test for Reference:\n${pastTestText}` : ""}
        
        Generate a quiz with exactly ${totalQuestions} questions with the following distribution:
        - Multiple Choice: ${questionDistribution.multipleChoice}
        - Knowledge: ${questionDistribution.knowledge}
        - Thinking: ${questionDistribution.thinking}
        - Application: ${questionDistribution.application}
        - Communication: ${questionDistribution.communication}
        
        Format the response as a JSON object with the following structure:
        {
          "title": "Quiz title based on the content",
          "questions": [
            {
              "id": "1",
              "text": "Question text",
              "type": "multipleChoice", // or "knowledge", "thinking", "application", "communication"
              "options": ["Option A", "Option B", "Option C", "Option D"], // only for multipleChoice
              "answer": "Correct answer"
            }
          ]
        }
        
        For multiple choice questions, include 4 options and make sure the answer is one of the options.
        For other question types, provide a model answer that would receive full marks.
        
        Ensure the questions follow the Ontario curriculum for Grade ${grade} ${subject}.
      `

      const { text: quizJson } = await generateText({
        model: openai("gpt-3.5-turbo-instruct"),
        prompt: quizPrompt,
      })

      // Parse the quiz JSON
      const quiz = JSON.parse(quizJson)

      // Create a new quiz in the database
      const supabase = createClient()

      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          title: quiz.title,
          subject,
          grade,
          user_id: user.id,
          question_distribution: questionDistribution,
        })
        .select()
        .single()

      if (quizError) {
        console.error("Database error creating quiz:", quizError)
        throw new Error(`Failed to create quiz in database: ${quizError.message}`)
      }

      // Insert questions
      const questionsToInsert = quiz.questions.map((q: any) => ({
        quiz_id: quizData.id,
        text: q.text,
        type: q.type,
        options: q.options || null,
        answer: q.answer,
      }))

      const { error: questionsError } = await supabase.from("questions").insert(questionsToInsert)

      if (questionsError) {
        console.error("Database error creating questions:", questionsError)
        throw new Error(`Failed to create questions in database: ${questionsError.message}`)
      }

      return quizData.id
    }
  } catch (error: any) {
    console.error("Error in createQuiz:", error)
    throw new Error(error.message || "An unexpected error occurred while creating the quiz.")
  }
}

/**
 * Gets a quiz by ID
 * @param id Quiz ID
 * @returns The quiz data
 */
export async function getQuiz(id: string) {
  try {
    const supabase = createClient()

    // Get the quiz
    const { data: quiz, error: quizError } = await supabase.from("quizzes").select("*").eq("id", id).single()

    if (quizError) {
      throw new Error(`Failed to get quiz: ${quizError.message}`)
    }

    // Get the questions
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", id)
      .order("id")

    if (questionsError) {
      throw new Error(`Failed to get questions: ${questionsError.message}`)
    }

    return {
      id: quiz.id,
      title: quiz.title,
      subject: quiz.subject,
      grade: quiz.grade,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        options: q.options,
      })),
    }
  } catch (error: any) {
    console.error("Error getting quiz:", error)
    throw new Error(`Failed to get quiz: ${error.message}`)
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
    const user = await auth.getCurrentUser()

    if (!user) {
      throw new Error("You must be logged in to submit a quiz")
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured. Please add it to your environment variables.")
    }

    const supabase = createClient()

    // Get the quiz
    const { data: quiz, error: quizError } = await supabase.from("quizzes").select("*").eq("id", quizId).single()

    if (quizError) {
      throw new Error(`Failed to get quiz: ${quizError.message}`)
    }

    // Get the questions with answers
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("id")

    if (questionsError) {
      throw new Error(`Failed to get questions: ${questionsError.message}`)
    }

    // Generate explanations and grade answers
    const questionsWithUserAnswers = questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options,
      correctAnswer: q.answer,
      userAnswer: answers[q.id] || "",
    }))

    const explanationPrompt = `
      You are a helpful tutor. For each of the following questions, evaluate the student's answer and provide:
      1. Whether the answer is correct or incorrect
      2. A detailed explanation of why the answer is correct or incorrect
      3. For incorrect answers, explain the correct approach
      
      Questions and Answers:
      ${questionsWithUserAnswers
        .map(
          (q, i) => `
        Question ${i + 1} (${q.type}): ${q.text}
        ${q.options ? `Options: ${JSON.stringify(q.options)}` : ""}
        Correct Answer: ${q.correctAnswer}
        Student's Answer: ${q.userAnswer || "(No answer provided)"}
      `,
        )
        .join("\n\n")}
      
      Format your response as a JSON array with the following structure:
      [
        {
          "id": "question_id",
          "isCorrect": true/false,
          "explanation": "Detailed explanation"
        }
      ]
    `

    const { text: explanationsJson } = await generateText({
      model: openai("gpt-3.5-turbo-instruct"),
      prompt: explanationPrompt,
    })

    const explanations = JSON.parse(explanationsJson)

    // Calculate score
    const score = explanations.filter((e: any) => e.isCorrect).length

    // Create result in database
    const { data: result, error: resultError } = await supabase
      .from("quiz_results")
      .insert({
        quiz_id: quizId,
        user_id: user.id,
        score,
        total_questions: questions.length,
      })
      .select()
      .single()

    if (resultError) {
      throw new Error(`Failed to create result: ${resultError.message}`)
    }

    // Insert answer details
    const answersToInsert = questionsWithUserAnswers.map((q, i) => {
      const explanation = explanations.find((e: any) => e.id === q.id)

      return {
        result_id: result.id,
        question_id: q.id,
        user_answer: q.userAnswer,
        is_correct: explanation?.isCorrect || false,
        explanation: explanation?.explanation || "No explanation provided",
      }
    })

    const { error: answersError } = await supabase.from("answer_details").insert(answersToInsert)

    if (answersError) {
      throw new Error(`Failed to save answers: ${answersError.message}`)
    }

    return result.id
  } catch (error: any) {
    console.error("Error submitting quiz:", error)
    throw new Error(`Failed to submit quiz: ${error.message}`)
  }
}

/**
 * Gets quiz results by ID
 * @param resultId Result ID
 * @returns The quiz result data
 */
export async function getQuizResults(resultId: string) {
  try {
    const supabase = createClient()

    // Get the result
    const { data: result, error: resultError } = await supabase
      .from("quiz_results")
      .select(`
        *,
        quiz:quiz_id (
          id,
          title,
          subject,
          grade
        )
      `)
      .eq("id", resultId)
      .single()

    if (resultError) {
      throw new Error(`Failed to get result: ${resultError.message}`)
    }

    // Get the answer details with questions
    const { data: answerDetails, error: detailsError } = await supabase
      .from("answer_details")
      .select(`
        *,
        question:question_id (
          id,
          text,
          type,
          options,
          answer
        )
      `)
      .eq("result_id", resultId)
      .order("id")

    if (detailsError) {
      throw new Error(`Failed to get answer details: ${detailsError.message}`)
    }

    // Format the response
    return {
      id: result.id,
      quizId: result.quiz_id,
      title: result.quiz.title,
      subject: result.quiz.subject,
      grade: result.quiz.grade,
      score: result.score,
      totalQuestions: result.total_questions,
      questions: answerDetails.map((detail) => ({
        id: detail.question.id,
        text: detail.question.text,
        type: detail.question.type,
        options: detail.question.options,
        userAnswer: detail.user_answer,
        correctAnswer: detail.question.answer,
        isCorrect: detail.is_correct,
        explanation: detail.explanation,
      })),
    }
  } catch (error: any) {
    console.error("Error getting quiz results:", error)
    throw new Error(`Failed to get quiz results: ${error.message}`)
  }
}

/**
 * Gets past quizzes for the current user
 * @returns List of past quizzes
 */
export async function getPastQuizzes() {
  try {
    const user = await auth.getCurrentUser()

    if (!user) {
      return []
    }

    const supabase = createClient()

    // Get quizzes created by the user
    const { data: quizzes, error: quizzesError } = await supabase
      .from("quizzes")
      .select(`
        id,
        title,
        subject,
        grade,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (quizzesError) {
      throw new Error(`Failed to get quizzes: ${quizzesError.message}`)
    }

    // Get the latest result for each quiz
    const quizzesWithResults = await Promise.all(
      quizzes.map(async (quiz) => {
        const { data: result, error: resultError } = await supabase
          .from("quiz_results")
          .select("id, score, total_questions")
          .eq("quiz_id", quiz.id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          id: quiz.id,
          title: quiz.title,
          subject: quiz.subject,
          grade: quiz.grade,
          createdAt: quiz.created_at,
          score: result?.score,
          totalQuestions: result?.total_questions || 0,
          resultId: result?.id,
        }
      }),
    )

    return quizzesWithResults
  } catch (error: any) {
    console.error("Error getting past quizzes:", error)
    throw new Error(`Failed to get past quizzes: ${error.message}`)
  }
}

/**
 * Determines the subject of the notes using AI
 */
async function determineSubject(notesText: string): Promise<string> {
  const subjectPrompt = `
    Based on the following notes, determine the academic subject. 
    Respond with only the subject name (e.g., "Mathematics", "Biology", "History", etc.).
    
    Notes:
    ${notesText.substring(0, 2000)}
  `

  const { text: subject } = await generateText({
    model: getAIModel(),
    prompt: subjectPrompt,
  })

  return subject
}

/**
 * Generates explanation for a question answer
 */
async function generateExplanation(
  question: string,
  options: string[],
  userAnswer: string,
  correctAnswer: string,
  isCorrect: boolean,
  subject: string,
  grade: string,
): Promise<string> {
  const optionsText = options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}`).join("\n")

  const prompt = `
    I'm a Grade ${grade} student studying ${subject}.
    
    Here's a question from my recent test:
    
    Question: ${question}
    
    Options:
    ${optionsText}
    
    I chose: ${userAnswer}
    The correct answer is: ${correctAnswer}
    
    Please provide a clear explanation for why the correct answer is right${
      !isCorrect ? " and why my answer is wrong" : ""
    }. Keep your explanation concise, educational, and at the appropriate level for a Grade ${grade} student.
  `

  try {
    const { text } = await generateText({
      model: getAIModel(),
      prompt,
      temperature: 0.7,
    })

    return text
  } catch (error) {
    console.error("Error generating explanation:", error)
    return "Sorry, I couldn't generate an explanation at this time."
  }
}

