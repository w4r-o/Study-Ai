# StudyAI Frontend

A Flask-based web application for the StudyAI project that allows users to upload study materials, generate quizzes, and track their progress.

## Features

- User authentication (login/register)
- File upload for study materials (PDF)
- Quiz generation based on uploaded materials
- Interactive quiz interface
- Detailed quiz results with explanations
- Progress tracking
- Modern UI with Tailwind CSS

## Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

## Setup

1. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   FLASK_APP=run.py
   FLASK_ENV=development
   SECRET_KEY=your-secret-key-here
   API_URL=http://localhost:8000  # URL of the backend API
   ```

## Running the Application

1. Start the Flask development server:
   ```bash
   python run.py
   ```

2. Open your web browser and navigate to `http://localhost:5000`

## Project Structure

```
frontend/
├── app/
│   ├── __init__.py
│   ├── models/
│   │   └── user.py
│   ├── routes/
│   │   ├── main.py
│   │   ├── auth.py
│   │   └── quiz.py
│   ├── static/
│   │   ├── css/
│   │   ├── js/
│   │   └── img/
│   ├── templates/
│   │   ├── base.html
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── past_materials.html
│   │   ├── quiz.html
│   │   └── result.html
│   └── utils/
│       └── api.py
├── requirements.txt
├── run.py
└── README.md
```

## Development

- The application uses Flask for the web framework
- Templates are written in Jinja2 with Tailwind CSS for styling
- API communication is handled through the `api.py` utility
- User authentication is managed with Flask-Login

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 