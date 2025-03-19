from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
import requests
from ..utils.api import api_request

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    return render_template('index.html')

@bp.route('/upload', methods=['POST'])
@login_required
def upload():
    try:
        files = request.files.getlist('notes')
        past_test = request.files.get('past_test')
        grade = request.form.get('grade')
        distribution = {
            'multipleChoice': int(request.form.get('multipleChoice', 5)),
            'knowledge': int(request.form.get('knowledge', 3)),
            'thinking': int(request.form.get('thinking', 3)),
            'application': int(request.form.get('application', 2)),
            'communication': int(request.form.get('communication', 2))
        }
        
        # Prepare form data
        form_data = {
            'grade': grade,
            'question_distribution': distribution
        }
        
        # Add files to form data
        files_data = [('notes', (f.filename, f.read(), f.content_type)) for f in files]
        if past_test:
            files_data.append(('past_test', (past_test.filename, past_test.read(), past_test.content_type)))
        
        # Make API request
        response = api_request('POST', '/api/upload', files=files_data, data=form_data)
        
        if response.status_code == 200:
            quiz_id = response.json()['quiz_id']
            return redirect(url_for('quiz.take_quiz', quiz_id=quiz_id))
        else:
            flash('Failed to create quiz. Please try again.', 'error')
            return redirect(url_for('main.index'))
            
    except Exception as e:
        flash(f'Error: {str(e)}', 'error')
        return redirect(url_for('main.index'))

@bp.route('/past-materials')
@login_required
def past_materials():
    try:
        response = api_request('GET', '/api/quizzes')
        if response.status_code == 200:
            quizzes = response.json()
            return render_template('past_materials.html', quizzes=quizzes)
        else:
            flash('Failed to fetch past materials.', 'error')
            return redirect(url_for('main.index'))
    except Exception as e:
        flash(f'Error: {str(e)}', 'error')
        return redirect(url_for('main.index')) 