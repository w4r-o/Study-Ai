"use client"

import React, { useState } from "react"
import { submitQuizAnswers, checkAnswerAction } from "@/lib/actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useTheme } from "next-themes"
import { Home, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
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

interface QuizClientProps {
  initialQuiz: Quiz;
  quizId: string;
}

export function QuizClient({ initialQuiz, quizId }: QuizClientProps) {
  const [quiz, setQuiz] = useState<Quiz>(initialQuiz);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Answer>>({});
  const [showResults, setShowResults] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { theme } = useTheme();
  const router = useRouter();
  const { toast } = useToast();

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
    React.useEffect(() => {
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
            onBlur={() => onChange(localValue)}
            rows={6}
            cols={50}
            className="w-full p-4 text-lg border rounded-lg bg-gray-800 border-gray-700 text-white"
            placeholder="Type your answer here..."
          />
        </label>
      </div>
    );
  };

  const handleAnswerSelect = (questionId: string, answer: Answer | string) => {
    const question = quiz.questions.find(q => q.id === questionId);
    if (!question) return;

    const answerObj = typeof answer === 'string' ? { text: answer } : answer;

    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        text: answerObj.text
      }
    }));

    // Check answers immediately for both multiple choice and short answer questions
    checkAnswerAction(questionId, answerObj.text, question.answer, question.type, question.text)
      .then(result => {
        setSelectedAnswers(prev => ({
          ...prev,
          [questionId]: {
            text: answerObj.text,
            score: result.score || 0,
            correct: result.correct || false,
            feedback: result.feedback || 'No feedback available'
          }
        }));
      })
      .catch(error => {
        console.error('Error checking answer:', error);
      });
  };

  const goToNextQuestion = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const isQuizComplete = () => {
    return quiz.questions.every(q => selectedAnswers[q.id]);
  };

  const handleSubmit = () => {
    if (!isQuizComplete()) {
      setShowSubmitDialog(true);
    } else {
      setShowResults(true);
    }
  };

  const getUnansweredQuestions = () => {
    return quiz.questions
      .filter(q => !selectedAnswers[q.id] || !selectedAnswers[q.id].text)
      .map(q => quiz.questions.indexOf(q) + 1);
  };

  const handleSubmitQuiz = () => {
    const unansweredQuestions = getUnansweredQuestions();
    if (unansweredQuestions.length > 0) {
      setShowSubmitDialog(true);
      return;
    }
    submitQuiz();
  };

  const submitQuiz = () => {
    setIsSubmitting(true);

    const formattedAnswers = Object.entries(selectedAnswers).reduce((acc, [id, answer]) => ({
      ...acc,
      [id]: answer.text
    }), {});

    submitQuizAnswers(quizId, formattedAnswers)
      .then((results) => {
        setQuiz(prev => ({
          ...prev,
          results: results
        }));

        setShowResults(true);
        setShowSubmitDialog(false);

        toast({
          title: "Quiz Submitted!",
          description: `Your score: ${results.overall.score}%`,
          duration: 5000
        });
      })
      .catch((error) => {
        console.error('Error submitting quiz:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to submit quiz. Please try again.",
          variant: "destructive"
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (showResults && quiz.results) {
    return (
      <div className="container mx-auto py-8 px-4 relative min-h-screen">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>{quiz.title}</CardTitle>
            <CardDescription>
              {quiz.subject} - Grade {quiz.grade}
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
              {quiz.questions.map((question, index) => (
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
                  value={selectedAnswers[currentQuestionData.id]?.text || ""}
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
                value={selectedAnswers[currentQuestionData.id]?.text || ""}
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
                  onClick={handleSubmitQuiz}
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
              <p>You haven't answered the following questions:</p>
              <p className="font-medium mt-2">Questions {getUnansweredQuestions().join(', ')}</p>
              <p className="mt-4">Unanswered questions will be marked as incorrect. Are you sure you want to submit?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Quiz</AlertDialogCancel>
            <AlertDialogAction 
              onClick={submitQuiz}
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