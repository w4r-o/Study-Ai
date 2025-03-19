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

// Maximum file size in bytes (20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024

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

  // Validate file size
  const validateFileSize = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File "${file.name}" is too large. Maximum file size is 20MB.`)
    }
  }

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError(null)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        const newFiles = Array.from(e.dataTransfer.files).filter(
          (file) => file.type === "application/pdf" || file.name.endsWith(".pdf"),
        )

        if (newFiles.length === 0) {
          setError("Please upload PDF files only")
          return
        }

        // Validate file sizes
        newFiles.forEach(validateFileSize)

        setFiles((prevFiles) => [...prevFiles, ...newFiles])
      } catch (error: any) {
        setError(error.message)
      }
    }
  }

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    if (e.target.files && e.target.files.length > 0) {
      try {
        const newFiles = Array.from(e.target.files).filter(
          (file) => file.type === "application/pdf" || file.name.endsWith(".pdf"),
        )

        if (newFiles.length === 0) {
          setError("Please upload PDF files only")
          return
        }

        // Validate file sizes
        newFiles.forEach(validateFileSize)

        setFiles((prevFiles) => [...prevFiles, ...newFiles])
      } catch (error: any) {
        setError(error.message)
      }
    }
  }

  // Handle past test file change
  const handlePastTestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    if (e.target.files && e.target.files.length > 0) {
      try {
        const file = e.target.files[0]
        if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
          setError("Please upload a PDF file for the past test")
          return
        }

        // Validate file size
        validateFileSize(file)

        setPastTestUploaded(file)
      } catch (error: any) {
        setError(error.message)
      }
    }
  }

  // Remove file from the list
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

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="files"
          multiple
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <label htmlFor="files" className="cursor-pointer">
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Drag and drop your PDF files here, or click to select files
          </p>
          <p className="text-xs text-muted-foreground mt-1">Maximum file size: 20MB</p>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <Label>Uploaded Files</Label>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                <div className="flex items-center space-x-2">
                  <FileType className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{file.name}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Test Upload */}
      <div className="space-y-2">
        <Label>Past Test (Optional)</Label>
        <div className="flex items-center space-x-2">
          <Input
            type="file"
            accept=".pdf"
            onChange={handlePastTestChange}
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}>
            Upload
          </Button>
        </div>
        {pastTestUploaded && (
          <div className="flex items-center justify-between p-2 bg-muted rounded-md">
            <div className="flex items-center space-x-2">
              <FileType className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{pastTestUploaded.name}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={removePastTest}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Grade Selection */}
      <div className="space-y-2">
        <Label htmlFor="grade">Grade</Label>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger>
            <SelectValue placeholder="Select your grade" />
          </SelectTrigger>
          <SelectContent>
            {[9, 10, 11, 12].map((grade) => (
              <SelectItem key={grade} value={grade.toString()}>
                Grade {grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Question Distribution */}
      <div className="space-y-4">
        <Label>Question Distribution</Label>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="multipleChoice">Multiple Choice</Label>
              <span>{questionDistribution.multipleChoice}</span>
            </div>
            <Slider
              id="multipleChoice"
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
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isUploading || files.length === 0 || !grade}>
        {isUploading ? "Creating Quiz..." : "Generate Practice Test"}
      </Button>
    </form>
  )
}

