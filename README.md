# StudyAI

A study aid application that generates practice questions from your notes using AI.

## Features

- Upload PDF notes and past tests
- Select grade level
- Configure question distribution
- Generate practice questions using AI
- View past materials
- Beautiful UI with Tailwind CSS

## Tech Stack

- Frontend: Next.js with Tailwind CSS
- Backend: Python FastAPI
- Database: Supabase
- AI: OpenAI GPT-4

## Setup

### Prerequisites

- Node.js 18+
- Python 3.8+
- Supabase account
- OpenAI API key

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Backend Setup

1. Create a virtual environment and activate it:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the backend directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
OPENAI_API_KEY=your_openai_api_key
```

## Running the Application

1. Start the backend server:
```bash
cd backend
uvicorn app.main:app --reload
```

2. In a new terminal, start the frontend development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

1. Create a new project in Supabase
2. Create the following tables:

```sql
-- quizzes table
create table quizzes (
  id uuid default uuid_generate_v4() primary key,
  grade text not null,
  questions text not null,
  distribution jsonb not null,
  notes_text text not null,
  past_test_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

## API Endpoints

- `POST /api/upload`: Upload notes and generate quiz
- `GET /api/quiz/{quiz_id}`: Get a specific quiz
- `GET /api/quizzes`: Get all quizzes

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 