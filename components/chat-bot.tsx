"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MessageCircle, X, Send, Loader2, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatbotProps {
  quizId: string;
}

function formatMessage(content: string) {
  // Convert markdown-style headers
  content = content.replace(/###\s+(.*)/g, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Format equations
  content = content.replace(/\\\((.*?)\\\)/g, (_, math) => {
    try {
      return katex.renderToString(math, { displayMode: false });
    } catch (error) {
      console.error('KaTeX inline math error:', error);
      return math;
    }
  });

  // Add spacing after bullet points
  content = content.replace(/(\d+\.\s+)/g, '<br>$1');
  
  // Add paragraph spacing
  content = content.split('\n\n').map(paragraph => 
    `<p class="mb-3">${paragraph.trim()}</p>`
  ).join('');

  return content;
}

export function Chatbot({ quizId }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    const newUserMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, newUserMessage],
          quizId: quizId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or rephrase your question.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-8 bg-blue-500 hover:bg-blue-600 text-white shadow-lg rounded-full p-4 flex items-center gap-2"
      >
        <MessageCircle className="h-5 w-5" />
        <span>Ai Assistant</span>
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-20 right-8 w-[400px] max-h-[600px] shadow-2xl flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-500" />
          <CardTitle>Quiz Assistant</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex flex-col max-w-[80%] rounded-lg p-4",
              message.role === "user"
                ? "ml-auto bg-blue-500 text-white"
                : "bg-muted"
            )}
          >
            <div 
              className="prose prose-sm dark:prose-invert"
              dangerouslySetInnerHTML={{ 
                __html: message.role === "assistant" 
                  ? formatMessage(message.content)
                  : message.content 
              }}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <CardFooter className="p-4 pt-2">
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
} 