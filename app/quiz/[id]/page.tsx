import { getQuiz } from "@/lib/actions"
import { QuizClient } from "./quiz-client"

export default async function QuizPage({ params }: { params: { id: string } }) {
  const quizData = await getQuiz(params.id);
  
  return <QuizClient initialQuiz={quizData} quizId={params.id} />;
}


