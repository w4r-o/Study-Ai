"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getQuizResults } from "@/lib/actions"
import { CheckCircle, XCircle, ArrowRight, BookOpen, Home } from "lucide-react"
import Link from "next/link"

type QuestionResult = {
  id: string
  text: string
  type: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string
  options?: string[]
}

type QuizResult = {
  id: string
  quizId: string
  title: string
  subject: string
  grade: string
  score: number
  totalQuestions: number
  questions: QuestionResult[]
}

export default function ResultsPage({ params }: { params: { id: string } }) {
  const [result, setResult] = useState<QuizResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "review">("overview")

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const resultData = await getQuizResults(params.id)
        setResult(resultData)
      } catch (error) {
        console.error("Error fetching quiz results:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-center">Loading Results...</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={50} className="w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-center">Results Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              The quiz results you are looking for do not exist or have been removed.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/">Return Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const scorePercentage = Math.round((result.score / result.totalQuestions) * 100)
  const correctQuestions = result.questions.filter((q) => q.isCorrect)
  const incorrectQuestions = result.questions.filter((q) => !q.isCorrect)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>{result.title} - Results</CardTitle>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              {result.subject} - Grade {result.grade}
            </span>
          </div>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "overview" | "review")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="review">Review & Learn</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CardContent>
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">{scorePercentage}%</div>
                  <div className="text-sm text-muted-foreground mb-4">
                    You scored {result.score} out of {result.totalQuestions} questions
                  </div>
                  <Progress value={scorePercentage} className="w-full h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{correctQuestions.length}</div>
                      <div className="text-sm text-muted-foreground">Correct</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{incorrectQuestions.length}</div>
                      <div className="text-sm text-muted-foreground">Incorrect</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Question Type Breakdown</h3>

                  {["multipleChoice", "knowledge", "thinking", "application", "communication"].map((type) => {
                    const typeQuestions = result.questions.filter((q) => q.type === type)
                    const typeCorrect = typeQuestions.filter((q) => q.isCorrect)
                    const typePercentage =
                      typeQuestions.length > 0 ? Math.round((typeCorrect.length / typeQuestions.length) * 100) : 0

                    if (typeQuestions.length === 0) return null

                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                          <span>
                            {typeCorrect.length}/{typeQuestions.length} ({typePercentage}%)
                          </span>
                        </div>
                        <Progress value={typePercentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button asChild variant="outline">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Link>
              </Button>
              <Button onClick={() => setActiveTab("review")}>
                Review & Learn
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </TabsContent>

          <TabsContent value="review">
            <CardContent>
              <div className="space-y-8">
                <h3 className="text-lg font-medium">Review Your Answers</h3>

                {result.questions.map((question, index) => (
                  <div key={question.id} className="space-y-4 border-b pb-6 last:border-0">
                    <div className="flex items-start gap-2">
                      <div className={`mt-1 flex-shrink-0 ${question.isCorrect ? "text-green-500" : "text-red-500"}`}>
                        {question.isCorrect ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm px-2 py-0.5 bg-primary/10 text-primary rounded-md">
                            {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
                          </span>
                          <span className="text-sm text-muted-foreground">Question {index + 1}</span>
                        </div>
                        <h4 className="text-base font-medium mb-2">{question.text}</h4>

                        {question.type === "multipleChoice" && question.options ? (
                          <div className="space-y-2 mb-4">
                            {question.options.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className={`p-2 rounded-md ${
                                  option === question.correctAnswer
                                    ? "bg-green-100 border border-green-200"
                                    : option === question.userAnswer && option !== question.correctAnswer
                                      ? "bg-red-100 border border-red-200"
                                      : "bg-muted"
                                }`}
                              >
                                {option}
                                {option === question.correctAnswer && (
                                  <span className="ml-2 text-green-600 text-sm">(Correct Answer)</span>
                                )}
                                {option === question.userAnswer && option !== question.correctAnswer && (
                                  <span className="ml-2 text-red-600 text-sm">(Your Answer)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2 mb-4">
                            <div className="p-2 rounded-md bg-muted">
                              <div className="text-sm font-medium mb-1">Your Answer:</div>
                              <div>{question.userAnswer || "(No answer provided)"}</div>
                            </div>

                            <div className="p-2 rounded-md bg-green-100 border border-green-200">
                              <div className="text-sm font-medium mb-1">Correct Answer:</div>
                              <div>{question.correctAnswer}</div>
                            </div>
                          </div>
                        )}

                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-md">
                          <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">Explanation</span>
                          </div>
                          <div className="text-sm">{question.explanation}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("overview")}>
                Back to Overview
              </Button>
              <Button asChild>
                <Link href={`/quiz/${result.quizId}`}>
                  Retry Quiz
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}

