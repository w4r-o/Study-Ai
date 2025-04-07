"use client"

import React, { useEffect, useState } from "react"
import { getQuiz, submitQuizAnswers } from "@/lib/actions"
import { use } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useTheme } from "next-themes"
import { Home, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { Chatbot } from '@/components/chat-bot'
import { ThemeToggle } from "@/components/theme-toggle"
import { useRouter } from "next/navigation"
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'

// Function to format math expressions
function formatMathText(text: string) {
  if (!text) return null;
  
  try {
    // Replace LaTeX math delimiters with appropriate HTML
    text = text.replace(/\\\[(.*?)\\\]/g, '<div class="math-display">$1</div>');
    text = text.replace(/\\\((.*?)\\\)|\$(.*?)\$/g, '<span class="math-inline">$1$2</span>');

    return <div dangerouslySetInnerHTML={{ __html: text }} />;
  } catch (error) {
    console.error('Error formatting math text:', error);
    return <div>{text}</div>;
  }
}

// Function to render text with math expressions
const renderText = (text: string) => {
  return <div className="math-text">{formatMathText(text)}</div>;
};

interface Question {
  id: string
  text: string
  type: "multipleChoice" | "shortAnswer"
  options?: string[]
  answer: string
  explanation?: string
}

interface Answer {
  text: string;
  score?: number;
  correct?: boolean;
  feedback?: string;
}

interface EvaluationResult {
  score: number
  correct: boolean
  feedback: string
}

interface QuizResults {
  id: string;
  quizId: string;
  answers: {
    [questionId: string]: {
      score: number;
      isCorrect: boolean;
      feedback: string;
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

interface Quiz {
  title: string;
  subject: string;
  grade: string;
  topic: string;
  questions: Question[];
  results?: QuizResults;
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Answer>>({});
  const [showResults, setShowResults] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  useEffect(() => {
    async function loadQuiz() {
      try {
        setLoading(true);
        setError(null);
        const quizData = await getQuiz(quizId);
        console.log("Loaded quiz data:", quizData);
        
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
  }, [quizId]);

  const ShortAnswerQuestion = ({ 
    question, 
    value, 
    onChange 
  }: { 
    question: Question, 
    value: string, 
    onChange: (value: string) => void 
  }) => {
    const [localValue, setLocalValue] = useState(value);

    // Update local value when prop value changes
    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    return (
      <div className="space-y-4">
        <div className="text-lg">{renderText(question.text)}</div>
        <label>
          <textarea
            name="answer"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => onChange(localValue)} // Only trigger onChange when user finishes typing
            rows={6}
            cols={50}
            className="w-full p-4 text-lg border rounded-lg bg-gray-800 border-gray-700 text-white"
            placeholder="Type your answer here..."
          />
        </label>
      </div>
    );
  };

  const handleAnswerSelect = async (questionId: string, answer: Answer | string) => {
    if (!quiz) return;

    const question = quiz.questions.find(q => q.id === questionId);
    if (!question) return;

    // Convert string answer to Answer type
    const answerObj = typeof answer === 'string' ? { text: answer } : answer;

    // First, update the local state immediately for better UX
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        text: answerObj.text
      }
    }));

    // For multiple choice, check immediately
    if (question.type === 'multipleChoice') {
      try {
        const response = await fetch('/api/check-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId,
            studentAnswer: answerObj.text,
            correctAnswer: question.answer,
            questionType: question.type
          })
        });

        if (!response.ok) {
          throw new Error('Failed to check answer');
        }

        const result = await response.json();
        setSelectedAnswers(prev => ({
          ...prev,
          [questionId]: {
            text: answerObj.text,
            score: result.score || 0,
            correct: result.correct || false,
            feedback: result.feedback || 'No feedback available'
          }
        }));
      } catch (error) {
        console.error('Error checking answer:', error);
        // Keep the answer text but don't update other fields yet
      }
    } else {
      // For short answer questions, just store the text without checking
      setSelectedAnswers(prev => ({
        ...prev,
        [questionId]: {
          text: answerObj.text,
          score: prev[questionId]?.score || 0,
          correct: prev[questionId]?.correct || false,
          feedback: prev[questionId]?.feedback || ''
        }
      }));
    }
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
      selectedAnswers[q.id] && selectedAnswers[q.id].correct
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

  const handleSubmitQuiz = async () => {
    if (!quiz) {
      toast({
        title: "Error",
        description: "Quiz not found",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("Starting quiz submission...");
      console.log("Quiz ID:", quizId);
      console.log("Selected answers:", selectedAnswers);

      // Format answers for submission
      const formattedAnswers = Object.entries(selectedAnswers).reduce((acc, [id, answer]) => ({
        ...acc,
        [id]: {
          text: answer.text,
          score: answer.score,
          correct: answer.correct,
          feedback: answer.feedback
        }
      }), {});

      console.log("Formatted answers:", formattedAnswers);

      // Submit all answers to the server
      const response = await fetch('/api/submit-quiz', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          quizId,
          answers: formattedAnswers
        })
      });

      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error('Failed to submit quiz: ' + errorText);
      }

      const results = await response.json();
      console.log("Received results:", results);

      // Update the quiz state with results
      setQuiz((prev: Quiz | null) => {
        if (!prev) return null;
        return {
          ...prev,
          results: results
        };
      });

      setShowResults(true);
      setShowSubmitDialog(false);

      // Show success message
      toast({
        title: "Quiz Submitted!",
        description: `Your score: ${results.overall.score}%`,
        duration: 5000
      });

    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit quiz. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
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

  if (showResults && quiz?.results) {
    return (
      <div className="container mx-auto py-8 px-4 relative min-h-screen">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>{quiz?.title}</CardTitle>
            <CardDescription>
              {quiz?.subject} - Grade {quiz?.grade}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Overall Results */}
              <div className="p-6 bg-muted rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Quiz Results</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg">Overall Score:</span>
                    <span className="text-3xl font-bold text-primary">
                      {quiz.results.overall.score}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Feedback:</h4>
                    <p className="text-base">{quiz.results.overall.feedback}</p>
                  </div>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-500 dark:text-red-400">Topics to Review:</h4>
                      <ul className="list-disc list-inside text-base space-y-1">
                        {quiz.results.overall.reviewTopics.length > 0 ? (
                          quiz.results.overall.reviewTopics.map((topic, i) => (
                            <li key={i}>{renderText(topic)}</li>
                          ))
                        ) : (
                          <li>Keep practicing the concepts you found challenging</li>
                        )}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-500 dark:text-green-400">Strengths:</h4>
                      <ul className="list-disc list-inside text-base space-y-1">
                        {quiz.results.overall.strengths.length > 0 ? (
                          quiz.results.overall.strengths.map((strength, i) => (
                            <li key={i}>{renderText(strength)}</li>
                          ))
                        ) : (
                          <li>Keep practicing to build your understanding!</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Questions */}
              {quiz?.questions.map((question, index) => (
                <div key={question.id} className="border-b pb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-2xl">
                      {selectedAnswers[question.id]?.correct ? (
                        <CheckCircle2 className="text-green-500 h-6 w-6" />
                      ) : (
                        <XCircle className="text-red-500 h-6 w-6" />
                      )}
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-lg font-medium mb-2">
                        {index + 1}. {renderText(question.text)}
                      </h3>
                      <div className="space-y-2">
                        {/* Question content */}
                        {question.type === 'multipleChoice' ? (
                          <div className="space-y-1">
                            {question.options?.map((option, idx) => (
                              <div key={idx} className="text-sm pl-4 flex items-center gap-2">
                                {selectedAnswers[question.id]?.text === option && (
                                  selectedAnswers[question.id]?.correct ? (
                                    <CheckCircle2 className="text-green-500 h-4 w-4" />
                                  ) : (
                                    <XCircle className="text-red-500 h-4 w-4" />
                                  )
                                )}
                                <span className="math-text">
                                  {renderText(option)}
                                </span>
                                {question.answer === option && (
                                  <span className="text-sm text-green-500 font-medium ml-2">
                                    (Correct Answer)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="mt-2 p-4 bg-muted rounded-lg">
                              <div className="text-sm font-medium mb-2">Your Answer:</div>
                              <div className="text-sm whitespace-pre-wrap">
                                {selectedAnswers[question.id]?.text}
                              </div>
                              <div className="text-sm font-medium mt-4 mb-2">Expected Answer:</div>
                              <div className="text-sm whitespace-pre-wrap">
                                {renderText(question.answer)}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Feedback */}
                        {selectedAnswers[question.id]?.feedback && (
                          <div className="mt-2 text-sm">
                            <span className="font-medium">Feedback: </span>
                            {selectedAnswers[question.id].feedback}
                          </div>
                        )}
                        
                        {/* Explanation */}
                        {question.explanation && (
                          <div className="mt-2 p-4 bg-muted rounded-lg">
                            <div className="text-sm font-medium mb-1">Explanation:</div>
                            <div className="text-sm">{renderText(question.explanation)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chatbot */}
        {showResults && <Chatbot quizId={quizId} />}

        {/* Theme toggle */}
        <ThemeToggle className="fixed bottom-4 left-4" />

        {/* Return Home button */}
        <Button
          variant="outline"
          onClick={() => router.push('/')}
          className="fixed bottom-4 right-4"
        >
          Return Home
        </Button>
      </div>
    );
  }

  const currentQuestionData = quiz.questions[currentQuestion];
  const progress = (currentQuestion + 1) / quiz.questions.length * 100;

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
                  value={selectedAnswers[currentQuestionData.id] && selectedAnswers[currentQuestionData.id].text || ""}
                  onValueChange={(value) => handleAnswerSelect(currentQuestionData.id, { text: value } as Answer)}
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
                value={selectedAnswers[currentQuestionData.id] && selectedAnswers[currentQuestionData.id].text || ""}
                onChange={(value) => handleAnswerSelect(currentQuestionData.id, { text: value } as Answer)}
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
                <Button 
                  onClick={handleSubmit} 
                  variant="default"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Quiz"}
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
      <ThemeToggle className="fixed bottom-4 left-4" />

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
            <AlertDialogAction 
              onClick={handleSubmitQuiz}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Anyway"}
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

      <Toaster />
    </div>
  );
}


