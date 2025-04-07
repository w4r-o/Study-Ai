# Study AI App

A Next.js application that helps students study by generating quizzes from their notes and providing AI-powered feedback.

## Features

- Upload notes (PDF support)
- Generate quizzes based on uploaded content
- Multiple choice and short answer questions
- Real-time answer checking
- AI-powered feedback
- Progress tracking

## Setup Instructions

1. Clone the repository:
```bash
git clone <repository-url>
cd study-ai-app
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Get your API key from [OpenRouter](https://openrouter.ai/)
   - Update the `.env.local` file with your API keys

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

The app will be available at [http://localhost:3005](http://localhost:3005)

## Required Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key for AI functionality
- `NEXT_PUBLIC_OPENROUTER_API_KEY`: Public API key for client-side features
- `MODEL_PROVIDER`: The AI model to use (default: "deepseek/deepseek-chat-v3-0324:free")
- `OPENROUTER_REFERRER`: Your application's URL
- `OPENROUTER_SITE`: Your application's name

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- OpenRouter AI API
- PDF parsing libraries

## Development Notes

- The app uses port 3005 by default
- PDF files are processed client-side for note extraction
- AI requests are rate-limited based on your OpenRouter plan 