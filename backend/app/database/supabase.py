from supabase import create_client, Client
from typing import Dict, Any, List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

def get_supabase_client() -> Client:
    """Get a Supabase client instance."""
    return create_client(
        os.getenv("SUPABASE_URL", ""),
        os.getenv("SUPABASE_KEY", "")
    )

async def create_quiz(
    grade: str,
    questions: str,
    distribution: Dict[str, int],
    notes_text: str,
    past_test_text: Optional[str] = None,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new quiz in the database."""
    client = get_supabase_client()
    
    quiz_data = {
        "grade": grade,
        "questions": questions,
        "distribution": distribution,
        "notes_text": notes_text,
        "past_test_text": past_test_text,
        "user_id": user_id
    }
    
    result = client.table("quizzes").insert(quiz_data).execute()
    return result.data[0]

async def get_quiz(quiz_id: str) -> Optional[Dict[str, Any]]:
    """Get a quiz by ID."""
    client = get_supabase_client()
    result = client.table("quizzes").select("*").eq("id", quiz_id).execute()
    return result.data[0] if result.data else None

async def get_quizzes(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get all quizzes, optionally filtered by user ID."""
    client = get_supabase_client()
    query = client.table("quizzes").select("*")
    
    if user_id:
        query = query.eq("user_id", user_id)
    
    result = query.order("created_at", desc=True).execute()
    return result.data

async def create_quiz_result(
    quiz_id: str,
    user_id: str,
    score: int,
    total_questions: int,
    answers: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Create a quiz result and its associated answers."""
    client = get_supabase_client()
    
    # Create the result
    result_data = {
        "quiz_id": quiz_id,
        "user_id": user_id,
        "score": score,
        "total_questions": total_questions
    }
    
    result = client.table("quiz_results").insert(result_data).execute()
    result_id = result.data[0]["id"]
    
    # Create the answers
    for answer in answers:
        answer["result_id"] = result_id
        client.table("answer_details").insert(answer).execute()
    
    return result.data[0]

async def get_quiz_result(result_id: str) -> Optional[Dict[str, Any]]:
    """Get a quiz result with its associated answers and questions."""
    client = get_supabase_client()
    
    # Get the result with quiz details
    result = client.table("quiz_results").select(
        "*",
        "quiz:quiz_id (id, title, subject, grade)"
    ).eq("id", result_id).execute()
    
    if not result.data:
        return None
    
    # Get the answer details with questions
    answers = client.table("answer_details").select(
        "*",
        "question:question_id (id, text, type, options, answer)"
    ).eq("result_id", result_id).order("id").execute()
    
    return {
        **result.data[0],
        "answers": answers.data
    } 