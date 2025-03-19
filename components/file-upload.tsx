"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Upload, FileType, X, AlertCircle } from "lucide-react"
import { createQuiz } from "@/lib/actions"
import { ApiKeyWarning } from "@/components/api-key-warning"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function FileUpload() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [grade, setGrade] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questionDistribution, setQuestionDistribution] = useState({
    multipleChoice: 5,
    knowledge: 3,
    thinking: 3,
    application: 2,
    communication: 2,
  })
  const [pastTestUploaded, setPastTestUploaded] = useState<File | null>(null)

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError(null)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(
        (file) => file.type === "application/pdf" || file.name.endsWith(".pdf"),
      )

      if (newFiles.length > 0) {
        setFiles((prevFiles) => [...prevFiles, ...newFiles])
      } else {
        setError("Please upload PDF files only")
      }
    }
  }

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(
        (file) => file.type === "application/pdf" || file.name.endsWith(".pdf"),
      )

      if (newFiles.length > 0) {
        setFiles((prevFiles) => [...prevFiles, ...newFiles])
      } else {
        setError("Please upload PDF files only")
      }
    }
  }

  // Handle past test file change
  const handlePastTestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        setPastTestUploaded(file)
      } else {
        setError("Please upload PDF files only")
      }
    }
  }

  // Remove file from list
  const removeFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
  }

  // Remove past test file
  const removePastTest = () => {
    setPastTestUploaded(null)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (files.length === 0) {
      setError("Please upload at least one PDF file")
      return
    }

    if (!grade) {
      setError("Please select your grade")
      return
    }

    setIsUploading(true)

    try {
      // Create FormData to send files
      const formData = new FormData()
      files.forEach((file) => {
        formData.append("notes", file)
      })

      if (pastTestUploaded) {
        formData.append("pastTest", pastTestUploaded)
      }

      formData.append("grade", grade)
      formData.append("questionDistribution", JSON.stringify(questionDistribution))

      // Call server action to process files and create quiz
      const quizId = await createQuiz(formData)

      // Redirect to the quiz page
      router.push(`/quiz/${quizId}`)
    } catch (error: any) {
      console.error("Error creating quiz:", error)
      setError(error.message || "Failed to create quiz. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ApiKeyWarning />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* PDF Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          dragActive ? "border-primary bg-primary/10" : "border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
        }}
        onDrop={handleDrop}
      >
        <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
        <h3 className="text-lg font-medium">Drag & drop your PDF notes here</h3>
        <p className="text-sm text-muted-foreground mb-4">Or click to browse files (PDF only)</p>
        <Input type="file" accept=".pdf" multiple onChange={handleFileChange} className="hidden" id="notes-upload" />
        <Button type="button" variant="outline" onClick={() => document.getElementById("notes-upload")?.click()}>
          Select Files
        </Button>
      </div>

      {/* Display uploaded files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <Label>Uploaded Notes:</Label>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-muted p-2 rounded">
                <div className="flex items-center">
                  <FileType className="h-4 w-4 mr-2" />
                  <span className="text-sm truncate max-w-[250px]">{file.name}</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Test Upload (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="past-test-upload">Upload Past Test (Optional)</Label>
        <p className="text-sm text-muted-foreground mb-2">Upload a past test to help generate similar questions</p>
        <Input type="file" accept=".pdf" onChange={handlePastTestChange} id="past-test-upload" />

        {pastTestUploaded && (
          <div className="flex items-center justify-between bg-muted p-2 rounded mt-2">
            <div className="flex items-center">
              <FileType className="h-4 w-4 mr-2" />
              <span className="text-sm truncate max-w-[250px]">{pastTestUploaded.name}</span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={removePastTest}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Grade Selection */}
      <div className="space-y-2">
        <Label htmlFor="grade">Select Your Grade</Label>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger id="grade">
            <SelectValue placeholder="Select grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="9">Grade 9</SelectItem>
            <SelectItem value="10">Grade 10</SelectItem>
            <SelectItem value="11">Grade 11</SelectItem>
            <SelectItem value="12">Grade 12</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Question Distribution */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Question Distribution</h3>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="multiple-choice">Multiple Choice</Label>
            <span>{questionDistribution.multipleChoice}</span>
          </div>
          <Slider
            id="multiple-choice"
            min={0}
            max={10}
            step={1}
            value={[questionDistribution.multipleChoice]}
            onValueChange={(value) => setQuestionDistribution({ ...questionDistribution, multipleChoice: value[0] })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="knowledge">Knowledge</Label>
            <span>{questionDistribution.knowledge}</span>
          </div>
          <Slider
            id="knowledge"
            min={0}
            max={10}
            step={1}
            value={[questionDistribution.knowledge]}
            onValueChange={(value) => setQuestionDistribution({ ...questionDistribution, knowledge: value[0] })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="thinking">Thinking</Label>
            <span>{questionDistribution.thinking}</span>
          </div>
          <Slider
            id="thinking"
            min={0}
            max={10}
            step={1}
            value={[questionDistribution.thinking]}
            onValueChange={(value) => setQuestionDistribution({ ...questionDistribution, thinking: value[0] })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="application">Application</Label>
            <span>{questionDistribution.application}</span>
          </div>
          <Slider
            id="application"
            min={0}
            max={10}
            step={1}
            value={[questionDistribution.application]}
            onValueChange={(value) => setQuestionDistribution({ ...questionDistribution, application: value[0] })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="communication">Communication</Label>
            <span>{questionDistribution.communication}</span>
          </div>
          <Slider
            id="communication"
            min={0}
            max={10}
            step={1}
            value={[questionDistribution.communication]}
            onValueChange={(value) => setQuestionDistribution({ ...questionDistribution, communication: value[0] })}
          />
        </div>
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isUploading || files.length === 0 || !grade}>
        {isUploading ? "Creating Quiz..." : "Generate Practice Test"}
      </Button>
    </form>
  )
}

