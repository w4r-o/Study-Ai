import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function Chatbot({ quizId }: { quizId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full bg-background"
        onClick={() => setIsOpen(true)}
      >
        <Bot className="h-6 w-6" />
        <span className="sr-only">Open AI Assistant</span>
      </Button>

      {/* ... rest of the component ... */}
    </>
  );
} 