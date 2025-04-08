import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FileX } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileX className="h-6 w-6 text-muted-foreground" />
            Quiz Results Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The quiz results you're looking for could not be found. This might happen if:
          </p>
          <ul className="mt-4 list-disc pl-5 text-muted-foreground">
            <li>The quiz has been deleted</li>
            <li>The quiz hasn't been completed yet</li>
            <li>The URL is incorrect</li>
          </ul>
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