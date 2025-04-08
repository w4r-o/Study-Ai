import { getQuizResults } from "@/lib/actions"
import { ResultsPage } from "@/components/results-page"
import { QuizResult } from "@/lib/types"
import { notFound } from "next/navigation"

export default async function Page({ params }: { params: { id: string } }) {
  try {
    const results = await getQuizResults(params.id);
    return <ResultsPage results={results} />;
  } catch (error) {
    console.error("Error fetching quiz results:", error);
    notFound();
  }
}

