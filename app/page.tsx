/**
 * Main landing page
 * 
 * Used By:
 * - Root application entry point
 * 
 * Dependencies:
 * - components/file-upload.tsx
 * - components/past-materials.tsx
 * - components/user-auth-form.tsx
 * - components/theme-toggle.tsx
 * - components/ui/*
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUpload } from "@/components/file-upload"
import { PastMaterials } from "@/components/past-materials"
import { UserAuthForm } from "@/components/user-auth-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, FileText, History } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <div className="flex justify-between items-center w-full mb-8">
          <h1 className="text-4xl font-bold">StudyAI</h1>
          <ThemeToggle />
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">
              <FileText className="mr-2 h-4 w-4" />
              Upload Notes
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              Past Materials
            </TabsTrigger>
            <TabsTrigger value="account">
              <BookOpen className="mr-2 h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Your Lesson Notes</CardTitle>
                <CardDescription>
                  Upload your PDF notes to generate a practice test based on your grade level and curriculum.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Past Materials</CardTitle>
                <CardDescription>View your previously generated tests and materials.</CardDescription>
              </CardHeader>
              <CardContent>
                <PastMaterials />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Manage your account settings and sign in/out.</CardDescription>
              </CardHeader>
              <CardContent>
                <UserAuthForm />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            StudyAI helps you prepare for tests by analyzing your notes and generating practice questions.
          </p>
        </div>
      </div>
    </main>
  )
}

