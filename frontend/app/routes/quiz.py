from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from ..utils.api import api_request

bp = Blueprint('quiz', __name__)

@bp.route('/quiz/<quiz_id>')
@login_required
def take_quiz(quiz_id):
    try:
        response = api_request('GET', f'/api/quiz/{quiz_id}')
        if response.status_code == 200:
            quiz = response.json()
            return render_template('quiz/take_quiz.html', quiz=quiz)
        else:
            flash('Failed to load quiz.', 'error')
            return redirect(url_for('main.index'))
    except Exception as e:
        flash(f'Error: {str(e)}', 'error')
        return redirect(url_for('main.index'))

@bp.route('/quiz/<quiz_id>/submit', methods=['POST'])
@login_required
def submit_quiz(quiz_id):
    try:
        answers = request.json
        response = api_request('POST', f'/api/quiz/{quiz_id}/submit', json=answers)
        
        if response.status_code == 200:
            result_id = response.json()['result_id']
            return redirect(url_for('quiz.view_result', result_id=result_id))
        else:
            return jsonify({'error': 'Failed to submit quiz'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/result/<result_id>')
@login_required
def view_result(result_id):
    try:
        response = api_request('GET', f'/api/result/{result_id}')
        if response.status_code == 200:
            result = response.json()
            return render_template('quiz/view_result.html', result=result)
        else:
            flash('Failed to load result.', 'error')
            return redirect(url_for('main.index'))
    except Exception as e:
        flash(f'Error: {str(e)}', 'error')
        return redirect(url_for('main.index')) 