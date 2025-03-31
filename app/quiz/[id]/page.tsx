"use client"

import React, { useEffect, useState, useRef } from "react"
import { getQuiz } from "@/lib/actions"
import { use } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useTheme } from "next-themes"
import { Moon, Sun, Home, Check, X, RotateCcw } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { Textarea } from "@/components/ui/textarea"
import type { ReactElement } from 'react'

interface Question {
  id: string;
  text: string;
  type: "multipleChoice" | "shortAnswer";
  options?: string[];
  answer: string;
  explanation?: string;
  rubric?: string;
}

interface Quiz {
  title: string;
  subject: string;
  grade: string;
  questions: Question[];
}

// Function to render LaTeX
function renderLatex(text: string) {
  // First handle display math with \[ \]
  text = text.replace(/\\\[(.*?)\\\]/g, (_, math) => {
    try {
      return katex.renderToString(math, { displayMode: true });
    } catch (error) {
      console.error('KaTeX display math error:', error);
      return math;
    }
  });

  // Then handle inline math with \( \) and $ $
  text = text.replace(/\\\((.*?)\\\)|\$(.*?)\$/g, (_, math1, math2) => {
    const math = math1 || math2;
    try {
      return katex.renderToString(math, { displayMode: false });
    } catch (error) {
      console.error('KaTeX inline math error:', error);
      return math;
    }
  });

  // Handle special cases like "depreciates by"
  text = text.replace(/(\w+)by(\w+)/g, '$1 by $2');
  
  return <div dangerouslySetInnerHTML={{ __html: text }} />;
}

