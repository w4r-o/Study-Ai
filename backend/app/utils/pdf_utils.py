import PyPDF2
from io import BytesIO
from typing import List

async def extract_text_from_pdf(file: bytes) -> str:
    """Extract text from a PDF file."""
    try:
        pdf_file = BytesIO(file)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")

async def process_pdf_files(files: List[bytes]) -> str:
    """Process multiple PDF files and combine their text."""
    texts = []
    for file in files:
        text = await extract_text_from_pdf(file)
        texts.append(text)
    return "\n\n".join(texts) 