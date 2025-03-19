from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required
from ..models.user import User
from ..utils.api import api_request

bp = Blueprint('auth', __name__)

@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        try:
            response = api_request('POST', '/api/auth/login', json={
                'username': username,
                'password': password
            })
            
            if response.status_code == 200:
                data = response.json()
                user = User(data['id'], data['username'])
                login_user(user)
                return redirect(url_for('main.index'))
            else:
                flash('Invalid username or password.', 'error')
        except Exception as e:
            flash(f'Error: {str(e)}', 'error')
    
    return render_template('auth/login.html')

@bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        email = request.form.get('email')
        
        try:
            response = api_request('POST', '/api/auth/register', json={
                'username': username,
                'password': password,
                'email': email
            })
            
            if response.status_code == 201:
                flash('Registration successful. Please login.', 'success')
                return redirect(url_for('auth.login'))
            else:
                flash('Registration failed. Please try again.', 'error')
        except Exception as e:
            flash(f'Error: {str(e)}', 'error')
    
    return render_template('auth/register.html')

@bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.index')) 