/**
 * Past quizzes display component
 * 
 * Key Functions:
 * - fetchQuizzes: Loads user's quiz history
 * - renderQuizCard: Displays individual quiz info
 * 
 * Integrations:
 * - Supabase Database
 * 
 * Used By:
 * - app/page.tsx
 * 
 * Dependencies:
 * - lib/actions.ts
 * - components/ui/*
 */

"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, Clock, ArrowRight } from "lucide-react"
import { getPastQuizzes } from "@/lib/actions"
import Link from "next/link"

type Quiz = {
  id: string
  title: string
  createdAt: string
  subject: string
  grade: string
  score?: number
  totalQuestions: number
}

export function PastMaterials() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true);
    
    getPastQuizzes()
      .then((data) => {
        setQuizzes(data);
      })
      .catch((error) => {
        console.error("Error fetching past quizzes:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  if (quizzes.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No past materials found</h3>
        <p className="text-sm text-muted-foreground mb-6">Upload your notes to generate your first practice test</p>
        <Button asChild>
          <Link href="/">Create Your First Test</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {quizzes.map((quiz) => (
        <Card key={quiz.id}>
          <CardHeader>
            <CardTitle>{quiz.title}</CardTitle>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              <span>{new Date(quiz.createdAt).toLocaleDateString()}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Subject:</span>
                <span className="text-sm font-medium">{quiz.subject}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Grade:</span>
                <span className="text-sm font-medium">{quiz.grade}</span>
              </div>
              {quiz.score !== undefined && (
                <div className="flex justify-between">
                  <span className="text-sm">Score:</span>
                  <span className="text-sm font-medium">
                    {quiz.score}/{quiz.totalQuestions} ({Math.round((quiz.score / quiz.totalQuestions) * 100)}%)
                  </span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button asChild variant="outline">
              <Link href={`/results/${quiz.id}`}>View Results</Link>
            </Button>
            <Button asChild>
              <Link href={`/quiz/${quiz.id}`}>
                Start Quiz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