// Function to render text with LaTeX
const renderText = (text: string): ReactElement => {
  return <div className="math-text">{renderLatex(text)}</div>;
};

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const resolvedParams = use(params);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    async function loadQuiz() {
      try {
        setLoading(true);
        setError(null);
        const quizData = await getQuiz(resolvedParams.id);
        console.log("Loaded quiz data:", quizData);
        
        // Validate quiz data
        if (!quizData || !quizData.questions || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
          throw new Error("Invalid quiz data received");
        }
        
        setQuiz(quizData);
      } catch (error) {
        console.error("Error loading quiz:", error);
        setError(error instanceof Error ? error.message : "Failed to load quiz");
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [resolvedParams.id]);

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const goToNextQuestion = () => {
    if (quiz && currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const isQuizComplete = () => {
    return quiz?.questions.every(q => selectedAnswers[q.id]) ?? false;
  };

  const handleSubmit = () => {
    if (!isQuizComplete()) {
      setShowSubmitDialog(true);
    } else {
      setShowResults(true);
    }
  };

  const calculateScore = () => {
    if (!quiz) return 0;
    const correctAnswers = quiz.questions.filter(q => 
      selectedAnswers[q.id] === q.answer
    ).length;
    return Math.round((correctAnswers / quiz.questions.length) * 100);
  };

  const handleTryAgain = async () => {
    // Here you would call the API to generate a new quiz with the same parameters
    // For now, we'll just reset the current quiz
    setSelectedAnswers({});
    setCurrentQuestion(0);
    setShowResults(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-2xl mx-4">
          <CardHeader className="text-center">
            <CardTitle>Loading quiz...</CardTitle>
            <Progress value={undefined} className="w-full mt-4" />
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-2xl mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-red-500">{error}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">Please try again or return to the home page.</p>
            <Button asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Return Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-2xl mx-4">
          <CardHeader className="text-center">
            <CardTitle>No questions available</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">The quiz appears to be empty. Please try generating a new quiz.</p>
            <Button asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Return Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showResults) {
    const score = calculateScore();
    return (
      <div className="container mx-auto py-8 px-4 relative min-h-screen">
        <Card className="max-w-4xl mx-auto mb-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{quiz.title} - Results</CardTitle>
              <span className="text-xl font-bold">Score: {score}%</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {quiz.questions.map((question, index) => {
                const isMultipleChoice = question.type === "multipleChoice";
                const isCorrect = isMultipleChoice ? 
                  selectedAnswers[question.id] === question.answer :
                  // For short answer, we'll need AI evaluation
                  false; // This will be replaced with AI evaluation

                return (
                  <div key={question.id} className="border-b pb-6 last:border-0">
                    <div className="flex items-start gap-4">
                      {isMultipleChoice ? (
                        isCorrect ? (
                          <Check className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                        ) : (
                          <X className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                        )
                      ) : (
                        <div className="w-6 h-6 mt-1 flex-shrink-0" /> // Placeholder for AI evaluation
                      )}
                      <div className="flex-grow">
                        <h3 className="text-lg font-medium mb-2">
                          {index + 1}. {renderText(question.text)}
                        </h3>
                        <div className="space-y-2">
                          {isMultipleChoice ? (
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Options:</p>
                              {question.options?.map((option, idx) => (
                                <p key={idx} className="text-sm pl-4 flex items-center gap-2">
                                  {selectedAnswers[question.id] === option && (
                                    <span className="text-sm text-muted-foreground">→ </span>
                                  )}
                                  {renderText(option)}
                                  {showResults && question.answer === option && (
                                    <span className="text-sm text-muted-foreground ml-2">(Correct Answer)</span>
                                  )}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="mt-2 p-4 bg-muted rounded-lg">
                                <p className="text-sm font-medium mb-2">Your Answer:</p>
                                <p className="text-sm whitespace-pre-wrap">{selectedAnswers[question.id]}</p>
                                <p className="text-sm font-medium mt-4 mb-2">Expected Answer:</p>
                                <p className="text-sm whitespace-pre-wrap">{renderText(question.answer)}</p>
                                {question.rubric && (
                                  <>
                                    <p className="text-sm font-medium mt-4 mb-2">Grading Rubric:</p>
                                    <p className="text-sm whitespace-pre-wrap">{renderText(question.rubric)}</p>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                          {question.explanation && (
                            <div className="mt-2 p-4 bg-muted rounded-lg">
                              <p className="text-sm font-medium mb-1">Explanation:</p>
                              <p className="text-sm">{renderText(question.explanation)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
          <Button onClick={handleTryAgain} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button asChild>
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Return Home
            </Link>
          </Button>
        </div>

        {/* Theme toggle */}
        <div className="fixed bottom-4 right-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestionData = quiz.questions[currentQuestion];
  const progress = (currentQuestion + 1) / quiz.questions.length * 100;

  const ShortAnswerQuestion = ({ 
    question, 
    value, 
    onChange 
  }: { 
    question: Question, 
    value: string, 
    onChange: (value: string) => void 
  }) => {
    return (
      <div className="space-y-4">
        <div className="text-lg">{renderLatex(question.text)}</div>
        <label>
          <textarea
            name="answer"
            defaultValue={value}
            onBlur={(e) => onChange(e.target.value)}
            rows={6}
            cols={50}
            className="w-full p-4 text-lg border rounded-lg bg-gray-800 border-gray-700 text-white"
            placeholder="Type your answer here..."
          />
        </label>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 relative min-h-screen">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center mb-4">
            <CardTitle>{quiz.title}</CardTitle>
            <span className="text-sm text-gray-500">
              Question {currentQuestion + 1} of {quiz.questions.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-8">
            {currentQuestionData.type === "multipleChoice" ? (
              <>
                <div className="text-lg font-medium">
                  {renderText(currentQuestionData.text)}
                </div>
                <RadioGroup
                  value={selectedAnswers[currentQuestionData.id] || ""}
                  onValueChange={(value) => handleAnswerSelect(currentQuestionData.id, value)}
                  className="space-y-4"
                >
                  {currentQuestionData.options?.map((option, index) => (
                    <div 
                      key={index} 
                      className="flex items-center space-x-3 p-3 rounded-lg transition-colors hover:bg-muted"
                    >
                      <RadioGroupItem
                        value={option}
                        id={`option-${index}`}
                        className="w-5 h-5"
                      />
                      <Label htmlFor={`option-${index}`} className="text-base flex-grow">
                        {renderText(option)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </>
            ) : (
              <ShortAnswerQuestion
                question={currentQuestionData}
                value={selectedAnswers[currentQuestionData.id] || ""}
                onChange={(value) => handleAnswerSelect(currentQuestionData.id, value)}
              />
            )}
            <div className="flex justify-between pt-6">
              <Button
                onClick={goToPreviousQuestion}
                disabled={currentQuestion === 0}
                variant="outline"
              >
                Previous
              </Button>
              {currentQuestion === quiz.questions.length - 1 ? (
                <Button onClick={handleSubmit} variant="default">
                  Submit Quiz
                </Button>
              ) : (
                <Button onClick={goToNextQuestion}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme toggle */}
      <div className="fixed bottom-4 right-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>

      {/* Home button */}
      <div className="fixed bottom-4 left-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowLeaveDialog(true)}
        >
          <Home className="h-5 w-5" />
        </Button>
      </div>

      {/* Submit confirmation dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Incomplete Quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              You haven't answered all questions. Are you sure you want to submit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowSubmitDialog(false);
              setShowResults(true);
            }}>
              Submit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave confirmation dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress will not be saved. Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link href="/">Leave</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


