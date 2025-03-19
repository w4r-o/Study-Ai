from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import os
from dotenv import load_dotenv
import openai
from .utils.pdf_utils import process_pdf_files
from .auth.auth import verify_token, TokenData
from .database.supabase import (
    create_quiz,
    get_quiz,
    get_quizzes,
    create_quiz_result,
    get_quiz_result
)

load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

class QuestionDistribution(BaseModel):
    multipleChoice: int
    knowledge: int
    thinking: int
    application: int
    communication: int

async def get_current_user(token: str = Depends(verify_token)) -> TokenData:
    return token

@app.post("/api/upload")
async def upload_files(
    notes: List[UploadFile] = File(...),
    past_test: Optional[UploadFile] = File(None),
    grade: str = Form(...),
    question_distribution: str = Form(...),
    current_user: TokenData = Depends(get_current_user)
):
    try:
        # Parse question distribution
        distribution = json.loads(question_distribution)
        
        # Process notes
        notes_content = [await note.read() for note in notes]
        notes_text = await process_pdf_files(notes_content)
        
        # Process past test if provided
        past_test_text = None
        if past_test:
            past_test_content = await past_test.read()
            past_test_text = await process_pdf_files([past_test_content])
        
        # Generate questions using OpenAI
        prompt = f"""
        Based on the following notes and grade level {grade}, generate practice questions.
        {past_test_text and f'Use this past test as reference for question style: {past_test_text}'}
        
        Notes:
        {notes_text}
        
        Generate questions according to this distribution:
        - Multiple Choice: {distribution['multipleChoice']}
        - Knowledge: {distribution['knowledge']}
        - Thinking: {distribution['thinking']}
        - Application: {distribution['application']}
        - Communication: {distribution['communication']}
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates practice questions based on study materials."},
                {"role": "user", "content": prompt}
            ]
        )
        
        questions = response.choices[0].message.content
        
        # Store in database
        quiz = await create_quiz(
            grade=grade,
            questions=questions,
            distribution=distribution,
            notes_text=notes_text,
            past_test_text=past_test_text,
            user_id=current_user.username
        )
        
        return {"quiz_id": quiz["id"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quiz/{quiz_id}")
async def get_quiz_endpoint(quiz_id: str):
    try:
        quiz = await get_quiz(quiz_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        return quiz
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quizzes")
async def get_quizzes_endpoint(current_user: TokenData = Depends(get_current_user)):
    try:
        quizzes = await get_quizzes(user_id=current_user.username)
        return quizzes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/quiz/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: str,
    answers: Dict[str, str],
    current_user: TokenData = Depends(get_current_user)
):
    try:
        # Get the quiz
        quiz = await get_quiz(quiz_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        
        # Generate explanations and grade answers
        questions_with_answers = [
            {
                "id": q["id"],
                "text": q["text"],
                "type": q["type"],
                "options": q.get("options"),
                "correctAnswer": q["answer"],
                "userAnswer": answers.get(q["id"], "")
            }
            for q in quiz["questions"]
        ]
        
        explanation_prompt = f"""
        You are a helpful tutor. For each of the following questions, evaluate the student's answer and provide:
        1. Whether the answer is correct or incorrect
        2. A detailed explanation of why the answer is correct or incorrect
        3. For incorrect answers, explain the correct approach
        
        Questions and Answers:
        {json.dumps(questions_with_answers, indent=2)}
        
        Format your response as a JSON array with the following structure:
        [
            {{
                "id": "question_id",
                "isCorrect": true/false,
                "explanation": "Detailed explanation"
            }}
        ]
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful tutor evaluating student answers."},
                {"role": "user", "content": explanation_prompt}
            ]
        )
        
        explanations = json.loads(response.choices[0].message.content)
        
        # Calculate score
        score = sum(1 for e in explanations if e["isCorrect"])
        
        # Create result in database
        result = await create_quiz_result(
            quiz_id=quiz_id,
            user_id=current_user.username,
            score=score,
            total_questions=len(questions_with_answers),
            answers=[
                {
                    "question_id": q["id"],
                    "user_answer": q["userAnswer"],
                    "is_correct": next(e["isCorrect"] for e in explanations if e["id"] == q["id"]),
                    "explanation": next(e["explanation"] for e in explanations if e["id"] == q["id"])
                }
                for q in questions_with_answers
            ]
        )
        
        return {"result_id": result["id"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/result/{result_id}")
async def get_result(result_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        result = await get_quiz_result(result_id)
        if not result:
            raise HTTPException(status_code=404, detail="Result not found")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 