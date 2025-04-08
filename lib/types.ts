export interface QuizQuestion {
  id: string;
  text: string;
  type: "multipleChoice" | "knowledge" | "thinking" | "application" | "communication";
  options?: string[];
  correctAnswer: string;
  userAnswer?: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizResult {
  id: string;
  quizId: string;
  title: string;
  subject: string;
  grade: string;
  score: number;
  totalQuestions: number;
  questions: QuizQuestion[];
  feedback: string;
  strengths: string[];
  areasForImprovement: string[];
  createdAt: string;
} 